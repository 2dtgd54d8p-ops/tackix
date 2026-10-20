// 覆盖 Keystatic 原生登出行为。
//
// 背景：Keystatic 自带 /api/keystatic/github/logout 会在清 cookie 后重定向回
// `/keystatic`，于是用户看到的是 Keystatic 原生的「Log in with GitHub」按钮；
// 而在无外网代理的环境里该按钮点不通（OAuth 要跳 github.com），登出即进死胡同。
//
// A-根治 后我们用的是「口令端点 + PAT cookie」体系，登出后应回到自己的
// `/admin-login` 口令页，逻辑闭环、体验一致。
//
// 实现：该静态路由比 Keystatic 注入的 `/api/keystatic/[...params]` 兜底更具体，
// 构建后（dist/_worker.js/pages/api/keystatic/github/logout.astro.mjs）优先命中。
// 只做两件事：清两个 token cookie、302 到 /admin-login。
// 不调用 GitHub App 的 token DELETE —— 我们持有的是 PAT 而非 App token，那步无意义。
export const prerender = false;

import type { APIRoute } from 'astro';

function clearCookie(name: string, opts: { httpOnly?: boolean; secure: boolean }): string {
  return `${name}=; Path=/; SameSite=Lax;${opts.secure ? ' Secure;' : ''} Max-Age=0${
    opts.httpOnly ? '; HttpOnly' : ''
  }`;
}

function handle(request: Request): Response {
  const secure = new URL(request.url).protocol === 'https:';
  const headers = new Headers();
  headers.append('Set-Cookie', clearCookie('keystatic-gh-access-token', { secure }));
  headers.append('Set-Cookie', clearCookie('keystatic-gh-refresh-token', { secure, httpOnly: true }));
  headers.set('Location', '/admin-login');
  // 302 让浏览器以 GET 跟随到登录页
  return new Response(null, { status: 302, headers });
}

export const GET: APIRoute = async ({ request }) => handle(request);
export const POST: APIRoute = async ({ request }) => handle(request);
