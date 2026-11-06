// AI 问答（L6 AI 原生）—— 基于 Vectorize + Workers AI 的 RAG
// 以 Astro API Route 实现，由 @astrojs/cloudflare 适配器并入 dist/_worker.js。
//
// 本路径固定走「运行时 REST 兜底」：env.CF_API_TOKEN（secret_text 环境变量，与 ADMIN_PASSWORD 同级）。
// 原因：本项目锁定 @astrojs/cloudflare v12（wrangler 3.114），其 pages deploy 暂不支持把
// vectorize/ai 绑定写进 Pages deployment_config；wrangler.toml 里的 [[vectorize]]/[ai] 声明在线上被清空，
// env.VECTORIZE / env.AI 即便存在也是不可用桩对象，故不依赖函数绑定，统一用 REST 直连 Cloudflare API。
//
// 知识库向量由 scripts/embed.mjs 灌入 Vectorize index（tackix-kb）。
export const prerender = false;

import type { APIRoute } from 'astro';

interface AskEnv {
  CF_API_TOKEN?: string;
}

const EMBED_MODEL = '@cf/baai/bge-base-en-v1.5';
// 生成模型：qwen3-30b-a3b-fp8（MoE，3B 激活）——中文强、neuron 成本低（输出约 70B 的 1/6.7），
// 免费额度下可用量约为 70B 的 5~7 倍，适合当前不升级付费计划的场景。
const GEN_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';
const INDEX_NAME = 'tackix-kb';
// 相关性阈值：命中分数低于此值视为资料无关，直接回退"不知道"，避免模型用无关内容硬凑。
// 实测正常命中 0.79~0.88，明显离题的查询（如"天气"对胶粘剂库）通常在 0.5 以下。
const SCORE_THRESHOLD = 0.5;
// 检索片段合并参数：embed.mjs 把 name / title / excerpt / body 各自切成独立向量，
// 同一篇文档常同时命中多条。旧逻辑按 slug 去重只留首条，若首条恰是极短的 title 切片，
// context 近乎为空 → 模型误判「资料里没有具体信息」（英文问高发）。
const RETRIEVAL_TOP_K = 10;
const MIN_BLOCK_LEN = 40; // 短于此视为标题 / slug 类无信息切片
const MAX_BLOCKS_PER_DOC = 3;
const MAX_CONTEXT_LEN = 2800; // 控制输入规模，避免推高 Workers AI neuron 消耗
// 账号 ID 非敏感，硬编码；运行时仅需 CF_API_TOKEN 环境变量（含 Workers AI + Vectorize 权限）。
const ACCOUNT_ID = 'b4f68b37b18c0891a0df46f3bf4d07f1';
const CF_API = `https://api.cloudflare.com/client/v4/accounts`;

