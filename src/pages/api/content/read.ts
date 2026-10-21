// 读取单条内容（含完整 data），供编辑表单回填。
// 用法：?singleton=home   或   ?collection=knowledge&slug=xxx
export const prerender = false;

import type { APIRoute } from 'astro';
import { getEnv } from '../../../lib/env';
import { isAuthed } from '../../../lib/auth';
import { readRow, kindOfCollection } from '../../../lib/content-db';

export const GET: APIRoute = async ({ request, locals }) => {
  if (!(await isAuthed(locals))) {
    return new Response(JSON.stringify({ ok: false, error: '未登录' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  const db = getEnv(locals).DB;
  if (!db) return new Response(JSON.stringify({ ok: false, error: 'DB 未绑定' }), { status: 500, headers: { 'content-type': 'application/json' } });

  const sp = new URL(request.url).searchParams;
  let id: string | null = null;
  const singleton = sp.get('singleton');
  const collection = sp.get('collection');
  const slug = sp.get('slug');
  if (singleton) id = `singleton/${singleton}`;
  else if (collection && slug) id = `${kindOfCollection(collection)}/${slug}`;

  if (!id) return new Response(JSON.stringify({ ok: false, error: '参数缺失' }), { status: 400, headers: { 'content-type': 'application/json' } });

  const row = await readRow(db, id);
  if (!row) return new Response(JSON.stringify({ ok: false, error: '未找到' }), { status: 404, headers: { 'content-type': 'application/json' } });

  let data = row.data;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { data = {}; }
  }
  return new Response(JSON.stringify({ ok: true, entry: { id: row.id, kind: row.kind, collection: row.collection, slug: row.slug, published: !!row.published, featured: !!row.featured, data } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
