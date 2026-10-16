#!/usr/bin/env node
/**
 * scripts/ai-enrich.mjs — knowledge 文章元数据 AI 辅助填充
 * --------------------------------------------------------------
 * 根据文章正文，自动补全：slug / 双语展示标题 / 受控三维度标签
 * （scenario / category / tags）。目标是让撰写者"粘贴正文 → 一键补全 →
 * 人工确认"，实现后端傻瓜式撰写。
 *
 * 设计约束（务必遵守）：
 *   1. 标签严格约束在现有词表内（scenarios/categories/tags），绝不发明新词。
 *   2. 仅补填空字段，绝不覆盖已填值（除非 --apply 且字段为空）。
 *   3. 默认 --dry-run，只打印建议，不写回文件。
 *
 * 用法：
 *   node scripts/ai-enrich.mjs --slug <slug>            # dry-run 单篇
 *   node scripts/ai-enrich.mjs --all                    # dry-run 全部空字段文章
 *   node scripts/ai-enrich.mjs --slug <slug> --apply    # 写回
 *
 * 需要 LLM：设置以下环境变量（OpenAI 兼容 Chat Completions 接口）
 *   AI_ENRICH_API_KEY     必填（不填则仅 slug 走规则生成，其余提示需 LLM）
 *   AI_ENRICH_BASE_URL    可选，默认 https://api.openai.com/v1
 *   AI_ENRICH_MODEL       可选，默认 gpt-4o-mini
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load, dump } from 'js-yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KNOWLEDGE_DIR = join(ROOT, 'src/content/knowledge');
const SCENARIOS_DIR = join(ROOT, 'src/content/scenarios');
const CATEGORIES_FILE = join(ROOT, 'categories/index.yaml');
const TAGS_FILE = join(ROOT, 'tags/index.yaml');

// ---- 解析命令行 ----
const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--apply') args.set('apply', true);
  else if (a === '--all') args.set('all', true);
  else if (a === '--slug') args.set('slug', process.argv[++i]);
  else if (a === '--dry-run') args.set('dry', true);
}
const DRY_RUN = !args.has('apply');

// ---- 加载受控词表 ----
function loadItems(path) {
  if (!existsSync(path)) return [];
  try {
    const d = load(readFileSync(path, 'utf8'));
    return (d?.items ?? []).map((it) => ({
      value: it.value,
      label: typeof it.label === 'string' ? it.label : it.label?.zh ?? it.value,
    }));
  } catch (e) {
    console.warn('[warn] 读词表失败', path, e.message);
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
        return {
          value: d?.title ?? f.replace(/\.ya?ml$/, ''),
          label: d?.name?.zh ?? d?.title ?? f,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

const scenarios = loadScenarios();
const categories = loadItems(CATEGORIES_FILE);
const tags = loadItems(TAGS_FILE);

const llmBase = process.env.AI_ENRICH_BASE_URL || 'https://api.openai.com/v1';
const llmKey = process.env.AI_ENRICH_API_KEY;
const llmModel = process.env.AI_ENRICH_MODEL || 'gpt-4o-mini';
const llmAvailable = !!llmKey;

function slugify(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 64);
}

// ---- 构造提示词（强制从词表选值）----
function buildPrompt(post) {
  const vocab = {
    scenarios: scenarios.map((s) => `${s.value}（${s.label}）`),
    categories: categories.map((c) => `${c.value}（${c.label}）`),
    tags: tags.map((t) => `${t.value}（${t.label}）`),
  };
  const bodyZh = typeof post.body === 'object' ? post.body?.zh : post.body;
  const bodyEn = typeof post.body === 'object' ? post.body?.en : '';
  return `你是一名 B2B 工业胶粘剂技术编辑。根据文章正文补全元数据。
可选场景（只能选一个值或 "none"）：
${vocab.scenarios.join('\n')}
可选分类（只能选一个值）：
${vocab.categories.join('\n')}
可选标签（可多选 2-4 个值）：
${vocab.tags.join('\n')}
要求：
- scenario 必须是上面场景列表中的某个 value，或 "none"
- category 必须是上面分类列表中的某个 value
- tags 必须是上面标签列表中的 value 数组（2-4 个）
- name.zh / name.en 是给人看的双语展示标题（不是地址）
- slug 是英文、URL 友好的字符串
仅输出 JSON，字段：{ "slug": string, "name_zh": string, "name_en": string, "scenario": string, "category": string, "tags": string[] }

正文（中文）：
${bodyZh || '(空)'}
正文（英文）：
${bodyEn || '(空)'}
已有值（若已填请沿用，不要改）：
slug=${post.title || ''} | name.zh=${post.name?.zh || ''} | name.en=${post.name?.en || ''} | scenario=${post.scenario || ''} | category=${post.category || ''} | tags=${JSON.stringify(post.tags || [])}`;
}

async function callLLM(prompt) {
  if (!llmAvailable) return null;
  const res = await fetch(`${llmBase}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${llmKey}` },
    body: JSON.stringify({
      model: llmModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('LLM 未返回 JSON');
  return JSON.parse(m[0]);
}

async function enrich(slug) {
  const file = join(KNOWLEDGE_DIR, `${slug}.yaml`);
  if (!existsSync(file)) {
    console.warn('[skip] 缺少文件', file);
    return;
  }
  const post = load(readFileSync(file, 'utf8'));
  const prompt = buildPrompt(post);
  let sugg;
  if (llmAvailable) {
    sugg = await callLLM(prompt);
  } else {
    // 未配置 key：仅 slug 走规则生成，其余标注需 LLM
    sugg = {
      slug: post.title || slugify(post.name?.zh || post.name?.en || ''),
      name_zh: post.name?.zh || '',
      name_en: post.name?.en || '',
      scenario: post.scenario || '',
      category: post.category || '',
      tags: post.tags || [],
      _note: '未配置 AI_ENRICH_API_KEY，仅 slug 规则生成，其余字段需 LLM',
    };
  }

  // 仅补填空字段
  const patch = {};
  if (!post.title && sugg.slug) patch.title = sugg.slug;
  if (!post.name?.zh && sugg.name_zh) patch.name_zh = sugg.name_zh;
  if (!post.name?.en && sugg.name_en) patch.name_en = sugg.name_en;
  if ((!post.scenario || post.scenario === 'none') && sugg.scenario && sugg.scenario !== 'none')
    patch.scenario = sugg.scenario;
  if ((!post.category || post.category === 'uncategorized') && sugg.category)
    patch.category = sugg.category;
  if ((!post.tags || post.tags.length === 0) && Array.isArray(sugg.tags))
    patch.tags = sugg.tags.slice(0, 4);

  // 词表校验：不在词表内的一律丢弃，杜绝漂移
  if (patch.scenario && patch.scenario !== 'none' && !scenarios.find((s) => s.value === patch.scenario)) {
    console.warn('  ⚠ 场景不在词表，丢弃:', patch.scenario);
    delete patch.scenario;
  }
  if (patch.category && !categories.find((c) => c.value === patch.category)) {
    console.warn('  ⚠ 分类不在词表，丢弃:', patch.category);
    delete patch.category;
  }
  if (patch.tags) patch.tags = patch.tags.filter((t) => tags.find((x) => x.value === t));

  console.log(`\n=== ${slug} ===`);
  if (sugg._note) console.log('备注:', sugg._note);
  console.log('建议补填:', JSON.stringify(patch, null, 2));

  if (DRY_RUN) {
    console.log('（dry-run：未写入文件）');
    return;
  }
  if (Object.keys(patch).length === 0) {
    console.log('无需补填');
    return;
  }
  if (patch.title) post.title = patch.title;
  if (patch.name_zh || patch.name_en) {
    post.name = {
      ...(post.name || {}),
      ...(patch.name_zh ? { zh: patch.name_zh } : {}),
      ...(patch.name_en ? { en: patch.name_en } : {}),
    };
  }
  if (patch.scenario) post.scenario = patch.scenario;
  if (patch.category) post.category = patch.category;
  if (patch.tags) post.tags = patch.tags;
  writeFileSync(file, dump(post, { lineWidth: 120 }), 'utf8');
  console.log('已写入', file);
}

// ---- 入口 ----
const targets = args.has('all')
  ? readdirSync(KNOWLEDGE_DIR)
      .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
      .map((f) => f.replace(/\.ya?ml$/, ''))
  : [args.get('slug')].filter(Boolean);

if (targets.length === 0) {
  console.log('用法: node scripts/ai-enrich.mjs --slug <slug> [--apply] | --all [--apply]');
  process.exit(0);
}
if (!llmAvailable) {
  console.log('[info] 未检测到 AI_ENRICH_API_KEY：slug 将走规则生成，其余字段需配置 LLM 后才会补全。');
}
for (const s of targets) await enrich(s);
