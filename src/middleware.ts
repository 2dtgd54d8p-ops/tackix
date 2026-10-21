import { defineMiddleware } from 'astro/middleware';

// 彻底加固：直接访问后台 SPA（/keystatic、/keystatic/*）时，若浏览器没有
// `keystatic-gh-access-token` 会话 cookie，一律 302 到 /admin-login。
// 这样即使有人手输/书签 /keystatic，也不会落到 Keystatic 原生 OAuth
// （其「Log in with GitHub」按钮需浏览器直连 github.com，公司代理环境不可用）。
//
// 已登录用户带着 cookie 进入 → 正常放行；后台 JS 凭该 cookie 调 /api/keystatic/*
// 服务端接口（worker 拿 PAT 以服务端身份访问 api.github.com），链路不受影响。
// 登出由 src/pages/api/keystatic/github/logout.ts 处理（清 cookie 后回 /admin-login）。
//
// 注意：本中间件只看守「后台 UI 入口」（/keystatic 路径），不拦 /api/keystatic/*
// 也不拦静态资源，避免误伤已登录会话的后台内部请求。
const ADMIN_COOKIE = 'keystatic-gh-access-token';
const LOGIN_PATH = '/admin-login';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = new URL(context.request.url);
  const isAdminUi = pathname === '/keystatic' || pathname.startsWith('/keystatic/');

  if (isAdminUi) {
    const cookie = context.cookies.get(ADMIN_COOKIE);
    const hasSession = !!cookie && !!cookie.value;
    if (!hasSession) {
      return context.redirect(LOGIN_PATH, 302);
    }
  }

  return next();
});
