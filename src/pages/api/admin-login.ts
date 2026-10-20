// A-根治：用服务器持有的 GitHub PAT 直接签发 Keystatic 的访问令牌 cookie，
// 浏览器全程不接触 github.com，彻底绕开「公司代理封锁 github 导致无法登录」的问题。
//
// 原理（已在 node_modules/@keystatic/core 源码核实）：
//  - Keystatic github 模式把访问令牌存在浏览器 cookie `keystatic-gh-access-token`
//    （非 httpOnly，见 keystatic-core-api-generic.worker.js:273），后台 JS 直接读它
//    作为 Bearer 调 /api/keystatic/*，worker 再拿它以服务端身份调 api.github.com。
//  - PAT 与 OAuth access_token 都只是 Bearer 令牌，因此把 PAT 原样写进该 cookie
//    即可零 OAuth、零 github.com 浏览器接触地登录，编辑器/存储/构建完全不动。
//  - 后台客户端（index-5d64e651.js:1395 getAuth）仅在 cookie 缺失时才 POST
//    /github/refresh-token。我们给 cookie 设 400 天有效期，session 期间永不触发刷新，
//    刷新失败也无影响；到期只需重新访问 /admin-login 登录。
//
// 安全口径：
//  - 口令比对走 KEYSTATIC_ADMIN_PASSWORD（Cloudflare secret_text），长度安全比较。
//  - PAT 存于 KEYSTATIC_PAT（secret_text），仅在服务端读取，绝不回显。
//  - cookie 非 httpOnly（Keystatic 要求 JS 可读），故 PAT 暴露于 XSS 面——内测期可接受，
//    上线前建议改回 OAuth 或收紧 CSP；详见 docs/admin-login.md。
export const prerender = false;

import type { APIRoute } from 'astro';

const COOKIE_NAME = 'keystatic-gh-access-token';
const MAX_AGE = 34560000; // 400 天（Chrome 对 cookie max-age 的上限，足够长且避免刷新）

function getEnv(locals: any): Record<string, any> {
  return (
    (locals as any)?.runtime?.env ??
    (locals as any)?.env ??
    (typeof process !== 'undefined' ? process.env : undefined) ??
    {}
  );
}

// 长度安全比较，避免短路时序差异（弱防护；主要依赖强口令 + 不公开频次限制）
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let r = 0;
  for (let i = 0; i < ab.length; i++) r |= ab[i] ^ bb[i];
  return r === 0;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = getEnv(locals);
  const expected = env?.KEYSTATIC_ADMIN_PASSWORD;
  const pat = env?.KEYSTATIC_PAT;

  if (!expected || !pat) {
    return new Response(
      JSON.stringify({ ok: false, error: '服务端未配置：缺少 KEYSTATIC_ADMIN_PASSWORD 或 KEYSTATIC_PAT' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }

  let password = '';
  const ct = request.headers.get('content-type') || '';
  try {
    if (ct.includes('application/json')) {
      const body = (await request.json()) as { password?: string };
      password = typeof body?.password === 'string' ? body.password : '';
    } else {
      const params = new URLSearchParams(await request.text());
      password = params.get('password') || '';
    }
  } catch {
    password = '';
  }

  if (!password || !safeEqual(password, expected)) {
    return new Response(JSON.stringify({ ok: false, error: '口令错误' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  // 与 Keystatic 原生 cookie 属性对齐：sameSite=lax, path=/, Secure(生产), 非 httpOnly
  const secure = new URL(request.url).protocol === 'https:';
  const setCookie = `${COOKIE_NAME}=${pat}; Path=/; SameSite=Lax;${secure ? ' Secure;' : ''} Max-Age=${MAX_AGE}`;

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'Set-Cookie': setCookie },
  });
};

export const GET: APIRoute = async () => {
  return new Response('请使用 POST { password } 获取会话 cookie。', { status: 405 });
};
