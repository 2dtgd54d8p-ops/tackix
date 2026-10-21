// AI 问答（L6 AI 原生）—— 基于 Vectorize + Workers AI 的 RAG
// 以 Astro API Route 实现，由 @astrojs/cloudflare 适配器并入 dist/_worker.js，
// 与后台 API 路由共用同一套 Worker（消除 functions/ 与适配器 _worker.js 的冲突）。
//
// 部署前提（Cloudflare Pages 项目绑定）：
//   - Vectorize index -> 变量名 VECTORIZE（先运行 scripts/embed.mjs 灌入知识库切片 embeddings）
//   - Workers AI      -> 变量名 AI
// 无绑定或出错时返回友好提示，前端不会崩溃。
export const prerender = false;

import type { APIRoute } from 'astro';

interface AskEnv {
  VECTORIZE?: {
    query(vector: number[], opts: { topK: number }): Promise<{ matches?: Array<{ metadata?: any }> }>;
  };
  AI?: {
    run(model: string, inputs: any): Promise<any>;
  };
}

const EMBED_MODEL = '@cf/baai/bge-base-en-v1.5';
const GEN_MODEL = '@cf/meta/llama-3.1-8b-instruct';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = (locals as any)?.runtime?.env as AskEnv | undefined;
    const body: any = await request.json();
    const question = body?.question;
    if (!question) {
      return new Response(JSON.stringify({ answer: '请输入问题。' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (!env?.AI || !env?.VECTORIZE) {
      return new Response(
        JSON.stringify({ answer: 'AI 问答需部署后端（Workers AI + Vectorize）后启用。' }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    const emb: any = await env.AI.run(EMBED_MODEL, { text: question });
    const vec: number[] = Array.isArray(emb) ? emb : emb?.data?.[0] ?? emb?.embeddings?.[0];
    if (!vec) throw new Error('embedding failed');

    const matches = await env.VECTORIZE.query(vec, { topK: 5 });
    const context = (matches.matches || [])
      .map((m: any) => m.metadata?.text || '')
      .join('\n\n');
    const prompt =
      '你是工业胶粘剂技术助手。仅基于以下资料回答问题，资料不足时如实说不知道，不要编造。\n\n资料：\n' +
      context +
      '\n\n问题：' +
      question;
    const out: any = await env.AI.run(GEN_MODEL, { prompt });
    const answer = out?.response || out?.text || '（无回答）';
    const sources = (matches.matches || []).map((m: any) => m.metadata?.slug).filter(Boolean);
    return new Response(JSON.stringify({ answer, sources }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ answer: 'AI 问答需部署后端（Workers AI + Vectorize）后启用。' }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  }
};
