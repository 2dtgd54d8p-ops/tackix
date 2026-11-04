import { defineMiddleware } from 'astro/middleware';
import { ADMIN_COOKIE } from './lib/env';
import { getCookieValue, isAuthed } from './lib/auth';

// 自建后台守卫：取代原 GitHub PAT / Keystatic 后台守护。
// - /admin 及其子页：未登录 → 302 到 /admin/login
// - /api/content/* 与 /api/media/*：未登录 → 401 JSON
// - /admin/login 与 /api/admin/login：放行
// - 其余路径：不拦截（静态页面正常服务）
const ADMIN_LOGIN = '/admin/login';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = new URL(context.request.url);

  const isLoginPage = pathname === ADMIN_LOGIN || pathname.startsWith(ADMIN_LOGIN + '/');
  const isLoginApi = pathname === '/api/admin/login';
  const isAdminPage = pathname === '/admin' || pathname.startsWith('/admin/');
  const isProtectedApi =
    pathname.startsWith('/api/content/') || pathname.startsWith('/api/media/');

  // 登录入口与登录接口始终放行
  if (isLoginPage || isLoginApi) return next();

  // 留言/报表已纳入统一会话鉴权（接口侧同时兼容旧 ADMIN_TOKEN），
  // 故 /admin 下所有页面一律要求登录态，不再有 isOpTool 例外。
  if (isAdminPage || isProtectedApi) {
    const authed = await isAuthed(context);
    if (!authed) {
      if (isProtectedApi) {
        return new Response(JSON.stringify({ ok: false, error: '未登录' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        });
      }
      return context.redirect(ADMIN_LOGIN, 302);
    }
  }

  return next();
});
