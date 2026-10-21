// 返回当前登录态，供后台外壳决定显示登录框还是仪表盘。
export const prerender = false;

import type { APIRoute } from 'astro';
import { isAuthed } from '../../../lib/auth';

export const GET: APIRoute = async ({ locals }) => {
  const authed = await isAuthed(locals);
  return new Response(JSON.stringify({ authed }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
