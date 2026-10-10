/**
 * 站点公共数据读取（构建期使用）
 * ---------------------------------------------------------------
 * 分类 / 标签 / 应用场景 / 决策阶段 / 站点信息都来自 Keystatic singleton
 * （后台可增删改），各页面统一从此处读取，避免每个页面各写一份映射逻辑。
 *
 * 为什么不用 fields.select 的动态选项：Keystatic 的 select 签名是
 * `options: readonly Option[]`（见 @keystatic/core form/fields/select），
 * 只接受静态数组、无法运行时读文件。因此文章表单里的下拉仍是静态的，
 * 而**前台展示**读取 singleton，做到后台改完即生效。
 */
import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../keystatic.config';

export const DEFAULT_CATEGORIES = [
  { label: '技术', value: 'tech' },
  { label: '产品', value: 'product' },
  { label: '随笔', value: 'notes' },
];

export const DEFAULT_TAGS = [
  { label: 'Astro', value: 'astro' },
  { label: 'Cloudflare', value: 'cloudflare' },
  { label: 'Keystatic', value: 'keystatic' },
  { label: '教程', value: 'tutorial' },
];

// 应用场景（胶粘剂/密封剂典型行业）—— 与 keystatic.config 的 SCENARIO_OPTIONS 保持一致
export const DEFAULT_SCENARIOS = [
  { label: '电子封装', value: 'electronics' },
  { label: '汽车制造', value: 'automotive' },
  { label: '新能源', value: 'newenergy' },
  { label: '建筑工程', value: 'construction' },
  { label: '包装印刷', value: 'packaging' },
  { label: '医疗器械', value: 'medical' },
  { label: '通用工业', value: 'general' },
];

// 决策阶段（内容按买家旅程组织：认知 → 评估 → 决策）
export const DEFAULT_STAGES = [
  { label: '认知阶段', value: 'awareness' },
  { label: '评估阶段', value: 'consideration' },
  { label: '决策阶段', value: 'decision' },
];

export const DEFAULT_SITE = {
  title: 'Tackix',
  description:
    'Tackix 是面向工业胶粘剂与密封剂行业的垂直平台，提供产品数据库、选型工具、技术文章与案例库，支持多语言与在线询盘。',
  tagline: '工业胶粘剂与密封剂 · 选型 · 技术 · 询盘',
  whatsapp: '',
};

const UNCATEGORIZED_LABEL = '未分类';

/** 读 singleton；任一失败都静默回落到默认值，保证构建不中断 */
export async function loadSiteData() {
  const reader = createReader(process.cwd(), keystaticConfig);

  let categories = DEFAULT_CATEGORIES;
  let tags = DEFAULT_TAGS;
  let site = { ...DEFAULT_SITE };

  try {
    const [cat, tag, s] = await Promise.all([
      reader.singletons.categories.read().catch(() => null),
      reader.singletons.tags.read().catch(() => null),
      reader.singletons.site.read().catch(() => null),
    ]);

    const catItems = cat?.items?.filter((c) => c?.value && c?.label);
    if (catItems?.length) categories = catItems.map((c) => ({ label: c.label, value: c.value }));

    const tagItems = tag?.items?.filter((t) => t?.value && t?.label);
    if (tagItems?.length) tags = tagItems.map((t) => ({ label: t.label, value: t.value }));

    if (s) {
      site = {
        title: s.title || DEFAULT_SITE.title,
        description: s.description || DEFAULT_SITE.description,
        tagline: s.tagline || DEFAULT_SITE.tagline,
        whatsapp: s.whatsapp || '',
      };
    }
  } catch (e) {
    console.warn('[build] 读取站点数据失败，使用默认值：', e);
  }

  const categoryMap = new Map(categories.map((c) => [c.value, c.label]));
  const tagMap = new Map(tags.map((t) => [t.value, t.label]));
  const scenarioMap = new Map(DEFAULT_SCENARIOS.map((c) => [c.value, c.label]));
  const stageMap = new Map(DEFAULT_STAGES.map((c) => [c.value, c.label]));

  return {
    site,
    categories,
    tags,
    /** 分类值 -> 中文名；未登记的值兜底为「未分类」，不把英文原值暴露给访客 */
    categoryLabel: (v: string | undefined) => {
      const key = v ?? 'uncategorized';
      return key === 'uncategorized' ? UNCATEGORIZED_LABEL : categoryMap.get(key) ?? UNCATEGORIZED_LABEL;
    },
    tagLabel: (v: string) => tagMap.get(v) ?? v,
    /** 应用场景值 -> 中文名（空值返回空串，便于调用方判断是否有值） */
    scenarioLabel: (v: string | undefined) => (v ? scenarioMap.get(v) ?? '' : ''),
    /** 决策阶段值 -> 中文名 */
    stageLabel: (v: string | undefined) => (v ? stageMap.get(v) ?? '' : ''),
  };
}

/**
 * 生成只含有文章的筛选项。
 * `uncategorized` 是系统内置分类，不在管理表里，但只要有文章未分类
 * 就必须出现在筛选条上，否则这些文章将无处可去。
 */
export function buildFilterOptions(posts: any[], categories: any[]) {
  const hasUncategorized = posts.some(
    (p) => (p.category ?? 'uncategorized') === 'uncategorized'
  );
  return [
    { value: 'all', label: '全部' },
    ...(hasUncategorized ? [{ value: 'uncategorized', label: UNCATEGORIZED_LABEL }] : []),
    ...categories.filter((c) => posts.some((p) => p.category === c.value)),
  ];
}

export { UNCATEGORIZED_LABEL };
