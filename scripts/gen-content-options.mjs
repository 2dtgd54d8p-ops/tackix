// 从后台 singleton（仓库根目录 categories/index.yaml、tags/index.yaml）生成
// 文章编辑器下拉所需的**静态选项**模块 src/generated/content-options.ts。
//
// 为什么需要它：内容后台的「分类 / 标签」下拉选项需要从仓库根目录的
// categories/index.yaml、tags/index.yaml（单例）读取，而构建期把这些词表
// 预生成为一个纯数据模块，供校验脚本与编辑器复用，避免散落硬编码。
//
// 效果：在后台「分类管理 / 标签管理」增删条目后，dev 热重启或下次 build 即
// 自动同步，无需手改硬编码数组。
//
// 生成时机：predev / prebuild，以及 dev 期间分类/标签文件变化触发的重启。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEST = path.join(ROOT, 'src/generated/content-options.ts');

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

/** 读取某个 singleton 的 items，返回 [{label,value}]，只保留 label+value 都非空的项 */
export function readSingletonItems(relPath) {
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
    .map((x) => ({ label: optionLabel(x.label), value: x.value.trim() }));
}

/**
 * 读取 scenarios 集合（src/content/scenarios/*.yaml），返回 [{label,value}] 用于文章
 * 「所属场景」下拉。value 取 YAML 的 title（即场景 slug），label 取双语 name（英文优先，
 * 回落中文，与 CATEGORY_OPTIONS / TAG_OPTIONS 的显示规则一致）。
 */
export function readScenarioItems() {
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
    if (value && label) out.push({ label, value });
  }
  return out;
}

export function generateContentOptions() {
  const categories = readSingletonItems('categories/index.yaml');
  const tags = readSingletonItems('tags/index.yaml');
  const scenarios = readScenarioItems();

  const out = `// ⚠️ 本文件由 scripts/gen-content-options.mjs 自动生成，请勿手动编辑。
// 数据来源：仓库根目录 categories/index.yaml（后台「分类管理」）、
//          tags/index.yaml（后台「标签管理」）；
//          src/content/scenarios/*.yaml（场景方案集合，提供「所属场景」下拉）。
// 生成时机：postinstall / predev / prebuild，以及 dev 期间这些文件变化触发的重启。
// 作用：文章编辑器的「分类」「标签」下拉与「所属场景」下拉跟随后台数据，无需手改代码。
export const CATEGORY_OPTIONS: ReadonlyArray<{ label: string; value: string }> = ${JSON.stringify(
    categories,
    null,
    2
  )};

export const TAG_OPTIONS: ReadonlyArray<{ label: string; value: string }> = ${JSON.stringify(
    tags,
    null,
    2
  )};

export const SCENARIO_OPTIONS: ReadonlyArray<{ label: string; value: string }> = ${JSON.stringify(
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
