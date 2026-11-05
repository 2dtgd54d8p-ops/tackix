// 待发布计数：本次「发布（重建）」之后又被保存过的条目数。
// last_publish_at 存于 KV（键 admin:last_publish_at，毫秒时间戳）；未设置时视为 0 → 待发布 0。
// 用途：仪表盘提示「有 N 条已保存但尚未发布」，提醒攒稿后一次性发布。
export const prerender = false;

import type { APIRoute } from 'astro';
import { getEnv } from '../../../lib/env';
import { isAuthed } from '../../../lib/auth';

const KEY = 'admin:last_publish_at';
const JSON_HEADERS = { 'content-type': 'application/json' };

function kvOf(env: any) {
  return env?.FEEDBACK_KV || env?.MEDIA_KV || null;
}

export const GET: APIRoute = async (ctx) => {
  if (!(await isAuthed(ctx))) {
    return new Response(JSON.stringify({ ok: false, error: '未登录' }), { status: 401, headers: JSON_HEADERS });
  }

  const env = getEnv(ctx.locals);
  const db = env.DB;
  const kv = kvOf(env);

  let lastPublishAt = 0;
  try {
    const v = await kv?.get(KEY);
    if (v) lastPublishAt = Number(v) || 0;
  } catch {
    /* KV 未绑定或读取失败 → 视为 0 */
  }

  let pending = 0;
  if (db && lastPublishAt > 0) {
    try {
      const row: any = await db
        .prepare('SELECT COUNT(*) AS n FROM content_entries WHERE updated_at > ?')
        .bind(lastPublishAt)
        .first();
      pending = Number(row?.n) || 0;
    } catch {
      pending = 0;
    }
  }

  return new Response(JSON.stringify({ ok: true, pending, lastPublishAt }), { status: 200, headers: JSON_HEADERS });
};
