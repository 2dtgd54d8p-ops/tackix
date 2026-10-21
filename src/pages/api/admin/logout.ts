// 退出登录：清除会话 cookie，跳回登录页由前端处理。
export const prerender = false;

import type { APIRoute } from 'astro';
import { clearSessionCookie } from '../../../lib/auth';

export const POST: APIRoute = async () => {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'Set-Cookie': clearSessionCookie() },
  });
};
