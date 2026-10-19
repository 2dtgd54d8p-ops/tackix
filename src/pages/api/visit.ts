// 匿名访问埋点端点：接收全站 Beacon 上报的 path + ref，写入 D1 visits 表。
//
// 隐私口径：
//  - 仅用匿名访客 ID（vuid cookie，HttpOnly + 1 年）做 UV 去重，不存储 IP / 账号等 PII。
//  - 自动跳过 /admin、/keystatic、/api/* 与静态资源（带扩展名）。
//  - DB 未绑定时优雅降级（204，静默忽略），不影响前端。
//  - 内部跳转的 referer 折叠为 (internal)，只保留站外来源用于「主要来源」统计。
//
// 触发方式：GET 或 POST，参数放 query（sendBeacon 以空 POST 发出，参数随 URL）。
export const prerender = false;

import type { APIRoute } from 'astro';
import { recordVisit } from '../../lib/traffic';

function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const hit = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(name + '='));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

function genVuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return 'v-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
}

// 跳过后台、Keystatic、API 自身、带扩展名的静态资源
const SKIP = /^\/(admin|keystatic|api)\b|\.[a-z0-9]+$/i;

async function handle(request: Request, locals: any): Promise<Response> {
  const env = (locals as any)?.runtime?.env ?? (locals as any)?.env;
  const url = new URL(request.url);
  const path = (url.searchParams.get('path') || '').trim();

  if (!path || SKIP.test(path)) {
    return new Response(null, { status: 204 });
  }

  const db = env?.DB;
  if (!db) return new Response(null, { status: 204 }); // 优雅降级

  // 规范化 referrer：站内跳转折叠为 (internal)，只留站外来源
  let ref = (url.searchParams.get('ref') || '').trim();
  if (ref) {
    try {
      const r = new URL(ref);
      const here = new URL(request.url);
      if (r.host === here.host) ref = '(internal)';
    } catch {
      /* 非法 URL 保留原值 */
    }
  }

  const ua = request.headers.get('user-agent') || '';

  let vuid = readCookie(request.headers.get('cookie'), 'vuid');
  let setCookie: string | null = null;
  if (!vuid) {
    vuid = genVuid();
    setCookie = `vuid=${vuid}; Max-Age=31536000; Path=/; SameSite=Lax; HttpOnly`;
  }

  const ok = await recordVisit(env, { path, ref, ua, vuid });
  if (!ok) return new Response(null, { status: 204 });

  const headers: Record<string, string> = {};
  if (setCookie) headers['Set-Cookie'] = setCookie;
  return new Response(null, { status: 204, headers });
}

export const GET: APIRoute = async ({ request, locals }) => handle(request, locals);
export const POST: APIRoute = async ({ request, locals }) => handle(request, locals);
