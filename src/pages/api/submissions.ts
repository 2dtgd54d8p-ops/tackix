import type { APIRoute } from 'astro';

/**
 * 留言管理接口（受口令保护，不对外公开）。
 *
 * 必要条件（Cloudflare Pages → Settings → Environment variables）：
 *   ADMIN_TOKEN        : 访问口令，自己随机生成一个长字符串
 *   CONTACT_ADMIN_PATH: 可选，隐藏入口路径后缀（见 admin/messages 页面说明）
 *
 * 鉴权方式（三选一）：
 *   - Header  x-admin-token: <token>
 *   - Query   ?token=<token>
 *   - Cookie  admin_token=<token>
 *
 * 未配置 ADMIN_TOKEN 时接口一律拒绝，避免「忘了配口令 = 全网可见」的翻车。
 */
export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

function readToken(request: Request): string {
  const header = request.headers.get('x-admin-token');
  if (header) return header.trim();

  const url = new URL(request.url);
  const query = url.searchParams.get('token');
  if (query) return query.trim();

  const cookie = request.headers.get('cookie') || '';
  const hit = cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('admin_token='));
  return hit ? decodeURIComponent(hit.slice('admin_token='.length)).trim() : '';
}

/** 恒定时间字符串比较，避免时序侧信道 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const GET: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? (locals as any)?.env;

  // trim 容错：Cloudflare 控制台粘贴的值末尾偶发不可见空格/换行，
  // 会让「看似一样」的口令因长度不等而校验失败。
  const expected = String(env?.ADMIN_TOKEN ?? '').trim();
  if (!expected) {
    return json({ ok: false, error: '服务端未配置 ADMIN_TOKEN，接口已关闭。' }, 503);
  }
  if (!safeEqual(readToken(request), expected)) {
    return json({ ok: false, error: '口令不正确' }, 401);
  }

  const db = env?.DB;
  if (!db) {
    return json({ ok: false, error: 'D1 未绑定（缺少 DB 变量）。' }, 500);
  }

  const url = new URL(request.url);
  const raw = Number(url.searchParams.get('limit') || 50);
  const limit = Math.min(Math.max(Number.isFinite(raw) ? raw : 50, 1), 200);

  try {
    const { results } = await db
      .prepare(
        'SELECT id, name, email, message, created_at FROM submissions ORDER BY created_at DESC LIMIT ?'
      )
      .bind(limit)
      .all();
    const count = await db.prepare('SELECT COUNT(*) AS n FROM submissions').first();
    return json({ ok: true, items: results ?? [], total: count?.n ?? (results?.length ?? 0) });
  } catch (e) {
    return json({ ok: false, error: (e as Error)?.message ?? '查询失败' }, 500);
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? (locals as any)?.env;

  // trim 容错：Cloudflare 控制台粘贴的值末尾偶发不可见空格/换行，
  // 会让「看似一样」的口令因长度不等而校验失败。
  const expected = String(env?.ADMIN_TOKEN ?? '').trim();
  if (!expected) {
    return json({ ok: false, error: '服务端未配置 ADMIN_TOKEN，接口已关闭。' }, 503);
  }
  if (!safeEqual(readToken(request), expected)) {
    return json({ ok: false, error: '口令不正确' }, 401);
  }

  const db = env?.DB;
  if (!db) return json({ ok: false, error: 'D1 未绑定（缺少 DB 变量）。' }, 500);

  const url = new URL(request.url);
  const id = Number(url.searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return json({ ok: false, error: '缺少合法的 id' }, 400);
  }

  try {
    await db.prepare('DELETE FROM submissions WHERE id = ?').bind(id).run();
    return json({ ok: true, id });
  } catch (e) {
    return json({ ok: false, error: (e as Error)?.message ?? '删除失败' }, 500);
  }
};
