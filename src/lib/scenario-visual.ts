// 场景主题色与语义图标（首页场景卡 + 案例库共用，单一来源）。
// 按 slug 稳定映射；未命中回退调色板轮换。纯色，供 color-mix 使用。

export const SOL_COLORS = ['#7c4df0', '#18a06a', '#f0883e', '#3a7bff', '#e0457b', '#12a0c9'];

export const SCENARIO_COLORS: Record<string, string> = {
  'kitchen-bath-mould': '#7c4df0',
  'window-door-leak': '#3a7bff',
  'tile-grout': '#18a06a',
  'roof-waterproof': '#f0883e',
};

export function sColor(slug: string, i: number): string {
  return SCENARIO_COLORS[slug] ?? SOL_COLORS[i % SOL_COLORS.length];
}

const SCENARIO_ICONS: Record<string, string> = {
  'kitchen-bath-mould':
    '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  'window-door-leak': '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 4v16M4 12h16"/>',
  'tile-grout':
    '<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M9 4v7M15 13v7"/>',
  'roof-waterproof':
    '<path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9z"/><path d="M12 12v6a2 2 0 0 0 4 0"/>',
};

export function sIcon(slug: string): string {
  const inner =
    SCENARIO_ICONS[slug] ??
    '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>';
  return `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}
