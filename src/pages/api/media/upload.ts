// 后台媒体上传：写入 R2（已开通时）或 KV（免费替代，无需绑卡），返回可访问的 /uploads/<key>。
//
// 存储优先级与读取侧保持一致：R2 → KV → 静态资源。
// KV 方案的限制：单文件 ≤ 25 MiB（value 上限）、免费额度 1 GB 存量 / 1000 次写每天。
export const prerender = false;

import type { APIRoute } from 'astro';
import { getEnv } from '../../../lib/env';
import { isAuthed } from '../../../lib/auth';

const MB = 1024 * 1024;
const KV_MAX = 20 * MB; // 留出余量，KV value 硬上限 25 MiB
const R2_MAX = 50 * MB;

// 只放行静态素材，避免把后台上传变成任意文件投递口
const ALLOWED = /^(image\/(png|jpe?g|gif|webp|avif|svg\+xml)|application\/pdf)$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const POST: APIRoute = async (ctx) => {
  const { request, locals } = ctx;
  if (!(await isAuthed(ctx))) {
    return json({ ok: false, error: '未登录' }, 401);
  }

  const env = getEnv(locals);
  const r2 = env.MEDIA; // R2 未开通时为 undefined
  const kv = env.MEDIA_KV; // R2 未开通时的替代后端
  if (!r2 && !kv) {
    return json(
      { ok: false, error: '媒体存储未配置：R2(MEDIA) 与 KV(MEDIA_KV) 均未绑定' },
      500
    );
  }
  const backend: 'r2' | 'kv' = r2 ? 'r2' : 'kv';
  const maxSize = backend === 'r2' ? R2_MAX : KV_MAX;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: '表单解析失败' }, 400);
  }
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return json({ ok: false, error: '缺少文件' }, 400);
  }
  if (file.size > maxSize) {
    return json(
      {
        ok: false,
        error: `文件超过 ${Math.round(maxSize / MB)} MB 上限（当前 ${(file.size / MB).toFixed(1)} MB）。${
          backend === 'kv' ? '大文件请改用外链 URL 填写。' : ''
        }`,
      },
      413
    );
  }
  const type = file.type || 'application/octet-stream';
  if (!ALLOWED.test(type)) {
    return json(
      { ok: false, error: `不支持的文件类型：${type || '未知'}。仅支持图片（png/jpg/gif/webp/avif/svg）与 PDF。` },
      415
    );
  }

  // key 只保留文件名部分 —— 读取路由 /uploads/[...slug] 拿到的 slug 已去掉 /uploads 前缀，
  // 若这里再带 "uploads/" 前缀，读取侧永远命中不了（历史 bug）。
  const safe = (file.name || 'upload').replace(/[^\w.\-]+/g, '_').slice(-80);
  const key = `${Date.now()}-${safe}`;
  const buf = await file.arrayBuffer();

  try {
    if (backend === 'r2') {
      await r2.put(key, buf, { httpMetadata: { contentType: type } });
    } else {
      await kv.put(key, buf, { metadata: { contentType: type, size: file.size } });
    }
  } catch (e: any) {
    return json({ ok: false, error: `${backend.toUpperCase()} 写入失败: ${e?.message || e}` }, 500);
  }

  return json({ ok: true, url: '/uploads/' + key, backend, size: file.size, type });
};
