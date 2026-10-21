// 列出内容条目（不含完整 data，供后台列表展示）。
export const prerender = false;

import type { APIRoute } from 'astro';
import { getEnv } from '../../../lib/env';
import { isAuthed } from '../../../lib/auth';
import { listRows } from '../../../lib/content-db';

export const GET: APIRoute = async ({ request, locals }) => {
  if (!(await isAuthed(locals))) {
    return new Response(JSON.stringify({ ok: false, error: '未登录' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  const db = getEnv(locals).DB;
  if (!db) return new Response(JSON.stringify({ ok: false, error: 'DB 未绑定' }), { status: 500, headers: { 'content-type': 'application/json' } });

  const kind = new URL(request.url).searchParams.get('kind') || 'all';
  const rows = await listRows(db, kind);
  return new Response(JSON.stringify({ ok: true, rows }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
