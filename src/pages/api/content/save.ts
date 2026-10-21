// 保存（新增/更新）单条内容到 D1。Body：{ collection, slug, data, published?, featured? }
export const prerender = false;

import type { APIRoute } from 'astro';
import { getEnv } from '../../../lib/env';
import { isAuthed } from '../../../lib/auth';
import { upsertRow, kindOfCollection, titlesFromData } from '../../../lib/content-db';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!(await isAuthed(locals))) {
    return new Response(JSON.stringify({ ok: false, error: '未登录' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  const db = getEnv(locals).DB;
  if (!db) return new Response(JSON.stringify({ ok: false, error: 'DB 未绑定' }), { status: 500, headers: { 'content-type': 'application/json' } });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'JSON 解析失败' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }

  const { collection, slug, data } = body as { collection?: string; slug?: string; data?: any };
  if (!collection || !slug || typeof data !== 'object' || data === null) {
    return new Response(JSON.stringify({ ok: false, error: '参数缺失（需 collection/slug/data）' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  if (!/^[a-z0-9-]+$/i.test(slug)) {
    return new Response(JSON.stringify({ ok: false, error: 'slug 非法' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }

  const kind = kindOfCollection(collection);
  const id = `${kind}/${slug}`;
  const { zh, en } = titlesFromData(data);
  const published = collection === 'knowledge' || collection === 'scenarios' ? !!body.published : true;
  const featured = collection === 'knowledge' || collection === 'scenarios' ? !!body.featured : false;

  try {
    await upsertRow(db, { id, kind, collection, slug, data, title_zh: zh, title_en: en, published, featured });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: '写入失败: ' + (e?.message || e) }), { status: 500, headers: { 'content-type': 'application/json' } });
  }

  return new Response(JSON.stringify({ ok: true, id }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
