// scripts/fetch-content.mjs
// 构建期内容读取：把 D1 里的可编辑内容抽成 src/generated/content.json，
// 供 Astro 静态构建（src/lib/site-data.ts 通过 JSON-backed reader 消费）。
//
// 数据来源优先级：
//   1. D1（生产真源）：远程走 Cloudflare D1 REST API；本地走 `wrangler d1 execute --local`。
//   2. 已提交的快照 src/generated/content.json（与 D1 可能滞后，但保证构建永不中断）。
//   3. --from-yaml：直接从仓库内的遗留 YAML（src/content + 根单例）重建快照（一次性引导用）。
//
// 设计要点：content.json 的形状与「Keystatic reader 的返回值」一一对应，
// 因此 src/lib/site-data.ts 的读取/兜底逻辑完全不用改。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GEN_DIR = path.join(ROOT, 'src/generated');
const OUT = path.join(GEN_DIR, 'content.json');

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || 'b4f68b37b18c0891a0df46f3bf4d07f1';
const DB_NAME = process.env.D1_DB_NAME || 'tackix-content';
const DB_ID = process.env.D1_DATABASE_ID || ''; // 优先用 id，否则按 name 解析
const USE_LOCAL = process.env.USE_LOCAL_D1 === '1';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';

// ─────────────────────────────── 组装假 reader 形状 ───────────────────────────────
function buildShape({ knowledge = [], scenarios = [], singletons = {} }) {
  return { knowledge, scenarios, singletons };
}

// ─────────────────────────────── D1：远程（REST）───────────────────────────────
async function resolveDbId() {
  if (DB_ID) return DB_ID;
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database?name=${encodeURIComponent(DB_NAME)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' } });
  if (!res.ok) throw new Error(`解析 D1 id 失败 ${res.status}`);
  const json = await res.json();
  const found = json?.result?.find((d) => d.name === DB_NAME) || json?.result?.[0];
  if (!found) throw new Error(`未找到 D1 数据库 ${DB_NAME}`);
  return found.uuid || found.id;
}

async function readD1Remote() {
  if (!TOKEN) throw new Error('缺少 CLOUDFLARE_API_TOKEN');
  const id = await resolveDbId();
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${id}/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ sql: 'SELECT * FROM content_entries ORDER BY id' }),
  });
  if (!res.ok) throw new Error(`D1 查询失败 ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const results = json?.result?.[0]?.results ?? [];
  return results;
}

// ─────────────────────────────── D1：本地（wrangler）────────────────────────────
async function readD1Local() {
  const { execFileSync } = await import('node:child_process');
  const out = execFileSync(
    'npx',
    [
      'wrangler', 'd1', 'execute', DB_NAME,
      '--local', '--persist-to', '.wrangler',
      '--command', 'SELECT * FROM content_entries ORDER BY id',
      '--json',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const parsed = JSON.parse(out);
  const results = Array.isArray(parsed) ? parsed[0]?.results ?? parsed : parsed?.results ?? [];
  return results;
}

async function readD1() {
  const rows = USE_LOCAL ? await readD1Local() : await readD1Remote();
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows.map((r) => ({
    kind: r.kind,
    collection: r.collection,
    slug: r.slug,
    data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data,
  }));
}

// ─────────────────────────────── 回退：YAML 引导 ───────────────────────────────
const SINGLETON_KEYS = ['home', 'ui', 'contact', 'pages', 'detail', 'about', 'site', 'categories', 'tags'];

function readYaml(p) {
  if (!fs.existsSync(p)) return null;
  try {
    return yaml.load(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.warn(`[fetch-content] 解析 ${p} 失败：${e.message}`);
    return null;
  }
}

function buildFromYaml() {
  const knowledge = [];
  const kdir = path.join(ROOT, 'src/content/knowledge');
  if (fs.existsSync(kdir)) {
    for (const f of fs.readdirSync(kdir).filter((f) => /\.ya?ml$/.test(f))) {
      const slug = f.replace(/\.ya?ml$/, '');
      const data = readYaml(path.join(kdir, f));
      if (data) knowledge.push({ slug, data });
    }
  }
  const scenarios = [];
  const sdir = path.join(ROOT, 'src/content/scenarios');
  if (fs.existsSync(sdir)) {
    for (const f of fs.readdirSync(sdir).filter((f) => /\.ya?ml$/.test(f))) {
      const slug = f.replace(/\.ya?ml$/, '');
      const data = readYaml(path.join(sdir, f));
      if (data) scenarios.push({ slug, data });
    }
  }
  const singletons = {};
  for (const key of SINGLETON_KEYS) {
    const data = readYaml(path.join(ROOT, `${key}/index.yaml`));
    if (data) singletons[key] = data;
  }
  return buildShape({ knowledge, scenarios, singletons });
}

// ─────────────────────────────── 主流程 ───────────────────────────────
async function main() {
  fs.mkdirSync(GEN_DIR, { recursive: true });
  const forceYaml = process.argv.includes('--from-yaml');

  if (!forceYaml) {
    try {
      const rows = await readD1();
      if (rows) {
        const grouped = { knowledge: [], scenarios: [], singletons: {} };
        for (const r of rows) {
          if (r.kind === 'knowledge') grouped.knowledge.push({ slug: r.slug, data: r.data });
          else if (r.kind === 'scenario') grouped.scenarios.push({ slug: r.slug, data: r.data });
          else if (r.kind === 'singleton') grouped.singletons[r.slug] = r.data;
        }
        fs.writeFileSync(OUT, JSON.stringify(grouped, null, 2));
        console.log(
          `[fetch-content] ✅ 已从 D1 写入 ${OUT}（knowledge ${grouped.knowledge.length} / scenarios ${grouped.scenarios.length} / singletons ${Object.keys(grouped.singletons).length}）`
        );
        return;
      }
      console.warn('[fetch-content] D1 为空或不可达，尝试回退…');
    } catch (e) {
      console.warn(`[fetch-content] D1 读取失败：${e.message}，尝试回退…`);
    }
  }

  // 回退：已提交快照 > 重建自 YAML
  if (!forceYaml && fs.existsSync(OUT)) {
    console.warn(`[fetch-content] 使用已提交的快照 ${OUT}（与 D1 可能滞后，发布后会刷新）`);
    return;
  }

  const built = buildFromYaml();
  fs.writeFileSync(OUT, JSON.stringify(built, null, 2));
  console.log(
    `[fetch-content] ✅ 由 YAML 引导写入 ${OUT}（knowledge ${built.knowledge.length} / scenarios ${built.scenarios.length} / singletons ${Object.keys(built.singletons).length}）`
  );
}

main().catch((e) => {
  console.error('[fetch-content] 失败：', e);
  process.exit(1);
});
