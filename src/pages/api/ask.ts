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
    body: JSON.stringify({ vector, topK: 5, returnMetadata: 'all' }),
  });
  const j = await r.json();
  if (!j.success) throw new Error('query failed: ' + JSON.stringify(j.errors || j));
  return (j.result?.matches || []) as Array<{ score?: number; metadata?: any }>;
}
async function restGenerate(prompt: string, acct: string, token: string): Promise<string> {
  const r = await fetch(`${CF_API}/${acct}/ai/run/${GEN_MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    // temperature=0 保证确定性；repetition_penalty 抑制重复退化。
    body: JSON.stringify({
      prompt,
      temperature: 0,
      max_tokens: 800,
      repetition_penalty: 1.15,
    }),
  });
  const j = await r.json();
  if (!j.success) throw new Error('gen failed: ' + JSON.stringify(j.errors || j));
  return j.result?.response || j.result?.text || j.result?.choices?.[0]?.text || '';
}

function slugOf(m: any): string {
  return m?.metadata?.slug || m?.metadata?.id || m?.metadata?.key || '';
}
function textOf(m: any): string {
  return m?.metadata?.text || m?.metadata?.content || '';
}

// 清理检索到的资料文本：去掉 markdown 标题、对齐标签等结构性噪音，避免模型照抄成"# 中英文对齐"循环。
function cleanText(t: string): string {
  if (!t) return t;
  return t
    .replace(/^#+\s*.+$/gm, '') // 删除整行 markdown 标题（# 简要回复 / # 中英文对齐 ...）
    .replace(/\n{3,}/g, '\n\n') // 合并多余空行
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

// 清理模型输出：去掉开头引导语/标点残片、模型自加的 Markdown 标题与"新问题"续写，
// 避免检索到的问答型资料把模型带偏成无限 Q&A 列表；若模型判定无关，统一收敛为规范回退语。
function cleanAnswer(raw: string, lang: 'zh' | 'en' = 'zh'): string {
  const noInfo = lang === 'en' ? 'No related information in the knowledge base.' : '资料中没有相关信息。';
  if (!raw) return raw;
  // 剥离 Qwen3 可能残留的思考链（如若 /no_think 未完全生效）
  let s = raw.replace(/<think[\s\S]*?<\/think>/gi, '').replace(/^[\s\S]*?<\/think>/i, '');
  s = s.replace(/^[\s\*\n]*(回答|答案|Answer|Response)[:：]\s*/i, '');
  s = s.replace(/^[\s\n]*[？?]+\s*/, '');
  // 模型判定无关时，可能夹带复述的问题片段，统一收敛为标准回退语。
  if (/资料中没有相关信息|资料不足|没有.*相关.*内容|info is limited|no related information/i.test(s)) {
    return noInfo;
  }
  // 去掉模型自加的 Markdown 标题行（# 选择浴室密封胶...）
  s = s
    .split('\n')
    .filter((line) => !/^#+\s/.test(line.trim()))
    .join('\n');
  // 在模型"续写"出来的新问题/新标题处截断
  const cut = s.search(/\n\s*(问题|Questions?|Q)[:：]\s*\S/im);
  if (cut > 0) s = s.slice(0, cut);
  return s.trim();
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
    // 同一文档可能被切成多段、产生多个向量，topK 里会出现同一 slug 的重复片段；
    // 按 slug 去重后再拼上下文，避免模型照着重复内容把答案也写两遍。
    const seen = new Set<string>();
    const deduped = matches.filter((m) => {
      const s = slugOf(m);
      if (!s || seen.has(s)) return false;
      seen.add(s);
      return true;
    });
    const context = deduped.map((m) => cleanText(textOf(m))).join('\n\n');
    const sources = deduped.map((m) => slugOf(m)).filter(Boolean);
    const raw = await restGenerate(buildPrompt(question, context), ACCOUNT_ID, token);
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

function buildPrompt(question: string, context: string): string {
  const lang = detectLang(question);
  const langRule =
    lang === 'zh' ? '必须用简体中文回答。' : 'You must answer in English.';
  return (
    '/no_think\n\n' + // Qwen3：关闭思考链，直接作答
    '你是工业胶粘剂技术助手，正在为客户解答选型 / 施工 / 防水问题。\n' +
    '下面是从知识库检索到的相关资料。请依据资料回答用户的问题。\n' +
    '要求：\n' +
    '1. 直接给出 1-3 段专业、具体的回答，充分使用资料里的关键要点（产品类型、等级、步骤、注意事项），不要泛泛而谈，不要编造资料里没有的信息。\n' +
    '2. 不要输出 Markdown 标题（#），不要复述或续写资料里的问答列表，不要自行提出新问题。\n' +
    `3. ${langRule}\n` +
    '4. 只有当资料与用户问题确实完全无关时，才用一句话说明无法回答。\n\n' +
    '资料：\n' +
    (context || '（无相关素材）') +
    '\n\n问题：' +
    question
  );
}
