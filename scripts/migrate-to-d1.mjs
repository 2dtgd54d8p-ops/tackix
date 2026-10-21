// scripts/migrate-to-d1.mjs
// 把现有 Keystatic 内容（src/content/*.yaml + 仓库根单例 <key>/index.yaml）一次性灌入 D1，
// 媒体（public/uploads）同步上传到 R2。幂等：重复执行用 INSERT OR REPLACE，不会重复。
//
// 用法：
//   node scripts/migrate-to-d1.mjs --local      # 写入本地 D1/R2（.wrangler 持久化），用于本地开发
//   node scripts/migrate-to-d1.mjs --remote     # 写入线上 D1/R2（需 CLOUDFLARE_API_TOKEN + 已建库/桶）
//
// 前置：wrangler d1 create tackix-content  /  wrangler r2 bucket create tackix-media
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB_NAME = process.env.D1_DB_NAME || 'tackix-content';
const BUCKET = process.env.R2_BUCKET_NAME || 'tackix-media';
const PERSIST = '.wrangler';
const LOCAL = process.argv.includes('--local');
const REMOTE = process.argv.includes('--remote') || !LOCAL;
const SQL_ONLY = process.argv.includes('--sql-only'); // 仅生成 SQL，不调用 wrangler（便于检查/手动执行）

const SINGLETON_KEYS = ['home', 'ui', 'contact', 'pages', 'detail', 'about', 'site', 'categories', 'tags'];

function readYaml(p) {
  if (!fs.existsSync(p)) return null;
  try { return yaml.load(fs.readFileSync(p, 'utf8')); } catch (e) { console.warn(`解析 ${p} 失败：${e.message}`); return null; }
}

function titlesFromData(data) {
  const name = data?.name;
  if (name && typeof name === 'object') return { zh: name.zh ?? '', en: name.en ?? '' };
  const t = data?.title;
  if (typeof t === 'string') return { zh: t, en: t };
  return { zh: '', en: '' };
}

function readDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
}

// 构建行（与 fetch-content 的 YAML 引导同构，再补上反规范化列）
function buildRows() {
  const rows = [];
  // knowledge
  for (const f of readDir(path.join(ROOT, 'src/content/knowledge'))) {
    const slug = f.replace(/\.ya?ml$/, '');
    const data = readYaml(path.join(ROOT, 'src/content/knowledge', f));
    if (!data) continue;
    const t = titlesFromData(data);
    rows.push({ id: `knowledge/${slug}`, kind: 'knowledge', collection: 'knowledge', slug, data, ...t, published: !!data.published, featured: !!data.featured });
  }
  // scenarios
  for (const f of readDir(path.join(ROOT, 'src/content/scenarios'))) {
    const slug = f.replace(/\.ya?ml$/, '');
    const data = readYaml(path.join(ROOT, 'src/content/scenarios', f));
    if (!data) continue;
    const t = titlesFromData(data);
    rows.push({ id: `scenario/${slug}`, kind: 'scenario', collection: 'scenarios', slug, data, ...t, published: !!data.published, featured: !!data.featured });
  }
  // singletons
  for (const key of SINGLETON_KEYS) {
    const data = readYaml(path.join(ROOT, `${key}/index.yaml`));
    if (!data) continue;
    const t = titlesFromData(data);
    rows.push({ id: `singleton/${key}`, kind: 'singleton', collection: key, slug: key, data, ...t, published: 1, featured: 0 });
  }
  return rows;
}

