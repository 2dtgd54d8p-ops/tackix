// 生成文章编辑器下拉所需的**静态选项**模块 src/generated/content-options.ts。
//
// 数据来源（优先级从高到低）：
//   1. src/generated/content.json —— scripts/fetch-content.mjs 从 D1 拉下来的内容快照，
//      即「后台真正在改的那份数据」。全量 D1 之后分类/标签/场景都在这里，
//      后台新增一个分类，下次 build 就能出现在文章编辑器下拉里。
//   2. 仓库根 categories/index.yaml、tags/index.yaml 与 src/content/scenarios/*.yaml ——
//      历史遗留词表，仅在快照缺失（全新克隆尚未拉取 D1）时兜底。
//
// 生成时机：predev / prebuild，以及 dev 期间上述文件变化触发的重启。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEST = path.join(ROOT, 'src/generated/content-options.ts');
const SNAPSHOT = path.join(ROOT, 'src/generated/content.json');

/** 读取 D1 内容快照；不存在或解析失败返回 null（回落 YAML）。 */
function readSnapshot() {
  try {
    if (!fs.existsSync(SNAPSHOT)) return null;
    return JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  } catch (e) {
    console.warn('[gen-content-options] content.json 读取失败，回落 YAML：' + e.message);
    return null;
  }
}

/** 快照里的 singleton.items → [{label,labelZh,value}] */
function itemsFromSnapshot(snap, key) {
  const items = snap?.singletons?.[key]?.items;
  if (!Array.isArray(items)) return [];
  return items
    .filter((x) => x && typeof x.value === 'string' && x.value.trim() && optionLabel(x.label))
    .map((x) => ({ label: optionLabel(x.label), labelZh: optionLabelZh(x.label), value: x.value.trim() }));
}

/**
 * 从可能是「双语对象 {zh,en}」或「纯字符串」的 label 中取出用于下拉选项的字符串。
 * 文章编辑器的「分类 / 标签」下拉显示英文（与 URL slug 一致），英文缺失时回落中文。
 */
function optionLabel(label) {
  if (!label) return '';
  if (typeof label === 'string') return label.trim();
  if (typeof label === 'object') {
    const en = typeof label.en === 'string' ? label.en.trim() : '';
    const zh = typeof label.zh === 'string' ? label.zh.trim() : '';
    return en || zh;
  }
  return '';
}

/** 中文优先的 label（后台编辑器是中文界面，下拉显示中文更好认；缺失时回落英文）。 */
function optionLabelZh(label) {
  if (!label) return '';
  if (typeof label === 'string') return label.trim();
  if (typeof label === 'object') {
    const zh = typeof label.zh === 'string' ? label.zh.trim() : '';
    const en = typeof label.en === 'string' ? label.en.trim() : '';
    return zh || en;
  }
  return '';
}

/**
 * 读取某个 singleton 的 items，返回 [{label,labelZh,value}]，只保留 label+value 都非空的项。
 * 优先取 D1 内容快照（后台真正在改的数据），快照里没有才回落仓库根 YAML。
 * @param {string} relPath YAML 兜底路径，如 'categories/index.yaml'
 * @param {string} [key] 快照里的 singleton 键，如 'categories'
 */
