// 自建后台登录：口令 → 签名会话 cookie（不再依赖 GitHub PAT）。
export const prerender = false;

import type { APIRoute } from 'astro';
import { getEnv } from '../../../lib/env';
import { buildSessionCookie, safeEqual } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, locals }) => {
  const env = getEnv(locals);
  const expected = env?.ADMIN_PASSWORD;
  if (!expected) {
    return new Response(JSON.stringify({ ok: false, error: '服务端未配置 ADMIN_PASSWORD' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  let password = '';
  const ct = request.headers.get('content-type') || '';
  try {
    if (ct.includes('application/json')) {
      const b = (await request.json()) as { password?: string };
      password = b?.password || '';
    } else {
      const p = new URLSearchParams(await request.text());
      password = p.get('password') || '';
    }
  } catch {
    password = '';
  }

  if (!password || !safeEqual(password, expected)) {
    return new Response(JSON.stringify({ ok: false, error: '口令错误' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const secure = new URL(request.url).protocol === 'https:';
  const setCookie = await buildSessionCookie(locals, secure);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'Set-Cookie': setCookie },
  });
};

export const GET: APIRoute = async () =>
  new Response('请使用 POST { password } 获取会话 cookie。', { status: 405 });
