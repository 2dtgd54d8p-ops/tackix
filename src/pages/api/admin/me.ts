// 返回当前登录态，供后台外壳决定显示登录框还是仪表盘。
export const prerender = false;

import type { APIRoute } from 'astro';
import { isAuthed } from '../../../lib/auth';

export const GET: APIRoute = async (ctx) => {
  // 必须传完整 ctx：isAuthed 依赖 ctx.request / ctx.cookies 读取会话 cookie，
  // 只传 locals 会读不到（症状：登录成功但所有接口恒 401）。
  const authed = await isAuthed(ctx);
  return new Response(JSON.stringify({ authed }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