export function readSingletonItems(relPath, key) {
  const fromSnap = itemsFromSnapshot(readSnapshot(), key);
  if (fromSnap.length) return fromSnap;

  const p = path.join(ROOT, relPath);
  if (!fs.existsSync(p)) return [];
  let data;
  try {
    data = yaml.load(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.warn(`[gen-content-options] 解析 ${relPath} 失败，跳过：${e.message}`);
    return [];
  }
  const items = Array.isArray(data?.items) ? data.items : [];
  return items
    .filter(
      (x) =>
        x &&
        typeof x.value === 'string' &&
        x.value.trim() &&
        optionLabel(x.label)
    )
    .map((x) => ({ label: optionLabel(x.label), labelZh: optionLabelZh(x.label), value: x.value.trim() }));
}

/**
 * 读取场景列表，返回 [{label,labelZh,value}] 用于文章「所属场景」下拉。
 * value 取场景 slug，label 取双语 name（英文优先，供通用消费方），labelZh 为中文优先。
 * 同样优先取 D1 快照，快照缺场景时才回落 src/content/scenarios/*.yaml。
 */
export function readScenarioItems() {
  const snap = readSnapshot();
  const list = Array.isArray(snap?.scenarios) ? snap.scenarios : [];
  const fromSnap = [];
  for (const s of list) {
    const value =
      typeof s?.slug === 'string' && s.slug.trim()
        ? s.slug.trim()
        : typeof s?.data?.title === 'string'
          ? s.data.title.trim()
          : '';
    const label = optionLabel(s?.data?.name);
    if (value && label) fromSnap.push({ label, labelZh: optionLabelZh(s.data.name), value });
  }
  if (fromSnap.length) return fromSnap;

  const dir = path.join(ROOT, 'src/content/scenarios');
  if (!fs.existsSync(dir)) return [];
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
  const out = [];
  for (const f of files) {
    let data;
    try {
      data = yaml.load(fs.readFileSync(path.join(dir, f), 'utf8'));
    } catch (e) {
      console.warn(`[gen-content-options] 解析 scenarios/${f} 失败，跳过：${e.message}`);
      continue;
    }
    if (!data) continue;
    const value = typeof data.title === 'string' ? data.title.trim() : '';
    const label = optionLabel(data.name);
    if (value && label) out.push({ label, labelZh: optionLabelZh(data.name), value });
  }
  return out;
}

export function generateContentOptions() {
  const categories = readSingletonItems('categories/index.yaml', 'categories');
  const tags = readSingletonItems('tags/index.yaml', 'tags');
  const scenarios = readScenarioItems();

  const out = `// ⚠️ 本文件由 scripts/gen-content-options.mjs 自动生成，请勿手动编辑。
// 数据来源（优先）：src/generated/content.json —— 构建期从 Cloudflare D1 拉取的内容快照，
//          即后台「分类管理 / 标签管理 / 场景方案」真正在改的数据；
//          兜底：仓库根 categories/index.yaml、tags/index.yaml、src/content/scenarios/*.yaml（历史词表）。
// 生成时机：postinstall / predev / prebuild，以及 dev 期间这些文件变化触发的重启。
// 作用：文章编辑器的「分类」「标签」「所属场景」下拉跟随后台数据，无需手改代码。
// 字段：label = 英文优先（通用显示）；labelZh = 中文优先（后台编辑器用）；value = 值。
export const CATEGORY_OPTIONS: ReadonlyArray<{ label: string; labelZh: string; value: string }> = ${JSON.stringify(
    categories,
    null,
    2
  )};

export const TAG_OPTIONS: ReadonlyArray<{ label: string; labelZh: string; value: string }> = ${JSON.stringify(
    tags,
    null,
    2
  )};

export const SCENARIO_OPTIONS: ReadonlyArray<{ label: string; labelZh: string; value: string }> = ${JSON.stringify(
    scenarios,
    null,
    2
  )};
`;

  fs.mkdirSync(path.dirname(DEST), { recursive: true });
  const prev = fs.existsSync(DEST) ? fs.readFileSync(DEST, 'utf8') : '';
  if (prev !== out) {
    fs.writeFileSync(DEST, out);
    console.log(
      `[gen-content-options] 已更新 src/generated/content-options.ts（分类 ${categories.length} / 标签 ${tags.length} / 场景 ${scenarios.length}）`
    );
  } else {
    console.log(
      `[gen-content-options] 无变化（分类 ${categories.length} / 标签 ${tags.length} / 场景 ${scenarios.length}）`
    );
  }
  return { categories, tags, scenarios };
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) generateContentOptions();
