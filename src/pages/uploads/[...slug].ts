// 媒体服务路由（三级回退）：
//   1. R2（MEDIA）—— 将来开通 R2 后的主存储
//   2. KV（MEDIA_KV）—— R2 未开通时的免费替代，无需绑卡
//   3. 静态资源（ASSETS）—— 迁移前已提交到 public/uploads 的遗留文件
//
// 三者共用同一对外契约 /uploads/<key>，前端与内容数据零改动。
export const prerender = false;

import type { APIRoute } from 'astro';
import { getEnv } from '../../lib/env';

// 媒体文件名带时间戳，内容不会原地变更，可长缓存（不可变）
const CACHE = 'public, max-age=31536000, immutable';

export const GET: APIRoute = async ({ params, request, locals }) => {
  const parts = params.slug as string[] | string | undefined;
  const key = Array.isArray(parts) ? parts.join('/') : (parts || '');
  if (!key) return new Response('Not found', { status: 404 });

  const env = getEnv(locals);
  const decoded = decodeURIComponent(key);

  // 1) R2
  try {
    const obj = await env.MEDIA?.get?.(decoded);
    if (obj) {
      const headers = new Headers();
      headers.set('content-type', obj.httpMetadata?.contentType || 'application/octet-stream');
      headers.set('cache-control', CACHE);
      return new Response(obj.body, { headers });
    }
  } catch {
    /* 未绑 R2 或读取失败，继续回退 */
  }

  // 2) KV
  try {
    const hit = await env.MEDIA_KV?.getWithMetadata?.(decoded, 'stream');
    if (hit?.value) {
      const headers = new Headers();
      headers.set('content-type', (hit.metadata as any)?.contentType || 'application/octet-stream');
      headers.set('cache-control', CACHE);
      return new Response(hit.value, { headers });
    }
  } catch {
    /* 未绑 KV 或读取失败，继续回退 */
  }

  // 3) 静态资源（仅当构建产物里仍含 public/uploads 时）
  try {
    return (await env.ASSETS?.fetch?.(request)) as Response;
  } catch {
    /* ignore */
  }
  return new Response('Not found', { status: 404 });
};
