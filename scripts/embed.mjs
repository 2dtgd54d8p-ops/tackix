#!/usr/bin/env node
/**
 * scripts/embed.mjs — 把 D1 知识库内容切片并灌入 Cloudflare Vectorize（RAG 前置步骤）
 * ---------------------------------------------------------------------------
 * 数据源：D1 导出的 content_entries JSON（由 `scripts/export-content.mjs` 生成），
 *         避免嵌入脚本依赖 D1 凭据（与部署用 token 解耦）。
 * 向量化：Cloudflare Workers AI  embeddings（@cf/baai/bge-base-en-v1.5, 768 维）
 * 写入：  Cloudflare Vectorize index（VECTORIZE_INDEX）
 *
 * 用法：
 *   export CF_ACCOUNT_ID=b4f68b37b18c0891a0df46f3bf4d07f1
 *   export CF_API_TOKEN=xxx          # 需 Vectorize:Edit + Workers AI:Edit
 *   export VECTORIZE_INDEX=tackix-kb
 *   export KB_EXPORT=/path/to/content.json   # content_entries 导出
 *   node scripts/embed.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ACCOUNT = process.env.CF_ACCOUNT_ID;
const TOKEN = process.env.CF_API_TOKEN;
const INDEX = process.env.VECTORIZE_INDEX || 'tackix-kb';
const KB_EXPORT = process.env.KB_EXPORT;
const COLLECTIONS = (process.env.KB_COLLECTIONS || 'knowledge,scenarios')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (!ACCOUNT || !TOKEN) {
  console.error('缺少 CF_ACCOUNT_ID / CF_API_TOKEN');
  process.exit(1);
}
if (!KB_EXPORT) {
  console.error('缺少 KB_EXPORT（content_entries 导出 JSON 路径）');
  process.exit(1);
}

const AI_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run/@cf/baai/bge-base-en-v1.5`;
const UPSERT_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/vectorize/indexes/${INDEX}/upsert`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 1. 加载内容 ----
let rows;
try {
  rows = JSON.parse(readFileSync(KB_EXPORT, 'utf8'));
} catch (e) {
  console.error('读取 KB_EXPORT 失败:', e.message);
  process.exit(1);
}
const docs = rows
  .filter((r) => COLLECTIONS.includes(r.collection))
  .map((r) => ({ collection: r.collection, slug: r.slug, data: JSON.parse(r.data || '{}') }));
console.log(`加载 ${docs.length} 篇文档（collections: ${COLLECTIONS.join(', ')}）`);

// ---- 2. 提取中英文本块 ----
// 把字段值拆成中英两段（双语 RAG：中英文分别建向量，查询时按语种命中同语言上下文，
// 避免英文问题命中中文上下文导致模型退化成重复）。
function splitLang(obj) {
  if (!obj) return { zh: '', en: '' };
  if (typeof obj === 'string') {
    const s = obj.trim();
    const isZh = /[一-鿿]/.test(s);
    return isZh ? { zh: s, en: '' } : { zh: '', en: s };
  }
  if (typeof obj === 'object') {
    const zh = (obj.zh || obj.ZH || '').trim();
    const en = (obj.en || obj.EN || '').trim();
    if (!zh && !en) {
      const s = JSON.stringify(obj);
      const isZh = /[一-鿿]/.test(s);
      return isZh ? { zh: s, en: '' } : { zh: '', en: s };
    }
    return { zh, en };
  }
  return { zh: '', en: '' };
}

// 清洗 KB 文本中的结构性噪音，避免模型在生成时照抄成 "# 中英文对齐 / # 简要回答" 循环，
// 也避免把"问题：…"这种问答提示词当成正文嵌入。
function cleanText(t) {
  if (!t) return t;
  return t
    .split('\n')
    .filter((line) => {
      const s = line.trim();
      if (/^#+\s/.test(s)) return false; // markdown 标题行
      if (/^中英文对齐/.test(s)) return false; // 对齐标签
      if (/^(问题|问|Q)[:：]/i.test(s)) return false; // 问答提示词（只去问题，保留答案）
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/^[\s#*_]+|[\s#*_]+$/g, '')
    .trim();
}

function extractBlocks(d) {
  const blocks = [];
  const fields = ['name', 'title', 'excerpt', 'body', 'conclusion', 'selectionLogic', 'faq', 'recommendedProducts'];
  for (const f of fields) {
    const { zh, en } = splitLang(d[f]);
    // 嵌入用原文（保留"问题：X"等最贴近检索词的文本，保证召回率）；
    // 生成时再由 ask.ts 的 cleanText 去除问答/标题噪音，避免模型照抄。
    if (zh) blocks.push({ label: f, lang: 'zh', text: zh });
    if (en) blocks.push({ label: f, lang: 'en', text: en });
  }
  return blocks;
}

function chunk(text, max = 800) {
  const paras = String(text).split(/\n{2,}/).filter(Boolean);
  const out = [];
  let buf = '';
  for (const p of paras) {
    if ((buf + '\n\n' + p).length > max) {
      if (buf.trim()) out.push(buf.trim());
      buf = p.length > max ? p.slice(0, max) : p;
    } else buf += (buf ? '\n\n' : '') + p;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

const vectors = [];
for (const doc of docs) {
  for (const blk of extractBlocks(doc.data)) {
    for (const c of chunk(blk.text)) {
      vectors.push({
        id: `${doc.slug}#${blk.label}#${blk.lang}#${vectors.length}`,
        collection: doc.collection,
        slug: doc.slug,
        label: blk.label,
        lang: blk.lang,
        text: c,
      });
    }
  }
}
console.log(`切片完成：${vectors.length} 段向量（待嵌入）`);

// ---- 3. 逐段嵌入 ----
async function embed(text) {
  const r = await fetch(AI_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const j = await r.json();
  if (!j.success) throw new Error('embed err: ' + JSON.stringify(j.errors || j));
  const data = j.result?.data;
  if (!data || !data[0]) throw new Error('embed 返回异常: ' + JSON.stringify(j).slice(0, 200));
  return data[0];
}

let ok = 0;
for (let i = 0; i < vectors.length; i++) {
  const v = vectors[i];
  try {
    v.values = await embed(v.text);
    ok++;
  } catch (e) {
    console.error(`嵌入失败 [${v.id}]: ${e.message}`);
  }
  if ((i + 1) % 10 === 0) process.stdout.write(`\r嵌入 ${i + 1}/${vectors.length}`);
  await sleep(80);
}
console.log(`\n嵌入成功 ${ok}/${vectors.length}`);
const ready = vectors.filter((v) => Array.isArray(v.values));
if (!ready.length) {
  console.error('没有可用向量，退出');
  process.exit(1);
}

// ---- 4. 写出 JSONL（供 wrangler vectorize upsert 灌入，比 REST upsert 更稳定）----
const JSONL = process.env.VECTOR_JSONL || '/tmp/tackix_vectors.jsonl';
const lines = ready.map((v) =>
  JSON.stringify({
    id: v.id,
    values: v.values,
    metadata: { collection: v.collection, slug: v.slug, label: v.label, lang: v.lang, text: v.text },
  })
);
writeFileSync(JSONL, lines.join('\n') + '\n');
console.log(`已写出 ${lines.length} 条向量 → ${JSONL}`);
console.log('下一步执行：');
console.log(
  `  npx wrangler vectorize upsert ${INDEX} --file=${JSONL}`
);
