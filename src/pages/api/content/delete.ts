// 删除集合条目（单例不支持删除，仅 knowledge/scenarios 可用）。
// Body：{ collection, slug }
//
// 删除前先把当前内容写一条 action='delete' 的快照，这样「误删」也能从版本历史里回滚恢复
// （回滚走 upsertRow，行不存在时会重新插入）。
export const prerender = false;

import type { APIRoute } from 'astro';
import { getEnv } from '../../../lib/env';
import { isAuthed } from '../../../lib/auth';
import { deleteRow, readRow, addRevision, kindOfCollection } from '../../../lib/content-db';

export const POST: APIRoute = async (ctx) => {
  const { request, locals } = ctx;
  if (!(await isAuthed(ctx))) {
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
    // 先留一份删除前快照（读不到说明本来就不存在，直接删）
    const cur = await readRow(db, id);
    if (cur) {
      let data = (cur as any).data;
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = {}; } }
      await addRevision(db, { id, collection, slug, data: data ?? {}, action: 'delete' });
    }
    await deleteRow(db, id);
    return new Response(JSON.stringify({ ok: true, id }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return new Response(JSON.stringify({ ok: false, error: '该类型不可删除' }), { status: 400, headers: { 'content-type': 'application/json' } });
};
