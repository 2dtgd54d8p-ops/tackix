// 邮件订阅（L5 个性化）：捕获访客邮箱，落库到 Cloudflare KV（变量名 FEEDBACK_KV）
// 与反馈共用同一 KV，key 前缀 sub:。无 KV 绑定时返回 ok:false，前端仍乐观显示"已订阅"。
// 以 Astro API Route 实现，由 @astrojs/cloudflare 适配器并入 dist/_worker.js，
// 与 /keystatic、/api/ask、/api/feedback 共用同一套 Worker。
export const prerender = false;

import type { APIRoute } from 'astro';

interface SubEnv {
  FEEDBACK_KV?: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = (locals as any)?.runtime?.env as SubEnv | undefined;
    const body: any = await request.json();
    const email = String(body?.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return new Response(JSON.stringify({ ok: false, error: 'invalid_email' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (!env?.FEEDBACK_KV) {
      return new Response(JSON.stringify({ ok: false, reason: 'no KV binding' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    const key = `sub:${email}`;
    const cur = await env.FEEDBACK_KV.get(key);
    const obj = cur ? JSON.parse(cur) : { email, subscribedAt: [] as string[], lang: body?.lang };
    obj.subscribedAt = obj.subscribedAt || [];
    obj.subscribedAt.push(new Date().toISOString());
    obj.lang = body?.lang || obj.lang;
    await env.FEEDBACK_KV.put(key, JSON.stringify(obj));
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
};
