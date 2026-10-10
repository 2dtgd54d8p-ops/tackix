/**
 * 预上线闸门（prelaunch gate）
 * ---------------------------------------------------------------
 * 站点在「内容已就绪但未正式发布」阶段使用：对外仍可访问（方便内部评审、
 * 客户预览、发朋友圈演示），但**不被搜索引擎与 AI 检索体收录**，避免
 * 演示内容（占位参数、编造的规格、无 TDS 的产品）污染正式上线的索引与快照。
 *
 * 设计原则：**开关只有一处**，上线时不改任何页面代码。
 *   方式 A（推荐）：在 Cloudflare Pages → Settings → Environment variables
 *                  把 `PRELAUNCH` 设为 `0`（或删除该变量）。
 *   方式 B：改 src/lib/prelaunch.ts 的 DEFAULT_PRELAUNCH 为 false。
 *
 * 为什么同时管 robots meta 与 hreflang：
 *   - noindex, nofollow：阻止收录与权重传递，是主开关
 *   - noarchive：不要求搜索引擎存快照（避免下线后快照仍可访问）
 *   - 同时**不输出 canonical 与 hreflang**：canonical 等于告诉 Google
 *     「这个 URL 是该内容的权威地址」，与 noindex 自相矛盾；hreflang
 *     则会把「中英互指」关系提交给搜索引擎，属于主动请求收录。
 *   - robots.txt 侧另加 `X-Robots-Tag` 头做双保险（见 _headers）。
 */

/** 默认值：true = 预上线（未收录）。上线时改为 false 或用 env 覆盖为 '0'。 */
const DEFAULT_PRELAUNCH = true;

/** 视为「正式上线」的环境变量取值 */
const OFF_VALUES = new Set(['0', 'false', 'off', 'no', '']);

/**
 * 是否处于预上线状态。
 * 读取 `PUBLIC_PRELAUNCH`（PUBLIC_ 前缀才能在构建期注入到客户端可见 env），
 * 未设置时回落到 DEFAULT_PRELAUNCH。
 */
export function isPreLaunch(): boolean {
  const raw =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.PUBLIC_PRELAUNCH) ??
    (typeof process !== 'undefined' ? (process as any).env?.PUBLIC_PRELAUNCH : undefined);

  if (raw === undefined || raw === null) return DEFAULT_PRELAUNCH;

  const v = String(raw).trim().toLowerCase();
  return !OFF_VALUES.has(v);
}

/**
 * 预上线期间给用户看的提示横幅文案。
 * 返回 null 表示已正式上线，不显示横幅。
 */
export function prelaunchBanner(): { title: string; body: string } | null {
  if (!isPreLaunch()) return null;
  return {
    title: '预览版 · 尚未正式发布',
    body: '本站内容正在完善中，暂不参与搜索引擎收录。正式上线后将提供完整产品资料与在线询盘。',
  };
}