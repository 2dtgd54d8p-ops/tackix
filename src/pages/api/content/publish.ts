// 一键发布：重建站点（从 D1 重新抽内容）。
// 编辑保存在 D1 后，访客看到的静态页面不会改变，必须点“发布”重建一次。
//
// 两种触发方式（按优先级）：
//   1. PAGES_DEPLOY_HOOK —— 适用于 Pages 项目「已连接 Git 仓库」模式。
//   2. GITHUB_DISPATCH_TOKEN —— 适用于 Pages 项目「直接上传」模式（本项目现状）：
//      本项目 Pages 项目 source=undefined，无 Git 集成，Deploy Hook 不可用，
//      故改为调用 GitHub Actions 的 workflow_dispatch 触发 deploy.yml（push main 同款流程）。
export const prerender = false;

import type { APIRoute } from 'astro';
import { getEnv } from '../../../lib/env';
import { isAuthed } from '../../../lib/auth';

const JSON_HEADERS = { 'content-type': 'application/json' };

function fail(error: string, status: number) {
  return new Response(JSON.stringify({ ok: false, error }), { status, headers: JSON_HEADERS });
}

// 记录最后一次成功触发发布的时间（毫秒），供 /api/content/pending 计算「待发布」条数。
async function markPublished(env: any) {
  const kv = env?.FEEDBACK_KV || env?.MEDIA_KV;
  if (!kv) return;
  try {
    await kv.put('admin:last_publish_at', String(Date.now()));
  } catch {
    /* 记录失败不阻断发布 */
  }
}

export const POST: APIRoute = async (ctx) => {
  const { locals } = ctx;
  if (!(await isAuthed(ctx))) {
    return fail('未登录', 401);
  }

  const env = getEnv(locals);
  const hook = env.PAGES_DEPLOY_HOOK;
  const ghToken = env.GITHUB_DISPATCH_TOKEN;

  // --- 路径 1：Deploy Hook（Pages 已连 Git 时可用） ---
  if (hook) {
    try {
      const res = await fetch(hook, { method: 'POST' });
      if (!res.ok) {
        return fail(`触发部署失败（Deploy Hook HTTP ${res.status}）`, 502);
      }
      await markPublished(env);
      return new Response(
        JSON.stringify({ ok: true, via: 'deploy-hook', message: '已触发重建，稍候 1–2 分钟刷新即可看到更新。' }),
        { status: 200, headers: JSON_HEADERS }
      );
    } catch (e: any) {
      return fail('触发部署异常: ' + (e?.message || e), 500);
    }
  }

  // --- 路径 2：GitHub Actions workflow_dispatch（Pages 直接上传模式） ---
  if (ghToken) {
    const repo = env.GITHUB_REPO || '2dtgd54d8p-ops/tackix';
    const ref = env.GITHUB_DISPATCH_REF || 'main';
    const workflow = env.GITHUB_DEPLOY_WORKFLOW || 'deploy.yml';
    const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ghToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'tackix-admin-publish',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ ref }),
      });
      // GitHub 成功返回 204 No Content
      if (res.status !== 204) {
        const detail = await res.text().catch(() => '');
        return fail(
          `触发 GitHub Actions 失败（HTTP ${res.status}）${detail ? '：' + detail.slice(0, 300) : ''}`,
          502
        );
      }
      await markPublished(env);
      return new Response(
        JSON.stringify({
          ok: true,
          via: 'github-actions',
          message: `已触发 GitHub Actions 构建（${repo}@${ref}），约 1–2 分钟后自动部署完成。可在仓库 Actions 页查看进度。`,
        }),
        { status: 200, headers: JSON_HEADERS }
      );
    } catch (e: any) {
      return fail('触发 GitHub Actions 异常: ' + (e?.message || e), 500);
    }
  }

  // --- 两者都未配置 ---
  return fail(
    '未配置发布通道。二选一：① 配置 GITHUB_DISPATCH_TOKEN（本项目 Pages 为直接上传模式，推荐此项，需 repo + workflow 权限的 GitHub PAT）；' +
      '② 若 Pages 项目改为连接 Git 仓库，则可配置 PAGES_DEPLOY_HOOK（Deploy Hook URL）。',
    400
  );
};