function sqlStr(s) {
  return "'" + String(s ?? '').replace(/'/g, "''") + "'";
}
function toSql(rows) {
  let sql = '';
  for (const r of rows) {
    sql += `INSERT OR REPLACE INTO content_entries (id, kind, collection, slug, data, title_zh, title_en, published, featured, updated_at) VALUES (`;
    sql += `${sqlStr(r.id)}, ${sqlStr(r.kind)}, ${sqlStr(r.collection)}, ${sqlStr(r.slug)}, ${sqlStr(JSON.stringify(r.data))}, ${sqlStr(r.zh)}, ${sqlStr(r.en)}, ${r.published ? 1 : 0}, ${r.featured ? 1 : 0}, ${Date.now()});\n`;
  }
  return sql;
}

function spawnWrangler(args) {
  return execFileSync('npx', ['wrangler', ...args], { stdio: 'inherit', encoding: 'utf8' });
}

// 迁移媒体：public/uploads → R2（best-effort）
function migrateMedia() {
  const updir = path.join(ROOT, 'public/uploads');
  if (!fs.existsSync(updir)) { console.log('[migrate] 无 public/uploads，跳过媒体迁移'); return; }
  const files = [];
  const walk = (d, rel) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name), path.join(rel, e.name));
      else files.push({ abs: path.join(d, e.name), rel: path.join(rel, e.name) });
    }
  };
  walk(updir, '');
  let ok = 0;
  for (const f of files) {
    const key = `uploads/${f.rel.split(path.sep).join('/')}`;
    try {
      const args = ['r2', 'object', 'put', `${BUCKET}/${key}`, '--file', f.abs];
      if (LOCAL) args.push('--local', '--persist-to', PERSIST);
      spawnWrangler(args);
      ok++;
    } catch (e) {
      console.warn(`[migrate] 上传 ${key} 失败（可稍后手动补）：${e.message}`);
    }
  }
  console.log(`[migrate] 媒体：成功上传 ${ok}/${files.length}`);
}

async function main() {
  const rows = buildRows();
  if (!rows.length) { console.error('[migrate] 未读取到任何内容，终止。'); process.exit(1); }
  // 先建表（IF NOT EXISTS，幂等），再灌数据，确保本地空库也能直接跑
  const schemaPath = path.join(ROOT, 'migrations', '0001_init.sql');
  const schema = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, 'utf8') + '\n' : '';
  const sql = schema + toSql(rows);
  const sqlPath = path.join(ROOT, 'scripts', '.migrate.sql');
  fs.writeFileSync(sqlPath, sql);

  const target = LOCAL ? '本地（--local）' : '线上（--remote）';
  console.log(`[migrate] 准备写入 ${target}：knowledge + scenarios + singletons 共 ${rows.length} 条`);

  const d1args = ['d1', 'execute', DB_NAME, '--file', sqlPath];
  if (LOCAL) d1args.push('--local', '--persist-to', PERSIST);
  else d1args.push('--remote');

  if (SQL_ONLY) {
    const out = path.join(ROOT, 'scripts', 'migrate.sql');
    fs.copyFileSync(sqlPath, out);
    console.log(`[migrate] --sql-only：已生成 ${out}（共 ${rows.length} 条 INSERT），未执行。可手动执行或去掉该参数由 wrangler 执行。`);
    fs.unlinkSync(sqlPath);
    return;
  }

  try {
    spawnWrangler(d1args);
    console.log(`[migrate] ✅ D1 写入完成（${rows.length} 条）`);
  } catch (e) {
    console.error(`[migrate] ❌ D1 写入失败：${e.message}`);
    console.error('请确认：1) 已 wrangler d1 create tackix-content；2) 本地用 --local 或线上已登录/配置了 CLOUDFLARE_API_TOKEN');
    process.exit(1);
  } finally {
    fs.unlinkSync(sqlPath);
  }

  try { migrateMedia(); } catch (e) { console.warn('[migrate] 媒体迁移异常：', e.message); }

  console.log('[migrate] 完成。下一步：npm run build 会从 D1 抽内容；线上需在 Cloudflare 控制台建 Deploy Hook 并设为 PAGES_DEPLOY_HOOK 环境变量，后台“发布”才会触发重建。');
}

main().catch((e) => { console.error(e); process.exit(1); });
