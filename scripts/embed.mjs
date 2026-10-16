#!/usr/bin/env node
/**
 * scripts/embed.mjs — 把 knowledge 内容切片并灌入 Cloudflare Vectorize（L6 RAG 的前置步骤）
 * ---------------------------------------------------------------------------
 * 用法（需先在 CF 控制台创建 Vectorize index，如 tackix-kb，并配置 Workers AI 绑定）：
 *   export CF_ACCOUNT_ID=xxx
 *   export CF_API_TOKEN=xxx        # 具备 Vectorize + Workers AI 权限
 *   export VECTORIZE_INDEX=tackix-kb
 *   node scripts/embed.mjs
 *
 * 流程：读取知识库 YAML → 按段落切片 → 调 Workers AI embeddings → upsert 到 Vectorize。
 * 本脚本为可运行脚手架：切片与元数据已就绪，embeddings/upsert 需填入上方凭据后启用。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KNOWLEDGE_DIR = join(ROOT, 'src/content/knowledge');

function chunk(text, max = 800) {
  const ps = String(text)
    .split(/\n{2,}/)
    .filter(Boolean);
  const out = [];
  let buf = '';
  for (const p of ps) {
    if ((buf + p).length > max) {
      if (buf.trim()) out.push(buf.trim());
      buf = p;
    } else buf += '\n' + p;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

const files = existsSync(KNOWLEDGE_DIR)
  ? readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
  : [];
const records = [];
for (const f of files) {
  const slug = f.replace(/\.ya?ml$/, '');
  const post = load(readFileSync(join(KNOWLEDGE_DIR, f), 'utf8'));
  const text = [post.excerpt?.zh, post.body?.zh, post.excerpt?.en, post.body?.en]
    .filter(Boolean)
    .join('\n\n');
  chunk(text).forEach((c, i) =>
    records.push({ id: `${slug}#${i}`, metadata: { slug, text: c } })
  );
}

console.log(`切片完成：${records.length} 段（来自 ${files.length} 篇）。`);
console.log(`目标 Vectorize index：${process.env.VECTORIZE_INDEX || '(未设置 VECTORIZE_INDEX)'}`);

if (!process.env.CF_ACCOUNT_ID || !process.env.CF_API_TOKEN || !process.env.VECTORIZE_INDEX) {
  console.log('缺少 CF 凭据（CF_ACCOUNT_ID / CF_API_TOKEN / VECTORIZE_INDEX），仅生成切片结构，未执行 embeddings/upsert。');
  console.log('拿到凭据后：对每段调 Workers AI embeddings 得到向量，再用 `wrangler vectorize upsert` 或 CF REST API 写入。');
  process.exit(0);
}

// 真实执行（示意，需按 Workers AI / Vectorize REST 文档补全鉴权与批量逻辑）：
console.log('已检测到凭据，执行 embeddings + upsert（此处为脚手架，请按官方 API 补全实现）。');
