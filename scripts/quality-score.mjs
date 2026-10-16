#!/usr/bin/env node
/**
 * scripts/quality-score.mjs — 构建期内容质量评分（纯静态，无后端）
 * --------------------------------------------------------------
 * 对 knowledge 集合每篇文章打分，校验是否达到"数据精准性 / SEO / AI 友好"基线：
 *   展示标题(中英)15 + 摘要/结论(中英)15 + 归入场景15 + 归类10 + 标签≥2 10
 *   + FAQ≥3 15 + 结构化步骤10 + 新鲜度(≤180天)10 = 100
 * 输出：reports/quality-report.json（供编辑/CI 读取）+ 控制台摘要。
 * 始终 exit 0（仅报告，不阻断构建）。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KNOWLEDGE_DIR = join(ROOT, 'src/content/knowledge');
const SCENARIOS_DIR = join(ROOT, 'src/content/scenarios');
const CATEGORIES_FILE = join(ROOT, 'categories/index.yaml');
const TAGS_FILE = join(ROOT, 'tags/index.yaml');
const THRESH_DAYS = 180;

function loadItems(path) {
  if (!existsSync(path)) return [];
  try {
    const d = load(readFileSync(path, 'utf8'));
    return (d?.items ?? []).map((it) => ({
      value: it.value,
      label: typeof it.label === 'string' ? it.label : it.label?.zh ?? it.value,
    }));
  } catch {
    return [];
  }
}
function loadScenarios() {
  if (!existsSync(SCENARIOS_DIR)) return [];
  return readdirSync(SCENARIOS_DIR)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .map((f) => {
      try {
        const d = load(readFileSync(join(SCENARIOS_DIR, f), 'utf8'));
        return { value: d?.title ?? f.replace(/\.ya?ml$/, ''), label: d?.name?.zh ?? d?.title ?? f };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}
const b = (x) =>
  typeof x === 'object' && x
    ? { zh: x.zh || '', en: x.en || '' }
    : { zh: typeof x === 'string' ? x : '', en: '' };

loadScenarios();
loadItems(CATEGORIES_FILE);
loadItems(TAGS_FILE);

const now = Date.now();

function scoreOne(post, slug) {
  const name = b(post.name);
  const excerpt = b(post.excerpt);
  const issues = [];
  let s = 0;
  if (name.zh && name.en) s += 15;
  else {
    if (!name.zh) issues.push('缺中文展示标题');
    if (!name.en) issues.push('缺英文展示标题');
  }
  if (excerpt.zh && excerpt.en) s += 15;
  else {
    if (!excerpt.zh) issues.push('缺中文摘要/结论');
    if (!excerpt.en) issues.push('缺英文摘要/结论');
  }
  if (post.scenario && post.scenario !== 'none') s += 15;
  else issues.push('未归入场景(none)');
  if (post.category && post.category !== 'uncategorized') s += 10;
  else issues.push('未归类(uncategorized)');
  const tagN = (post.tags || []).length;
  if (tagN >= 2) s += 10;
  else issues.push(`标签不足(${tagN}<2)`);
  const faqN = (post.faq || []).filter((f) => f && f.question && f.answer).length;
  if (faqN >= 3) s += 15;
  else issues.push(`FAQ不足(${faqN}<3)`);
  const stepN = (post.steps || []).length;
  if (stepN >= 1) s += 10;
  else issues.push('无结构化步骤');
  let fresh = '—';
  if (post.publishedAt) {
    const d = (now - new Date(post.publishedAt).getTime()) / 86400000;
    fresh = Math.round(d);
    if (d <= THRESH_DAYS) s += 10;
    else issues.push(`内容过期(${fresh}天)`);
  } else issues.push('缺发布日期');
  const grade = s >= 90 ? 'A' : s >= 75 ? 'B' : s >= 60 ? 'C' : 'D';
  return { slug, score: s, grade, fresh, tags: tagN, faq: faqN, steps: stepN, issues };
}

const files = existsSync(KNOWLEDGE_DIR)
  ? readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
  : [];
const rows = files.map((f) => {
  const slug = f.replace(/\.ya?ml$/, '');
  try {
    const post = load(readFileSync(join(KNOWLEDGE_DIR, f), 'utf8'));
    return scoreOne(post, slug);
  } catch (e) {
    return { slug, score: 0, grade: 'D', fresh: '—', tags: 0, faq: 0, steps: 0, issues: ['解析失败:' + e.message] };
  }
});
rows.sort((a, b) => a.score - b.score);

const avg = rows.length ? Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length) : 0;
const below = rows.filter((r) => r.score < 60).length;
const stale = rows.filter((r) => r.issues.some((i) => i.startsWith('内容过期'))).length;

const report = {
  generatedAt: new Date().toISOString(),
  thresholdDays: THRESH_DAYS,
  avgScore: avg,
  belowThreshold: below,
  stale,
  total: rows.length,
  articles: rows,
};
try {
  mkdirSync(join(ROOT, 'reports'), { recursive: true });
  writeFileSync(join(ROOT, 'reports', 'quality-report.json'), JSON.stringify(report, null, 2));
} catch (e) {
  console.warn('[warn] 写入报告失败', e.message);
}

console.log('\n==== 内容质量报告 (L4) ====');
console.log(`文章数 ${rows.length} | 平均分 ${avg} | 低于60分 ${below} | 过期 ${stale}`);
console.log('slug'.padEnd(32), '分 级  问题');
rows.forEach((r) => {
  console.log(String(r.slug).padEnd(32), String(r.score).padEnd(3), r.grade, r.issues.slice(0, 3).join('; '));
});
console.log('报告已写入 reports/quality-report.json\n');
process.exit(0);
