// 内容反馈 / 无结果需求捕获（L7 反馈闭环）
// 以 Astro API Route 实现，由 @astrojs/cloudflare 适配器并入 dist/_worker.js，
// 与 /keystatic 共用同一套 Worker——避免根目录 functions/ 触发 Pages Functions 模式
// 盖掉适配器输出的 _worker.js（那会导致整站 404）。
//
// 部署前提：在 Cloudflare Pages 项目绑定一个 KV namespace，变量名 FEEDBACK_KV。
// 无该绑定时本路由仍返回 200，前端已乐观显示"谢谢反馈"，不会崩溃。
export const prerender = false;

import type { APIRoute } from 'astro';

interface FeedbackEnv {
  FEEDBACK_KV?: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
  };
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = (locals as any)?.runtime?.env as FeedbackEnv | undefined;
    const body: any = await request.json();
    const slug = body?.slug;
    const helpful = body?.helpful;
    const note = body?.note;
    if (!slug) return new Response('missing slug', { status: 400 });

    if (!env?.FEEDBACK_KV) {
      // 无 KV 绑定：不阻塞前端，仅记录未落库
      return new Response(JSON.stringify({ ok: false, reason: 'no KV binding' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    const key = `fb:${slug}`;
    const cur = await env.FEEDBACK_KV.get(key);
    const obj = cur ? JSON.parse(cur) : { yes: 0, no: 0, notes: [] as string[] };
    if (helpful === true || helpful === 'true' || helpful === 1) obj.yes++;
    else if (helpful === false || helpful === 'false' || helpful === 0) obj.no++;
    if (note) (obj.notes = obj.notes || []).push(String(note));
    await env.FEEDBACK_KV.put(key, JSON.stringify(obj));
    return new Response(JSON.stringify({ ok: true, yes: obj.yes, no: obj.no }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
};
