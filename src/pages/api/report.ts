// 内容表现报表（L7 冷热报告）：聚合 Cloudflare KV（FEEDBACK_KV）里的反馈数据，
// 给运营/编辑一份「内容冷热」与「需求缺口」视图。
//
// 数据来源（与 /api/feedback、/api/subscribe 共用同一 KV）：
//   - 文章有帮助反馈：fb:<slug>        = { yes, no, notes:[] }
//   - 搜索无结果需求：fb:search:<term>  = { yes:0, no:1, notes:[用户留言] }
//
// 鉴权：必须设置 ADMIN_TOKEN 环境变量才会启用；未设置 → ok:false reason:'not configured'。
//   启用后通过 ?token=xxx 或 Authorization: Bearer xxx 校验，错误 → 401。
//   这是后端门控特性：无 KV 绑定或无令牌时一律优雅降级（不抛错、不影响静态站点）。
export const prerender = false;

import type { APIRoute } from 'astro';

interface ReportEnv {
  FEEDBACK_KV?: {
    list(opts: { prefix?: string; cursor?: string }): Promise<{
      keys: { name: string }[];
      list_complete: boolean;
      cursor?: string;
    }>;
    get(key: string): Promise<string | null>;
  };
  ADMIN_TOKEN?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ request, locals, url }) => {
  try {
    const env = (locals as any)?.runtime?.env as ReportEnv | undefined;

    // 后端未配置：优雅降级
    if (!env?.FEEDBACK_KV) {
      return json({ ok: false, reason: 'no KV binding' });
    }
    // 未设置管理令牌：报表默认关闭（避免暴露访客提交的自由文本）
    if (!env?.ADMIN_TOKEN) {
      return json({ ok: false, reason: 'not configured' });
    }
    // 校验令牌：?token= 或 Authorization: Bearer
    const q = url.searchParams.get('token');
    const auth = request.headers.get('authorization');
    const bearer = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
    const provided = q || bearer;
    if (!provided || provided !== env.ADMIN_TOKEN) {
      return json({ ok: false, reason: 'unauthorized' }, 401);
    }

    // 分页拉取全部 fb: 前缀的 KV 键
    const items: Array<{ key: string; yes: number; no: number; notes: string[] }> = [];
    let cursor: string | undefined;
    do {
      const res = await env.FEEDBACK_KV.list({ prefix: 'fb:', cursor });
      for (const k of res.keys) {
        let obj: any = { yes: 0, no: 0, notes: [] };
        try {
          const raw = await env.FEEDBACK_KV!.get(k.name);
          if (raw) obj = JSON.parse(raw);
        } catch {
          /* 损坏的键跳过 */
        }
        items.push({
          key: k.name,
          yes: Number(obj.yes) || 0,
          no: Number(obj.no) || 0,
          notes: Array.isArray(obj.notes) ? obj.notes.map(String) : [],
        });
      }
      cursor = res.list_complete ? undefined : res.cursor;
    } while (cursor);

    const content: Array<{ slug: string; yes: number; no: number; total: number; rate: number }> = [];
    const gaps: Array<{ term: string; count: number; notes: string[] }> = [];
    let feedbackEvents = 0;

    for (const it of items) {
      const slug = it.key.replace(/^fb:/, '');
      feedbackEvents += it.yes + it.no;
      if (slug.startsWith('search:')) {
        const term = slug.slice('search:'.length);
        gaps.push({ term, count: it.no, notes: it.notes });
      } else {
        const total = it.yes + it.no;
        const rate = total ? it.yes / total : 0;
        content.push({ slug, yes: it.yes, no: it.no, total, rate });
      }
    }

    // 热文：有帮助次数高（降序）；冷文：有帮助为 0 或好评率 < 50%（按差评数降序）
    content.sort((a, b) => b.yes - a.yes);
    const hot = content.filter((c) => c.yes > 0).slice(0, 10);
    const cold = content
      .filter((c) => c.yes === 0 || c.rate < 0.5)
      .sort((a, b) => b.no - a.no)
      .slice(0, 10);
    // 需求缺口：按被搜索无结果次数降序
    gaps.sort((a, b) => b.count - a.count);

    return json({
      ok: true,
      generatedAt: new Date().toISOString(),
      totals: {
        articlesRated: content.length,
        feedbackEvents,
        gaps: gaps.length,
      },
      hot,
      cold,
      gaps,
    });
  } catch (e) {
    return json({ ok: false, reason: 'error' });
  }
};
