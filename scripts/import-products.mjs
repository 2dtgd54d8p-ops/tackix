// scripts/import-products.mjs
// 选型领域基座 · 批量导入 products / compatibility（CSV 或 JSON → D1）
//
// 用法：
//   node scripts/import-products.mjs --file data/products.csv [--compat data/compatibility.csv] --local
//   node scripts/import-products.mjs --file data/products.json --remote
//   node scripts/import-products.mjs --file data/products.csv --sql-only   # 只生成 SQL 检查，不执行
//   node scripts/import-products.mjs --template data/products.sample.csv   # 生成 CSV 模板
//
// 规则：
//   - 幂等：INSERT OR REPLACE（以 id 为主键）
//   - products.csv 列：id,slug,brand,name_zh,name_en,category,chemistry,cure_type,color,
//                      viscosity,tensile_str,elongation,temp_min,temp_max,shore,mix_ratio,
//                      pot_life_min,cure_time_min,shelf_life,features
//     （features 为 JSON 数组字符串，如 "[""high-strength"",""metal""]"）
//   - compatibility.csv 列：product_id,substrate_id,suitability,primer_req,surface_prep,note
//     product_id / substrate_id 可写 id 或 slug（自动解析；基材 slug 见 migrations/0002_domain.sql 种子）
//   - JSON 形式：数组，或 { "products": [...], "compatibility": [...] }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB_NAME = process.env.D1_DB_NAME || 'tackix-content';
const PERSIST = '.wrangler';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };

const LOCAL = has('--local');
const SQL_ONLY = has('--sql-only');

// 与 0002_domain.sql 种子保持一致：基材 slug → id（供 compatibility.csv 便捷解析）
const SUBSTRATE_BY_SLUG = {
  'aluminum': 'SUB-ALU', 'steel': 'SUB-STEEL', 'stainless-steel': 'SUB-SS',
  'abs': 'SUB-ABS', 'pp': 'SUB-PP', 'pe': 'SUB-PE', 'pvc': 'SUB-PVC', 'pc': 'SUB-PC',
  'wood': 'SUB-WOOD', 'glass': 'SUB-GLASS', 'ceramic': 'SUB-CERAMIC',
  'concrete': 'SUB-CONCRETE', 'composite': 'SUB-COMPOSITE', 'rubber': 'SUB-RUBBER',
};

const PRODUCT_COLS_CSV = [
  'id', 'slug', 'brand', 'name_zh', 'name_en', 'category', 'chemistry', 'cure_type', 'color',
  'viscosity', 'tensile_str', 'elongation', 'temp_min', 'temp_max', 'shore', 'mix_ratio',
  'pot_life_min', 'cure_time_min', 'shelf_life', 'features',
];

const NUMERIC = new Set(['viscosity', 'tensile_str', 'elongation', 'temp_min', 'temp_max', 'pot_life_min', 'cure_time_min', 'suitability', 'primer_req']);

function sqlStr(v) {
  if (v === undefined || v === null || v === '') return 'NULL';
  return "'" + String(v).replace(/'/g, "''") + "'";
}
function sqlNum(v) {
  if (v === undefined || v === null || v === '') return 'NULL';
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : 'NULL';
}
function nowMs() { return Date.now(); }

// —— 极简 CSV 解析（RFC4180：引号包裹、字段内逗号/换行、"" 转义）——
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip CR */ }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ''));
}

function toObjects(rows) {
  if (!rows.length) return [];
  const header = rows[0].map((h) => String(h).trim());
  return rows.slice(1).map((r) => {
    const o = {};
    header.forEach((h, i) => { o[h] = (r[i] ?? '').trim(); });
    return o;
  });
}

function readFileObjects(file, key) {
  const raw = fs.readFileSync(file, 'utf8');
  const ext = path.extname(file).toLowerCase();
  if (ext === '.json') {
    const j = JSON.parse(raw);
    if (Array.isArray(j)) return j;
    return Array.isArray(j[key]) ? j[key] : [];
  }
  return toObjects(parseCsv(raw));
}

function normalizeProduct(o) {
  const name_zh = (o.name_zh || '').trim();
  if (!name_zh) throw new Error(`产品行缺 name_zh：${JSON.stringify(o)}`);
  let slug = (o.slug || '').trim();
  if (!slug) {
    const base = (o.name_en || name_zh).toString().toLowerCase();
    slug = base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `p-${nowMs()}`;
  }
  const id = (o.id || `P-${slug.toUpperCase()}`).trim();
  const ts = nowMs();
  return { ...o, id, slug, name_zh, created_at: ts, updated_at: ts };
}

function productInsert(o) {
  const cols = [
    'id', 'slug', 'brand', 'name_zh', 'name_en', 'category', 'chemistry', 'cure_type', 'color',
    'viscosity', 'tensile_str', 'elongation', 'temp_min', 'temp_max', 'shore', 'mix_ratio',
    'pot_life_min', 'cure_time_min', 'shelf_life', 'features', 'attrs', 'published', 'created_at', 'updated_at',
  ];
  const vals = cols.map((c) => {
    if (c === 'created_at' || c === 'updated_at') return String(o[c] || nowMs());
    if (c === 'published') return o.published === undefined || o.published === '' ? '1' : (o.published ? '1' : '0');
    if (c === 'attrs') return o.attrs ? sqlStr(typeof o.attrs === 'string' ? o.attrs : JSON.stringify(o.attrs)) : 'NULL';
    if (c === 'features') return o.features ? sqlStr(typeof o.features === 'string' ? o.features : JSON.stringify(o.features)) : 'NULL';
    if (NUMERIC.has(c)) return sqlNum(o[c]);
    return sqlStr(o[c]);
  });
  return `INSERT OR REPLACE INTO products (${cols.join(', ')}) VALUES (${vals.join(', ')});`;
}

