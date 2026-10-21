/**
 * 自建后台鉴权：口令 → HMAC 签名的会话 cookie，彻底不再依赖 GitHub PAT。
 * - 口令比对：ADMIN_PASSWORD（Cloudflare secret_text），长度安全比较。
 * - 会话令牌：base64url(payload).hmac，payload 含 exp；由 SESSION_SECRET 签名。
 * - cookie 为 HttpOnly（比明文 cookie 的 XSS 暴露面更小）。
 */
import { getEnv, ADMIN_COOKIE, SESSION_MAX_AGE } from './env';

function b64urlEncode(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64url');
}
function b64urlDecode(s: string): string {
  return Buffer.from(s, 'base64url').toString('utf8');
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Buffer.from(new Uint8Array(sig)).toString('base64url');
}

async function hmacVerify(data: string, sigB64: string, secret: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  try {
    return await crypto.subtle.verify('HMAC', key, Buffer.from(sigB64, 'base64url'), enc.encode(data));
  } catch {
    return false;
  }
}

function secretOf(env: any): string {
  return env?.SESSION_SECRET || '';
}

async function signSession(secret: string): Promise<string> {
  const payload = { iat: Date.now(), exp: Date.now() + SESSION_MAX_AGE * 1000 };
  const data = b64urlEncode(JSON.stringify(payload));
  const sig = await hmacSign(data, secret);
  return `${data}.${sig}`;
}

export async function verifySession(token: string | undefined, env: any): Promise<boolean> {
  if (!token) return false;
  const secret = secretOf(env);
  if (!secret) return false;
  const [data, sig] = token.split('.');
  if (!data || !sig) return false;
  const ok = await hmacVerify(data, sig, secret);
  if (!ok) return false;
  try {
    const p = JSON.parse(b64urlDecode(data));
    if (p.exp && p.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

/** 构造 Set-Cookie 头值（HttpOnly + Secure(生产) + SameSite=Lax）。 */
export async function buildSessionCookie(locals: any, secure: boolean): Promise<string> {
  const env = getEnv(locals);
  const secret = secretOf(env);
  const token = await signSession(secret);
  return `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax;${secure ? ' Secure;' : ''} Max-Age=${SESSION_MAX_AGE}`;
}

/** 长度安全比较（避免短路时序）。 */
export function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let r = 0;
  for (let i = 0; i < ab.length; i++) r |= ab[i] ^ bb[i];
  return r === 0;
}

/** 从 Astro context/Astro 对象取 cookie 值（兼容 pages 与 API routes）。 */
export function getCookieValue(ctx: any, name: string): string | undefined {
  const direct = ctx?.cookies?.get?.(name)?.value;
  if (direct) return direct;
  const header = ctx?.request?.headers?.get?.('cookie');
  if (header) {
    for (const part of header.split(';')) {
      const [k, ...v] = part.trim().split('=');
      if (k === name) return decodeURIComponent(v.join('='));
    }
  }
  return undefined;
}

/** 校验当前请求是否已登录（用于中间件与 API 守卫）。 */
export async function isAuthed(ctx: any): Promise<boolean> {
  const env = getEnv(ctx?.locals ?? ctx);
  const token = getCookieValue(ctx, ADMIN_COOKIE);
  return verifySession(token, env);
}

/** 清除会话 cookie 的 Set-Cookie 头值。 */
export function clearSessionCookie(): string {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
