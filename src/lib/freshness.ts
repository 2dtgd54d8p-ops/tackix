export type FreshLevel = 'fresh' | 'ok' | 'stale';

export interface Freshness {
  label: string;
  level: FreshLevel;
  days: number | null;
}

/**
 * 按发布日期计算"新鲜度"，用于详情页/列表卡片徽章。
 * ≤180 天 = fresh；超出 = stale（提示内容可能过时）；无日期 = stale。
 */
export function freshnessInfo(
  dateStr: string | number | Date | undefined,
  locale: 'zh-CN' | 'en'
): Freshness {
  if (dateStr === undefined || dateStr === null || dateStr === '') {
    return locale === 'en'
      ? { label: 'No date', level: 'stale', days: null }
      : { label: '未标注日期', level: 'stale', days: null };
  }
  const d = new Date(String(dateStr)).getTime();
  if (isNaN(d)) {
    return locale === 'en'
      ? { label: 'Invalid date', level: 'stale', days: null }
      : { label: '日期无效', level: 'stale', days: null };
  }
  const days = Math.floor((Date.now() - d) / 86400000);
  if (days < 0) {
    return { label: locale === 'en' ? 'Upcoming' : '即将发布', level: 'ok', days };
  }
  if (days <= 180) {
    return {
      label: locale === 'en' ? `Updated ${days}d ago` : `更新于 ${days} 天前`,
      level: 'fresh',
      days,
    };
  }
  return {
    label: locale === 'en' ? `Aged ${days}d ago` : `内容较旧 · ${days} 天前`,
    level: 'stale',
    days,
  };
}