async function restEmbed(text: string, acct: string, token: string): Promise<number[]> {
  const r = await fetch(`${CF_API}/${acct}/ai/run/${EMBED_MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const j = await r.json();
  if (!j.success) throw new Error('embed failed: ' + JSON.stringify(j.errors || j));
  return (j.result?.data?.[0]) as number[];
}
async function restQuery(
  vector: number[],
  acct: string,
  token: string
): Promise<Array<{ score?: number; metadata?: any }>> {
  const r = await fetch(`${CF_API}/${acct}/vectorize/v2/indexes/${INDEX_NAME}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ vector, topK: RETRIEVAL_TOP_K, returnMetadata: 'all' }),
  });
  const j = await r.json();
  if (!j.success) throw new Error('query failed: ' + JSON.stringify(j.errors || j));
  return (j.result?.matches || []) as Array<{ score?: number; metadata?: any }>;
}
async function restGenerate(
  system: string,
  user: string,
  acct: string,
  token: string
): Promise<string> {
  const r = await fetch(`${CF_API}/${acct}/ai/run/${GEN_MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    // ⚠️ 必须用 messages（system + user），不能用单串 prompt：
    // qwen3 的 chat template 会把整段「资料/问题/要求」当成多轮对话历史，
    // 模型会不断续写 "Assistant:"、"A: B:" 问答列表与「按您的指示」等自我说明。
    // 实测 messages 格式输出干净，且 response / choices[0].message.content 均为最终答案
    // （思考链单独放在 reasoning_content，不取）。
    body: JSON.stringify({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0,
      max_tokens: 800,
      repetition_penalty: 1.15,
    }),
  });
  const j = await r.json();
  if (!j.success) throw new Error('gen failed: ' + JSON.stringify(j.errors || j));
  return (
    j.result?.response ||
    j.result?.choices?.[0]?.message?.content ||
    j.result?.text ||
    j.result?.choices?.[0]?.text ||
    ''
  );
}

function slugOf(m: any): string {
  return m?.metadata?.slug || m?.metadata?.id || m?.metadata?.key || '';
}
function textOf(m: any): string {
  return m?.metadata?.text || m?.metadata?.content || '';
}

// 清理检索到的资料文本（仅生成端，不影响嵌入）：去 markdown 标题、对齐标签、
// 以及"问题：X / 答案："这类问答提示词——它们会把 qwen3 带偏成无限 Q&A 续写。
function cleanText(t: string): string {
  if (!t) return t;
  return t
    .split('\n')
    .filter((line) => {
      const s = line.trim();
      if (/^#+\s/.test(s)) return false;
      if (/^中英文对齐/.test(s)) return false;
      if (/^(问题|问|Q)\s*[:：]/i.test(s)) return false;
      return true;
    })
    .join('\n')
    .replace(/^答案\s*[:：]\s*/gm, '') // 只去前缀，保留答案正文
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

// 清理模型输出：去角色标签/引导语、Markdown 标题与加粗、续写出的问答列表，
// 以及模型自加的「按您的指示 / 模拟示例 / 最终版本」等元注释；无关时收敛为规范回退语。
// 主防线是 restGenerate 的 messages 格式，这里是模型偶尔退化时的兜底。
function cleanAnswer(raw: string, lang: 'zh' | 'en' = 'zh'): string {
  const noInfo = lang === 'en' ? 'No related information in the knowledge base.' : '资料中没有相关信息。';
  if (!raw) return raw;
  let s = raw.replace(/<think[\s\S]*?<\/think>/gi, '').replace(/^[\s\S]*?<\/think>/i, '');
  // 角色/引导前缀（qwen3 单串 prompt 模式下会带 "Assistant:"）
  s = s.replace(/^[\s\*\n]*(Assistant|回答|答案|Answer|Response)\s*[:：]\s*/i, '');
  s = s.replace(/^[\s\n]*[？?]+\s*/, '');
  // 无关收敛：覆盖模型各种"无法回答"措辞。
  if (
    /资料中没有相关信息|资料不足|没有.*相关.*内容|无法回答|资料中无相关|无相关信息|未涉及.*(信息|内容)|资料中未|未能找到|info is limited|no related information|not mentioned in the (provided|given)|provided (materials|information|context) (do not|does not)|does not contain specific|do not include specific/i.test(
      s
    )
  ) {
    return noInfo;
  }
  // 模型续写多个 assistant turn 时，只保留第一个。
  const secondAssistant = s.search(/\n\s*Assistant\s*[:：]/i);
  if (secondAssistant > 0) s = s.slice(0, secondAssistant);
  // 删除元注释行（自我对话 / 模拟示例 / 版本说明 / 免责注）。
  s = s
    .split('\n')
    .filter((line) => !/^#+\s/.test(line.trim()))
    .filter(
      (line) =>
        !/^(但按照|不过根据|但是为了|按照您的|注[:：]|（注意[:：]|（以上答案|（最终版本|（此为模拟|注意[:：]此为模拟|以上答案严格|不过为了|但为了|最终版本)/.test(
          line.trim()
        )
    )
    .filter(
      (line) =>
        !/您的指示|最新指示|模拟示例|最终版本|严格遵循了|为了符合.*限制|呈现的是.*片段|仅提供直接的专业回答/.test(
          line
        )
    )
    .join('\n');
  // 在续写出的新问题 / 选项问答列表（A: / B: / Q:）处截断。
  const cut = s.search(/\n\s*(?:问题|Questions?|Q|[A-Z])\s*[:：]\s*\S/im);
  if (cut > 0) s = s.slice(0, cut);
  // 纯文本展示：去掉 Markdown 加粗，合并多余空行。
  return s.replace(/\*\*/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

// 把检索命中的切片合并成上下文：语言软过滤 → 按 slug 分组 → 组内按信息量降序合并 → 全局限长。
// 修复（2026-11-06）：旧版按 slug 去重会丢掉同文档的 body / excerpt，只剩短 title 时模型答「没资料」。
function buildContext(
  matches: Array<{ score?: number; metadata?: any }>,
  lang: 'zh' | 'en'
): { context: string; sources: string[] } {
  const items = matches
    .map((m) => ({
      slug: slugOf(m),
      text: cleanText(textOf(m)),
      lang: String(m?.metadata?.lang || ''),
    }))
    .filter((x) => Boolean(x.slug && x.text));
  // 语言软过滤：优先同语言切片；整批都没有同语言时不过滤，避免开天窗。
  const sameLang = items.filter((x) => x.lang === lang);
  const pool = sameLang.length ? sameLang : items;
  // matches 已按 score 降序，按首次出现顺序分组即保持相关性顺序。
  const groups = new Map<string, typeof items>();
  for (const x of pool) {
    const g = groups.get(x.slug);
    if (g) g.push(x);
    else groups.set(x.slug, [x]);
  }
  const sources: string[] = [];
  const blocks: string[] = [];
  let total = 0;
  for (const [slug, list] of groups) {
    // 组内按信息量降序；短切片仅在该文档没有任何长切片时才兜底保留。
    const long = list.filter((x) => x.text.length >= MIN_BLOCK_LEN);
    const ranked = (long.length ? long : list)
      .slice()
      .sort((a, b) => b.text.length - a.text.length)
      .slice(0, MAX_BLOCKS_PER_DOC);
    const seen = new Set<string>();
    const picked: string[] = [];
    for (const x of ranked) {
      const key = x.text.slice(0, 120); // 简单去重（excerpt / body 可能重合）
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(x.text);
    }
    const merged = picked.join('\n');
    if (!merged) continue;
    const room = MAX_CONTEXT_LEN - total;
    if (room < 80) break;
    blocks.push(merged.length > room ? merged.slice(0, room) : merged);
    sources.push(slug);
    total += Math.min(merged.length, room);
    if (total >= MAX_CONTEXT_LEN) break;
  }
  return { context: blocks.join('\n\n'), sources };
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env as AskEnv | undefined;
  try {
    const body: any = await request.json();
    const question = String(body?.question || '').trim();
    if (!question) {
      return new Response(JSON.stringify({ answer: '请输入问题。' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    // 寒暄/无意义输入：直接给出引导，避免模型拿无关资料硬凑答案。
    const qlang0 = detectLang(question);
    if (/^(你好|您好|hi|hello|hey|在吗|在么|你是谁|who are you|早上好|晚上好|谢谢|thanks|thank you|thank u)[\s!！。.~,，]*$/i.test(question)) {
      const greet =
        qlang0 === 'en'
          ? 'Hi! I am the adhesive selection assistant. Tell me your question, e.g. bathroom mould-resistant sealant, window-frame leak repair, or application tips.'
          : '您好，我是胶粘剂选型助手。请描述您的具体问题，例如：浴室防霉胶怎么选、窗框渗水怎么修复、施工注意事项等。';
      return new Response(JSON.stringify({ answer: greet, sources: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    const token = env?.CF_API_TOKEN;
    if (!token) {
      return new Response(
        JSON.stringify({ answer: 'AI 问答需部署后端（Workers AI + Vectorize）后启用。' }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    const qlang = detectLang(question);
    const vec = await restEmbed(question, ACCOUNT_ID, token);
    const matches = await restQuery(vec, ACCOUNT_ID, token);
    const topScore = matches[0]?.score ?? 0;
    // 相关性不足：直接回退，不交给模型硬凑答案。
    if (!matches.length || topScore < SCORE_THRESHOLD) {
      const fallback =
        qlang === 'en'
          ? 'No directly relevant content in our knowledge base. Leave your requirements and a technical advisor will follow up.'
          : '资料库中没有与您问题直接相关的内容。如需选型或施工建议，可留下需求，由技术顾问跟进。';
      return new Response(JSON.stringify({ answer: fallback, sources: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    const { context, sources } = buildContext(matches, qlang);
    const { system, user } = buildMessages(question, context);
    const raw = await restGenerate(system, user, ACCOUNT_ID, token);
    const answer = cleanAnswer(raw, qlang);
    return new Response(JSON.stringify({ answer, sources }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ answer: 'AI 问答服务暂时不可用，请稍后再试。' }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  }
};

function detectLang(q: string): 'zh' | 'en' {
  return /[一-鿿]/.test(q) ? 'zh' : 'en';
}

// 拆成 system / user 两条 messages（qwen3 chat template 要求）。
// 单串 prompt 会让模型把「资料/问题/要求」当成多轮对话历史并无限续写，
// 故不再拼接整段、也不再用 /no_think 前缀（思考链由 reasoning_content 单独返回）。
function buildMessages(question: string, context: string): { system: string; user: string } {
  const lang = detectLang(question);
  const langRule =
    lang === 'zh'
      ? '必须用简体中文回答。'
      : 'You must answer in English. Never invent standards, certification codes or regulation numbers (GB/T, ASTM, JIS, ISO, EN, DIN and any numeric codes) unless they appear verbatim in the provided context.';
  const system =
    '你是工业胶粘剂技术助手，为客户解答选型 / 施工 / 防水问题。请依据用户提供的资料回答问题。\n' +
    '要求：\n' +
    '1. 直接给出 1-3 段专业、具体的回答，充分使用资料里的关键要点（产品类型、等级、步骤、注意事项），不要泛泛而谈。严禁编造资料里没有的信息，尤其禁止凭空写出任何标准号、认证编号、法规名称或检测代号（如 GB/T、GB、ASTM、JIS、ISO、EN、DIN 及随附数字编号）——除非资料原文明确写有该编号，否则一律不要出现。\n' +
    '2. 只输出答案本身：不要输出 Markdown 标题，不要输出 "Assistant:" 等角色标签，不要复述或续写资料里的问答列表，不要自行提出新问题，不要写「注」「说明」「模拟示例」等元注释，不要重复重写同一答案。\n' +
    `3. ${langRule}\n` +
    '4. 只有当资料与问题确实完全无关时，才输出固定回退语，不要解释原因、不要复述问题：中文用「资料中没有相关信息。」，英文用 "No related information in the knowledge base."。';
  // 标签也要跟问题语言一致：写死中文「资料：」会被 qwen3 照抄进英文答案。
  const user =
    lang === 'en'
      ? 'Context:\n' + (context || '(no relevant material)') + '\n\nQuestion: ' + question
      : '资料：\n' + (context || '（无相关素材）') + '\n\n问题：' + question;
  return { system, user };
}
