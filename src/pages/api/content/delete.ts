// 删除集合条目（单例不支持删除，仅 knowledge/scenarios 可用）。
// Body：{ collection, slug }
export const prerender = false;

import type { APIRoute } from 'astro';
import { getEnv } from '../../../lib/env';
import { isAuthed } from '../../../lib/auth';
import { deleteRow, kindOfCollection } from '../../../lib/content-db';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!(await isAuthed(locals))) {
    return new Response(JSON.stringify({ ok: false, error: '未登录' }), { status: 401, headers: { 'content-type': 'application/json' } });
  }
  const db = getEnv(locals).DB;
  if (!db) return new Response(JSON.stringify({ ok: false, error: 'DB 未绑定' }), { status: 500, headers: { 'content-type': 'application/json' } });

  let body: any;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ ok: false, error: 'JSON 解析失败' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const { collection, slug } = body as { collection?: string; slug?: string };
  if (!collection || !slug) return new Response(JSON.stringify({ ok: false, error: '参数缺失' }), { status: 400, headers: { 'content-type': 'application/json' } });
  if (collection === 'knowledge' || collection === 'scenarios') {
    const id = `${kindOfCollection(collection)}/${slug}`;
    await deleteRow(db, id);
    return new Response(JSON.stringify({ ok: true, id }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return new Response(JSON.stringify({ ok: false, error: '该类型不可删除' }), { status: 400, headers: { 'content-type': 'application/json' } });
};
