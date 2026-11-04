// 内容修订历史：查看 + 一键回滚。
//
// GET  /api/content/revisions?id=<entryId>&limit=30      → 该条目的版本列表（新→旧）
// GET  /api/content/revisions?revisionId=<n>            → 单个快照的完整 data（预览用）
// POST /api/content/revisions  { id, revisionId }       → 把该快照写回 content_entries
//
// 回滚本身也会产生一条 action='restore' 的新修订，因此「回滚」这个动作同样可回滚。
export const prerender = false;

import type { APIRoute } from 'astro';
import { getEnv } from '../../../lib/env';
import { isAuthed } from '../../../lib/auth';
import {
  listRevisions,
  readRevision,
  readRow,
  upsertRow,
  addRevision,
  kindOfCollection,
  titlesFromData,
} from '../../../lib/content-db';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const GET: APIRoute = async (ctx) => {
  const { request, locals } = ctx;
  if (!(await isAuthed(ctx))) return json({ ok: false, error: '未登录' }, 401);

  const db = getEnv(locals).DB;
  if (!db) return json({ ok: false, error: 'DB 未绑定' }, 500);

  const sp = new URL(request.url).searchParams;

  // 单个快照（预览）
  const revisionId = sp.get('revisionId');
  if (revisionId) {
    const rev = await readRevision(db, Number(revisionId));
    if (!rev) return json({ ok: false, error: '快照不存在' }, 404);
    return json({
      ok: true,
      revision: {
        id: rev.id,
        entry_id: rev.entry_id,
        collection: rev.collection,
        slug: rev.slug,
        action: rev.action,
        created_at: rev.created_at,
        data: rev.data,
      },
    });
  }

  // 版本列表
  const id = sp.get('id');
  if (!id) return json({ ok: false, error: '参数缺失（需 id 或 revisionId）' }, 400);
  const limit = Number(sp.get('limit') || 30);
  const rows = await listRevisions(db, id, limit);
  return json({ ok: true, id, rows });
};

export const POST: APIRoute = async (ctx) => {
  const { request, locals } = ctx;
  if (!(await isAuthed(ctx))) return json({ ok: false, error: '未登录' }, 401);

  const db = getEnv(locals).DB;
  if (!db) return json({ ok: false, error: 'DB 未绑定' }, 500);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'JSON 解析失败' }, 400);
  }

  const id = String(body?.id || '');
  const revisionId = Number(body?.revisionId);
  if (!id || !Number.isFinite(revisionId)) {
    return json({ ok: false, error: '参数缺失（需 id / revisionId）' }, 400);
  }

  const rev = await readRevision(db, revisionId);
  if (!rev) return json({ ok: false, error: '快照不存在' }, 404);
  // 防跨条目回滚：快照必须属于目标条目
  if (rev.entry_id !== id) {
    return json({ ok: false, error: '快照与目标条目不匹配' }, 400);
  }

  const collection = rev.collection;
  const slug = rev.slug;
  const kind = kindOfCollection(collection);
  const data = rev.data ?? {};
  const { zh, en } = titlesFromData(data);

  // published / featured 不在快照里，沿用当前行（行已不存在则用默认值）
  const cur = await readRow(db, id);
  const published = cur ? !!cur.published : true;
  const featured = cur ? !!cur.featured : false;

  try {
    await upsertRow(db, {
      id,
      kind,
      collection,
      slug,
      data,
      title_zh: zh,
      title_en: en,
      published,
      featured,
    });
  } catch (e: any) {
    return json({ ok: false, error: '回滚写入失败: ' + (e?.message || e) }, 500);
  }

  // 记录本次回滚，便于「回滚的回滚」
  await addRevision(db, {
    id,
    collection,
    slug,
    data,
    action: `restore:${revisionId}`,
  });

  return json({
    ok: true,
    id,
    restoredFrom: revisionId,
    message: '已回滚到该版本。记得点「发布」让前台生效。',
  });
};