function compatInsert(o, prodBySlug, prodById) {
  const pidRaw = String(o.product_id || '').trim();
  const sidRaw = String(o.substrate_id || '').trim();
  const pid = prodBySlug[pidRaw] || prodById[pidRaw] || pidRaw;
  const sid = SUBSTRATE_BY_SLUG[sidRaw] || sidRaw;
  const suit = Number(o.suitability);
  if (!pid || !sid || !Number.isFinite(suit)) {
    throw new Error(`兼容行参数非法（需 product_id/substrate_id/suitability）：${JSON.stringify(o)}`);
  }
  const cid = `${pid}__${sid}`;
  const primer = o.primer_req === true || String(o.primer_req).toLowerCase() === 'true' || Number(o.primer_req) === 1 ? 1 : 0;
  return `INSERT OR REPLACE INTO compatibility (id, product_id, substrate_id, suitability, primer_req, surface_prep, note) VALUES (${sqlStr(cid)}, ${sqlStr(pid)}, ${sqlStr(sid)}, ${suit}, ${primer}, ${sqlStr(o.surface_prep)}, ${sqlStr(o.note)});`;
}

function spawnWrangler(a) {
  execFileSync('npx', ['wrangler', ...a], { stdio: 'inherit' });
}

function writeTemplate(p) {
  const header = PRODUCT_COLS_CSV.join(',');
  const sample = 'P-0001,epoxy-structural-1,Acme,环氧结构胶,Epoxy Structural 1,structural,epoxy,2-part,灰色,45000,25,3,-40,120,D80,1:1,5,1440,12m,"[""high-strength"",""metal""]"';
  fs.mkdirSync(path.dirname(path.resolve(p)), { recursive: true });
  fs.writeFileSync(p, header + '\n' + sample + '\n');
  console.log(`[import] 已生成 CSV 模板：${path.resolve(p)}`);
}

function main() {
  const templatePath = val('--template');
  if (templatePath) { writeTemplate(templatePath); return; }

  const file = val('--file');
  if (!file) {
    console.error('[import] 缺少 --file（products.csv / products.json）。可用 --template <path> 生成模板。');
    process.exit(1);
  }
  const absFile = path.resolve(file);
  if (!fs.existsSync(absFile)) { console.error(`[import] 文件不存在：${absFile}`); process.exit(1); }

  const isJson = path.extname(absFile).toLowerCase() === '.json';
  const mainJson = isJson ? JSON.parse(fs.readFileSync(absFile, 'utf8')) : null;
  const productRows = mainJson
    ? (Array.isArray(mainJson) ? mainJson : (mainJson.products || []))
    : readFileObjects(absFile, 'products');
  const products = productRows.map(normalizeProduct);
  if (!products.length) { console.error('[import] 未解析到任何产品行'); process.exit(1); }

  const prodBySlug = {};
  const prodById = {};
  products.forEach((p) => { prodBySlug[p.slug] = p.id; prodById[p.id] = p.id; });

  let sql = '';
  products.forEach((p) => { sql += productInsert(p) + '\n'; });

  let compatCount = 0;
  let compatRows = null;
  const compatFile = val('--compat');
  if (compatFile) {
    const absCompat = path.resolve(compatFile);
    if (!fs.existsSync(absCompat)) { console.error(`[import] compatibility 文件不存在：${absCompat}`); process.exit(1); }
    compatRows = readFileObjects(absCompat, 'compatibility');
  } else if (mainJson && !Array.isArray(mainJson) && Array.isArray(mainJson.compatibility)) {
    // 同一 JSON 内同时提供 products 与 compatibility（--compat 可覆盖）
    compatRows = mainJson.compatibility;
  }
  if (compatRows) {
    compatRows.forEach((o) => { sql += compatInsert(o, prodBySlug, prodById) + '\n'; compatCount++; });
  }

  const sqlPath = path.join(ROOT, 'scripts', '.import.sql');
  fs.writeFileSync(sqlPath, sql);
  console.log(`[import] products ${products.length} 条，compatibility ${compatCount} 条 → ${LOCAL ? '本地（--local）' : '线上（--remote）'}`);

  if (SQL_ONLY) {
    const out = path.join(ROOT, 'scripts', 'import.sql');
    fs.copyFileSync(sqlPath, out);
    fs.unlinkSync(sqlPath);
    console.log(`[import] --sql-only：已生成 ${out}（未执行）`);
    return;
  }

  const d1args = ['d1', 'execute', DB_NAME, '--file', sqlPath];
  if (LOCAL) d1args.push('--local', '--persist-to', PERSIST);
  else d1args.push('--remote');
  try {
    spawnWrangler(d1args);
    console.log(`[import] ✅ 导入完成（products ${products.length} / compatibility ${compatCount}）`);
  } catch (e) {
    console.error(`[import] ❌ 导入失败：${e.message}`);
    console.error('请确认：1) 已建库 tackix-content；2) 已 apply migrations（含 0002_domain.sql）；3) 本地用 --local 或线上已配置 CLOUDFLARE_API_TOKEN');
    process.exit(1);
  } finally {
    if (fs.existsSync(sqlPath)) fs.unlinkSync(sqlPath);
  }
}

main();
