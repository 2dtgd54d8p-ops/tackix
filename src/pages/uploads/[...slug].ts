// 媒体服务路由：优先从 R2 取，未命中则回退到静态资源（public/uploads 下的遗留文件）。
// 这样 R2 成为新媒体的唯一真源，同时不破坏迁移前已提交到 git 的静态图片。
export const prerender = false;

import type { APIRoute } from 'astro';
import { getEnv } from '../../lib/env';

export const GET: APIRoute = async ({ params, request, locals }) => {
  const parts = params.slug as string[] | string | undefined;
  const key = Array.isArray(parts) ? parts.join('/') : (parts || '');
  if (!key) return new Response('Not found', { status: 404 });

  const env = getEnv(locals);
  const decoded = decodeURIComponent(key);

  try {
    const obj = await env.MEDIA?.get?.(decoded);
    if (obj) {
      const headers = new Headers();
      headers.set('content-type', obj.httpMetadata?.contentType || 'application/octet-stream');
      headers.set('cache-control', 'public, max-age=31536000, immutable');
      return new Response(obj.body, { headers });
    }
  } catch {
    /* 忽略 R2 错误，继续回退 */
  }

  // 回退：静态资源（仅当本地/构建产物里仍含 public/uploads 时）
  try {
    return (await env.ASSETS?.fetch?.(request)) as Response;
  } catch {
    /* ignore */
  }
  return new Response('Not found', { status: 404 });
};
