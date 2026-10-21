// 后台媒体上传：写入 R2 桶，返回可公开访问的 /uploads/<key> 路径。
export const prerender = false;

import type { APIRoute } from 'astro';
import { getEnv } from '../../../lib/env';
import { isAuthed } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!(await isAuthed(locals))) {
    return new Response(JSON.stringify({ ok: false, error: '未登录' }), { status: 401, headers: { 'content-type': 'application/json' } });
  }
  const env = getEnv(locals);
  const bucket = env.MEDIA;
  if (!bucket) {
    return new Response(JSON.stringify({ ok: false, error: 'MEDIA 未绑定（R2）' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: '表单解析失败' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return new Response(JSON.stringify({ ok: false, error: '缺少文件' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }

  const safe = (file.name || 'upload').replace(/[^\w.\-]+/g, '_');
  const key = `uploads/${Date.now()}-${safe}`;
  const buf = await file.arrayBuffer();
  try {
    await bucket.put(key, buf, { httpMetadata: { contentType: file.type || 'application/octet-stream' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: 'R2 写入失败: ' + (e?.message || e) }), { status: 500, headers: { 'content-type': 'application/json' } });
  }

  return new Response(JSON.stringify({ ok: true, url: '/' + key }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
