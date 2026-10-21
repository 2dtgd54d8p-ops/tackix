// 一键发布：触发 Cloudflare Pages Deploy Hook 重建站点（从 D1 重新抽内容）。
// 编辑保存在 D1 后，访客看到的静态页面不会改变，必须点“发布”重建一次。
export const prerender = false;

import type { APIRoute } from 'astro';
import { getEnv } from '../../../lib/env';
import { isAuthed } from '../../../lib/auth';

export const POST: APIRoute = async ({ locals }) => {
  if (!(await isAuthed(locals))) {
    return new Response(JSON.stringify({ ok: false, error: '未登录' }), { status: 401, headers: { 'content-type': 'application/json' } });
  }
  const env = getEnv(locals);
  const hook = env.PAGES_DEPLOY_HOOK;
  if (!hook) {
    return new Response(
      JSON.stringify({ ok: false, error: '未配置 PAGES_DEPLOY_HOOK（部署钩子）。请到 Cloudflare Pages 控制台创建 Deploy Hook 并设为环境变量。' }),
      { status: 400, headers: { 'content-type': 'application/json' } }
    );
  }
  try {
    const res = await fetch(hook, { method: 'POST' });
    if (!res.ok) {
      return new Response(JSON.stringify({ ok: false, error: `触发部署失败（HTTP ${res.status}）` }), { status: 502, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: true, message: '已触发重建，稍候 1–2 分钟刷新即可看到更新。' }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: '触发部署异常: ' + (e?.message || e) }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
};
