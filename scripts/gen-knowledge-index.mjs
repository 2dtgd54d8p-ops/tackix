// 构建期生成 public/knowledge-index.json：slug → { zh, en } 标题映射。
// 供运营报表（/admin/report）客户端把反馈里的「裸 slug」还原成可读标题，
// 避免操作员只看到一串 URL slug。仅依赖本地文件系统读取文章 YAML，
// 与 astro build 期 createReader 读取同一目录（src/content/knowledge/*.yaml），
// 但本脚本零依赖 Keystatic，纯 node + js-yaml 即可。
//
// 生成时机：prebuild（与 gen-content-options 同源），CI 与本地 build 都会产出，
// 产物位于 public/，随 dist 一起部署，报表页运行时 fetch 它做标题回填。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src/content/knowledge');
const DEST_DIR = path.join(ROOT, 'public');
const DEST = path.join(DEST_DIR, 'knowledge-index.json');

function bilingual(v) {
  if (!v) return { zh: '', en: '' };
  if (typeof v === 'string') return { zh: v, en: v };
  return { zh: v.zh || '', en: v.en || '' };
}

export function main() {
  if (!fs.existsSync(SRC)) {
    console.warn('[gen-knowledge-index] 文章目录不存在：', SRC);
    return 0;
  }
  const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
  const out = {};
  for (const f of files) {
    const raw = fs.readFileSync(path.join(SRC, f), 'utf8');
    let doc;
    try {
      doc = yaml.load(raw);
    } catch (e) {
      console.warn('[gen-knowledge-index] 解析失败，跳过：', f, e.message);
      continue;
    }
    if (!doc || typeof doc !== 'object') continue;
    const slug = typeof doc.title === 'string' ? doc.title.trim() : f.replace(/\.ya?ml$/, '');
    if (!slug) continue;
    if (doc.published === false) continue; // 下架文章不进索引
    const name = bilingual(doc.name);
    out[slug] = { zh: name.zh, en: name.en };
  }
  if (!fs.existsSync(DEST_DIR)) fs.mkdirSync(DEST_DIR, { recursive: true });
  fs.writeFileSync(DEST, JSON.stringify(out, null, 2));
  console.log(`[gen-knowledge-index] 写入 ${Object.keys(out).length} 篇文章标题映射 → public/knowledge-index.json`);
  return 0;
}

// 允许作为独立脚本运行，也允许被 import
if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
