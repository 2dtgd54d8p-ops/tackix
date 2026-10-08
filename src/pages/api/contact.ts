import type { APIRoute } from 'astro';

// 这是一个服务端接口（Cloudflare Pages Functions），不是静态页。
// 依赖：Cloudflare Pages → Settings → Functions 里把 D1 绑定到变量名 **DB**。
export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const name = String(body?.name ?? '').trim();
    const email = String(body?.email ?? '').trim();
    const message = String(body?.message ?? '').trim();

    if (!name || !email || !message) {
      return json({ ok: false, error: '姓名、邮箱、留言均为必填' }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ ok: false, error: '邮箱格式不正确' }, 400);
    }
    if (message.length > 2000) {
      return json({ ok: false, error: '留言过长（最多 2000 字）' }, 400);
    }

    // Cloudflare runtime：locals.runtime.env 里挂着 Pages Functions 的绑定
    const env = (locals as any)?.runtime?.env ?? (locals as any)?.env;
    const db = env?.DB;
    if (!db) {
      return json(
        { ok: false, error: '服务端尚未绑定 D1（缺少 DB 变量）。见 d1-schema.sql 顶部说明。' },
        500
      );
    }

    await db
      .prepare('INSERT INTO submissions (name, email, message, created_at) VALUES (?, ?, ?, ?)')
      .bind(name, email, message, new Date().toISOString())
      .run();

    return json({ ok: true }, 200);
  } catch (e) {
    return json({ ok: false, error: (e as Error)?.message ?? '服务端错误' }, 500);
  }
};
