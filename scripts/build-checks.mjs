// 构建期内容校验（L4③）：在 astro build 之前跑，阻断「数据完整性」类错误。
//
// 设计原则：
//   ERROR（退出码 1，阻断构建）→ 会真正破坏页面/链接的硬伤：
//     · 双语标题(name)或一句话结论(excerpt) 任一语言缺失
//     · 分类(category) 为「未分类」或不在词表 → 文章会进「未分类」黑洞或筛选失效
//     · 标签(tags) 含不在词表的非法值 → 写入脏数据、相关推荐失真
//     · 场景(scenario) 引用了不存在的场景 slug → 场景页不会出现该文（即用户的“引用不存在的 slug 直接 fail”）
//   WARNING（仅提示，不阻断）→ 内容完整度建议项：
//     · FAQ < 3 条 / 步骤 < 1 条 / 标签 < 2 个 / 缺发布日期(影响新鲜度)
//
// 复用 scripts/gen-content-options.mjs 的词表读取函数，保证校验口径与编辑器下拉一致。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { readSingletonItems, readScenarioItems } from './gen-content-options.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KNOWLEDGE_DIR = path.join(ROOT, 'src/content/knowledge');

function main() {
  const categories = readSingletonItems('categories/index.yaml').map((x) => x.value);
  const tags = readSingletonItems('tags/index.yaml').map((x) => x.value);
  const scenarios = readScenarioItems().map((x) => x.value);
  const catSet = new Set(categories);
  const tagSet = new Set(tags);
  const scenSet = new Set(scenarios);

  const catLabel = new Map(readSingletonItems('categories/index.yaml').map((x) => [x.value, x.label]));
  const scenLabel = new Map(readScenarioItems().map((x) => [x.value, x.label]));

  const errors = [];
  const warnings = [];

  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    console.log('[build-checks] 未找到 src/content/knowledge，跳过校验。');
    return 0;
  }
  const files = fs
    .readdirSync(KNOWLEDGE_DIR)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
  let checked = 0;

  for (const f of files) {
    const slug = f.replace(/\.(ya?ml)$/, '');
    let data;
    try {
      data = yaml.load(fs.readFileSync(path.join(KNOWLEDGE_DIR, f), 'utf8'));
    } catch (e) {
      errors.push(`[${slug}] YAML 解析失败：${e.message}`);
      continue;
    }
    if (!data) continue;
    checked++;

    const name = data.name || {};
    const excerpt = data.excerpt || {};
    const nameZh = typeof name.zh === 'string' ? name.zh.trim() : '';
    const nameEn = typeof name.en === 'string' ? name.en.trim() : '';
    const exZh = typeof excerpt.zh === 'string' ? excerpt.zh.trim() : '';
    const exEn = typeof excerpt.en === 'string' ? excerpt.en.trim() : '';

    if (!nameZh || !nameEn) errors.push(`[${slug}] 双语标题缺失（zh=${nameZh ? '✓' : '✗'} en=${nameEn ? '✓' : '✗'}）`);
    if (!exZh || !exEn) errors.push(`[${slug}] 一句话结论缺失（zh=${exZh ? '✓' : '✗'} en=${exEn ? '✓' : '✗'}）`);

    const category = typeof data.category === 'string' ? data.category : 'uncategorized';
    if (category === 'uncategorized') {
      errors.push(`[${slug}] 分类为「未分类」——文章将无法被有效归类/检索`);
    } else if (!catSet.has(category)) {
      errors.push(`[${slug}] 分类「${category}」不在词表中（合法值：${categories.join(', ') || '（空）'}）`);
    }

    const tagList = Array.isArray(data.tags) ? data.tags.map(String) : [];
    for (const t of tagList) {
      if (!tagSet.has(t)) errors.push(`[${slug}] 标签「${t}」不在词表中`);
    }
    if (tagList.length < 2) warnings.push(`[${slug}] 标签仅 ${tagList.length} 个（建议 ≥2，利于相关推荐）`);

    const scenario = typeof data.scenario === 'string' ? data.scenario : 'none';
    if (scenario !== 'none' && !scenSet.has(scenario)) {
      errors.push(
        `[${slug}] 场景引用「${scenario}」不存在于场景方案集合（合法值：${scenarios.join(', ') || '（空）'}）`
      );
    }

    const faq = Array.isArray(data.faq) ? data.faq : [];
    if (faq.length < 3) warnings.push(`[${slug}] FAQ 仅 ${faq.length} 条（建议 ≥3，利于 AI/搜索抽取）`);
    const steps = Array.isArray(data.steps) ? data.steps : [];
    if (steps.length < 1) warnings.push(`[${slug}] 无结构化步骤（建议 ≥1，生成 HowTo 富媒体）`);

    if (!data.publishedAt) warnings.push(`[${slug}] 缺发布日期（新鲜度徽章会显示“未标注日期”）`);
  }

  console.log(`\n[build-checks] 扫描 ${checked} 篇文章；词表：分类 ${categories.length} / 标签 ${tags.length} / 场景 ${scenarios.length}`);
  if (warnings.length) {
    console.log(`\n⚠️  WARNING（${warnings.length}）：`);
    for (const w of warnings) console.log('   · ' + w);
  }
  if (errors.length) {
    console.log(`\n❌  ERROR（${errors.length}）—— 阻断构建：`);
    for (const e of errors) console.log('   · ' + e);
    console.log('\n请修复上述 ERROR 后再构建；WARNING 不阻断。');
    return 1;
  }
  console.log('\n✅  校验通过：无数据完整性错误。\n');
  return 0;
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  process.exit(main());
}

export { main };
