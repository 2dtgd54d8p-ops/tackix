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

// 产品类型（胶粘剂化学体系）—— 与 keystatic.config 的 PRODUCT_CATEGORY_OPTIONS 保持一致
export const DEFAULT_PRODUCT_CATEGORIES = [
  { label: '环氧树脂胶', value: 'epoxy' },
  { label: '聚氨酯胶', value: 'polyurethane' },
  { label: '丙烯酸胶', value: 'acrylic' },
  { label: '硅胶/硅酮', value: 'silicone' },
  { label: '瞬干胶(氰基丙烯酸酯)', value: 'cyanoacrylate' },
  { label: 'UV 胶', value: 'uv' },
  { label: '厌氧胶', value: 'anaerobic' },
  { label: '热熔胶', value: 'hotmelt' },
];

// 产品认证 —— 与 keystatic.config 的 CERT_OPTIONS 保持一致
export const DEFAULT_CERTS = [
  { label: 'RoHS', value: 'rohs' },
  { label: 'REACH', value: 'reach' },
  { label: 'UL', value: 'ul' },
  { label: 'FDA', value: 'fda' },
  { label: 'NSF', value: 'nsf' },
  { label: 'ISO 9001', value: 'iso9001' },
  { label: '无卤', value: 'halogen-free' },
];

// 固化方式 —— 与 keystatic.config 的 CURE_OPTIONS 保持一致
export const DEFAULT_CURE = [
  { label: '室温固化', value: 'rt' },
  { label: '加热固化', value: 'heat' },
  { label: 'UV 固化', value: 'uv' },
  { label: '湿气固化', value: 'moisture' },
  { label: '双组分混合', value: '2k' },
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
  const productCategoryMap = new Map(DEFAULT_PRODUCT_CATEGORIES.map((c) => [c.value, c.label]));
  const certMap = new Map(DEFAULT_CERTS.map((c) => [c.value, c.label]));
  const cureMap = new Map(DEFAULT_CURE.map((c) => [c.value, c.label]));

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
    /** 产品类型值 -> 中文名（空值返回空串） */
    productCategoryLabel: (v: string | undefined) => (v ? productCategoryMap.get(v) ?? '' : ''),
    /** 认证值 -> 中文名（空值返回原值） */
    certLabel: (v: string) => certMap.get(v) ?? v,
    /** 固化方式值 -> 中文名（空值返回空串） */
    cureLabel: (v: string | undefined) => (v ? cureMap.get(v) ?? '' : ''),
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
