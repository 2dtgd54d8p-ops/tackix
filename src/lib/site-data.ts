/**
 * 站点公共数据读取（构建期使用，全站中英双语）
 * ---------------------------------------------------------------
 * 分类 / 标签 / 站点信息都来自 Keystatic singleton（后台可增删改），
 * 各页面统一从此处读取，避免每个页面各写一份映射逻辑。
 *
 * 多语言形态：所有「展示文案」字段均为 Bilingual 对象 { zh, en }。
 * 页面调用 loadSiteData(locale) / loadContent(locale) 时按当前语种取出
 * 已落定的纯字符串，后台任意字段留空即回落 DEFAULT_* 默认值。
 *
 * 为什么不用 fields.select 的动态选项：Keystatic 的 select 签名是
 * `options: readonly Option[]`（见 @keystatic/core form/fields/select），
 * 只接受静态数组、无法运行时读文件。因此文章表单里的下拉仍是静态的，
 * 而**前台展示**读取 singleton，做到后台改完即生效。
 */
import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../keystatic.config';
import { pickB, DEFAULT_LOCALE } from './i18n';
import type { Bilingual, Locale } from './i18n';

// 重新导出，方便页面从本模块直接取用
export { pickB } from './i18n';
export type { Bilingual, Locale } from './i18n';

// 知识库分类（3 个子分类）：与后台「分类管理」singleton 对齐（双语）。
// 后台未配置时回退到此默认值。
export const DEFAULT_CATEGORIES: { label: Bilingual; value: string }[] = [
  { label: { zh: '选型指南', en: 'Selection Guide' }, value: 'selection-guide' },
  { label: { zh: '应用避坑', en: 'Application Pitfalls' }, value: 'application-pitfalls' },
  { label: { zh: '故障排查', en: 'Troubleshooting' }, value: 'troubleshooting' },
];

// 与后台「标签管理」singleton 对齐（双语）。
export const DEFAULT_TAGS: { label: Bilingual; value: string }[] = [
  { label: { zh: '硅酮密封胶', en: 'Silicone Sealant' }, value: 'silicone-sealant' },
  { label: { zh: '聚氨酯', en: 'Polyurethane' }, value: 'polyurethane' },
  { label: { zh: '环氧', en: 'Epoxy' }, value: 'epoxy' },
  { label: { zh: 'MS 聚合物', en: 'MS Polymer' }, value: 'ms-polymer' },
  { label: { zh: '防水', en: 'Waterproofing' }, value: 'waterproofing' },
  { label: { zh: '防霉', en: 'Mould Resistance' }, value: 'mould-resistant' },
  { label: { zh: '瓷砖与石材', en: 'Tile & Stone' }, value: 'tile-stone' },
  { label: { zh: '伸缩缝', en: 'Expansion Joints' }, value: 'expansion-joints' },
  { label: { zh: '表面处理', en: 'Surface Prep' }, value: 'surface-prep' },
  { label: { zh: '基材', en: 'Substrate' }, value: 'substrate' },
  { label: { zh: '温度', en: 'Temperature' }, value: 'temperature' },
  { label: { zh: 'DIY', en: 'DIY' }, value: 'diy' },
  { label: { zh: '专业', en: 'Professional' }, value: 'professional' },
];

export const DEFAULT_SITE = {
  title: { zh: 'Tackix', en: 'Tackix' } as Bilingual,
  description: {
    zh: 'Tackix 是面向海外承包商、安装商与 DIY 用户的场景化工业胶粘剂与密封剂选型知识平台——提供场景方案、应用知识与直接询盘。',
    en: 'Tackix helps overseas contractors, installers and DIY users choose the right industrial adhesive or sealant for the job — with scenario-based guides, application know-how and direct inquiry.',
  } as Bilingual,
  tagline: {
    zh: '工业胶粘剂与密封剂 · 选型 · 技术 · 询盘',
    en: 'Industrial adhesives & sealants · selection · technology · inquiry',
  } as Bilingual,
  // 联系方式默认值全为空，前台会隐藏对应入口，需在后台「站点信息」填写
  email: '',
  company: '',
  phone: '',
  address: '',
  hours: '',
  whatsapp: '',
  whatsappPrefill: '',
};

const UNCATEGORIZED_LABEL: Record<Locale, string> = {
  zh: '未分类',
  en: 'Uncategorized',
};
export function uncategorizedLabel(locale: Locale): string {
  return UNCATEGORIZED_LABEL[locale] ?? UNCATEGORIZED_LABEL[DEFAULT_LOCALE];
}

/** 读 singleton；任一失败都静默回落到默认值，保证构建不中断 */
export async function loadSiteData(locale: Locale = DEFAULT_LOCALE) {
  const reader = createReader(process.cwd(), keystaticConfig);

  let categories = DEFAULT_CATEGORIES;
  let tags = DEFAULT_TAGS;
  let site = { ...DEFAULT_SITE };
  let trustTitle: Bilingual = { zh: '', en: '' };
  let trustSub: Bilingual = { zh: '', en: '' };
  let certBadges: { label: Bilingual; note: Bilingual }[] = [];

  try {
    const [cat, tag, s] = await Promise.all([
      reader.singletons.categories.read().catch(() => null),
      reader.singletons.tags.read().catch(() => null),
      reader.singletons.site.read().catch(() => null),
    ]);

    const catItems = cat?.items?.filter((c: any) => c?.value && c?.label);
    if (catItems?.length)
      categories = catItems.map((c: any) => ({
        label: c.label as Bilingual,
        value: c.value,
      }));

    const tagItems = tag?.items?.filter((t: any) => t?.value && t?.label);
    if (tagItems?.length)
      tags = tagItems.map((t: any) => ({ label: t.label as Bilingual, value: t.value }));

    if (s) {
      // ⚠️ 必须逐字段列出 singleton 的所有字段：Keystatic 的 read() 返回的就是 YAML 原样，
      // 新增字段若不显式透传就会被静默丢弃。字段已分组进 info/trust 对象（横排栅格），
      // 用 info ?? s 兼容迁移前后的数据。
      const info = s.info ?? s;
      site = {
        title: info.title as Bilingual,
        description: info.description as Bilingual,
        tagline: info.tagline as Bilingual,
        email: info.email || '',
        company: info.company || '',
        phone: info.phone || '',
        address: info.address || '',
        hours: info.hours || '',
        whatsapp: info.whatsapp || '',
        whatsappPrefill: info.whatsappPrefill || '',
      };
      const trust = s.trust ?? {};
      trustTitle = (trust.trustTitle as Bilingual) ?? { zh: '', en: '' };
      trustSub = (trust.trustSub as Bilingual) ?? { zh: '', en: '' };
      certBadges = (s.certBadges ?? [])
        .filter((b: any) => b?.label)
        .map((b: any) => ({
          label: b.label as Bilingual,
          note: (b.note ?? '') as Bilingual,
        }));
    }
  } catch (e) {
    console.warn('[build] 读取站点数据失败，使用默认值：', e);
  }

  const categoryMap = new Map(categories.map((c) => [c.value, c.label]));
  const tagMap = new Map(tags.map((t) => [t.value, t.label]));

  return {
    site: {
      title: pickB(locale, site.title) || 'Tackix',
      description: pickB(locale, site.description) || '',
      tagline: pickB(locale, site.tagline) || '',
      email: site.email,
      company: site.company,
      phone: site.phone,
      address: site.address,
      hours: site.hours,
      whatsapp: site.whatsapp,
      whatsappPrefill: site.whatsappPrefill,
      trustTitle: pickB(locale, trustTitle),
      trustSub: pickB(locale, trustSub),
      certBadges: certBadges.map((b) => ({
        label: pickB(locale, b.label),
        note: pickB(locale, b.note),
      })),
    },
    categories: categories.map((c) => ({ value: c.value, label: pickB(locale, c.label) })),
    tags: tags.map((t) => ({ value: t.value, label: pickB(locale, t.label) })),
    /** 分类值 -> 显示名；未登记的值兜底为「未分类 / Uncategorized」 */
    categoryLabel: (v: string | undefined) => {
      const key = v ?? 'uncategorized';
      if (key === 'uncategorized') return uncategorizedLabel(locale);
      return pickB(locale, categoryMap.get(key)) || key;
    },
    tagLabel: (v: string) => pickB(locale, tagMap.get(v)) || v,
  };
}

/**
 * 生成筛选/浏览分类项。
 *
 * 列出「后台 · 分类管理」里的**全部**分类（含暂时没有文章的分类），使前台
 * 浏览分类/筛选条与后台保持 1:1 同步。空分类点进去由各页空态兜底。
 */
export function buildFilterOptions(
  posts: any[],
  categories: { value: string; label: string }[],
  locale: Locale = DEFAULT_LOCALE
) {
  const hasUncategorized = posts.some(
    (p) => (p.category ?? 'uncategorized') === 'uncategorized'
  );
  return [
    { value: 'all', label: locale === 'en' ? 'All' : '全部' },
    ...(hasUncategorized
      ? [{ value: 'uncategorized', label: uncategorizedLabel(locale) }]
      : []),
    ...categories,
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// 全站静态文案默认值（后台未填时使用），全双语（zh + en）。
// 与前端各页面当前硬编码文案保持一致，保证「后台不填也不空页」，且后台可编辑。
// ═══════════════════════════════════════════════════════════════════════════

// 首页
const HOME_DEFAULT: Record<string, Bilingual> = {
  heroEyebrow: { zh: '场景化材料选型，化繁为简', en: 'Scenario-based material selection, made simple' },
  heroCta1: { zh: '浏览解决方案', en: 'Explore solutions' },
  heroCta2: { zh: '联系我们报价', en: 'Contact us for quotation' },
  scenariosTitle: { zh: '场景解决方案', en: 'Scenario Solutions' },
  scenariosSub: {
    zh: '四大高频场景，每个都给出明确推荐、推荐理由与可询盘的产品。',
    en: 'Four high-frequency jobs, each with a clear recommendation, the reasoning behind it, and products to ask about.',
  },
  knowledgeTitle: { zh: '知识库', en: 'Knowledge Base' },
  knowledgeSub: {
    zh: '面向真实工况的胶粘剂与密封剂选型指南、避坑与排障。',
    en: 'Guides, pitfalls and troubleshooting for real-world adhesive & sealant jobs.',
  },
  bandTitle: { zh: '需要量身定制的选型建议？', en: 'Need a tailored recommendation?' },
  bandSub: {
    zh: '告诉我们您的基材、工况与用量，我们的工程师会推荐合适型号并报价。',
    en: 'Tell us your substrates, conditions and volume — our engineers will recommend a grade and quote.',
  },
  bandCta1: { zh: '联系我们报价', en: 'Contact us for quotation' },
  bandCta2: { zh: '浏览知识库', en: 'Browse the Knowledge Base' },
};

const UI_NAV_DEFAULT: { label: Bilingual; href: string }[] = [
  { label: { zh: '首页', en: 'Home' }, href: '/' },
  { label: { zh: '解决方案', en: 'Solutions' }, href: '/solutions' },
  { label: { zh: '知识库', en: 'Knowledge' }, href: '/knowledge' },
  { label: { zh: '关于', en: 'About' }, href: '/about' },
  { label: { zh: '联系', en: 'Contact' }, href: '/contact' },
];
const FOOTER_DEFAULT = '';

// 联系页
const CONTACT_DEFAULT: Record<string, Bilingual> = {
  pageTitle: { zh: '联系我们', en: 'Contact Sales' },
  pageSub: {
    zh: '告诉我们您的基材、工况与用量，我们的工程师会提供针对性的选型建议与报价。',
    en: 'Tell us your substrates, operating conditions and volume — our engineers will recommend a grade and quote.',
  },
  contactInfoTitle: { zh: '联系方式', en: 'Contact Information' },
  formSectionTitle: { zh: '在线留言', en: 'Send us a message' },
  formTitle: { zh: '发送消息', en: 'Send us a message' },
  formName: { zh: '您的姓名', en: 'Your name' },
  formEmail: { zh: '商务邮箱', en: 'Business email' },
  formMsg: { zh: '您的应用场景', en: 'Your application' },
  submit: { zh: '发送询盘', en: 'Send Enquiry' },
  success: {
    zh: '感谢您的留言，我们会尽快回复。',
    en: 'Thank you — your enquiry has been received. We will reply shortly.',
  },
  prelaunchTitle: { zh: '本站尚未正式上线', en: 'This site is not yet live' },
  prelaunchBody: {
    zh: '在线表单暂时关闭，避免测试数据与真实询盘混淆。请通过邮件或 WhatsApp 直接联系我们。',
    en: 'The online form is temporarily closed. Please reach us directly by email or WhatsApp.',
  },
  tipsTitle: { zh: '留言时请包含', en: 'What to include' },
};
const CONTACT_TIPS_DEFAULT: Bilingual[] = [
  { zh: '基材（如铝、钢、PC、FRP、瓷砖、天然石材）', en: 'Substrates (e.g. aluminium, steel, PC, FRP, tile, natural stone)' },
  { zh: '载荷类型与接头活动量', en: 'Load type and joint movement' },
  { zh: '工作温度范围', en: 'Operating temperature range' },
  { zh: '固化偏好与产线节拍', en: 'Cure preference and line takt' },
  { zh: '认证要求（RoHS、REACH、FDA 等）', en: 'Certification requirements (RoHS, REACH, FDA, etc.)' },
];

// 列表页标题
const PAGES_DEFAULT: Record<string, Bilingual> = {
  knowledgeTitle: { zh: '知识库', en: 'Knowledge Base' },
  knowledgeSub: {
    zh: '共 {n} 篇 · 选型指南、应用避坑与故障排查',
    en: '{n} articles · selection guides, application pitfalls and troubleshooting',
  },
  scenariosTitle: { zh: '场景解决方案', en: 'Scenario Solutions' },
  scenariosSub: {
    zh: '选择您的工况，获取明确推荐与可询盘的产品。',
    en: 'Pick your job, get a clear recommendation and the products to ask about.',
  },
  searchPlaceholder: { zh: '搜索文章与方案…', en: 'Search articles and solutions…' },
};

// 详情页区块标题
const DETAIL_DEFAULT: Record<string, Bilingual> = {
  articleFaqTitle: { zh: '常见问题', en: 'Frequently Asked Questions' },
  articleStepsTitle: { zh: '操作步骤', en: 'Step-by-step' },
  articlePitfallsTitle: { zh: '施工避坑', en: 'Common pitfalls to avoid' },
  scenarioConclusionTitle: { zh: '一句话结论', en: 'The bottom line' },
  scenarioSelectionTitle: { zh: '选型逻辑', en: 'How to choose' },
  scenarioProductsTitle: { zh: '推荐产品', en: 'Recommended products' },
  scenarioInquiryTitle: { zh: '获取量身定制的建议', en: 'Get a tailored recommendation' },
};

// 关于页
const ABOUT_DEFAULT: Record<string, Bilingual> = {
  pageTitle: { zh: '关于 Tackix', en: 'About Tackix' },
  pageSub: {
    zh: '我们帮助海外承包商、安装商与 DIY 用户为手上的活儿选对胶粘剂或密封剂。',
    en: 'We help overseas contractors, installers and DIY users pick the right adhesive or sealant for the job.',
  },
  storyTitle: { zh: '我们的故事', en: 'Our story' },
  storyBody: {
    zh: 'Tackix 始于一个朴素的困扰：选对胶粘剂很难，而大多数技术资料默认你早已知道答案。于是我们搭建了一个以场景为先的知识库，让选对产品只需要问清几个关键问题。',
    en: 'Tackix started from a simple frustration: choosing the right adhesive is hard, and most technical datasheets assume you already know the answer. We built a scenario-first knowledge base so the right product is a few clear questions away.',
  },
  missionTitle: { zh: '我们的使命', en: 'Our mission' },
  missionBody: {
    zh: '让材料选型透明而高效——让每一位承包商、安装商与 DIY 用户都能自信地指定产品，无需猜测即可获取报价。',
    en: 'Make material selection transparent and efficient — so every contractor, installer and DIY user can specify with confidence and get a quote without the guesswork.',
  },
  factoryCaption: { zh: '我们的生产车间', en: 'Our production facility' },
};

/**
 * 读取全站静态文案单例（home/ui/contact/pages/detail/about），与默认值合并。
 * 返回结构化对象，字段均为「已按当前语种落定的纯字符串」。
 * 后台任意字段留空即回退默认值。
 */
export async function loadContent(locale: Locale = DEFAULT_LOCALE) {
  const reader = createReader(process.cwd(), keystaticConfig);
  const [home, ui, contact, pages, detail, about] = await Promise.all([
    reader.singletons.home.read().catch(() => null),
    reader.singletons.ui.read().catch(() => null),
    reader.singletons.contact.read().catch(() => null),
    reader.singletons.pages.read().catch(() => null),
    reader.singletons.detail.read().catch(() => null),
    reader.singletons.about.read().catch(() => null),
  ]) as any[];

  const h = home?.content ?? home ?? {};
  const homeOut = Object.fromEntries(
    Object.keys(HOME_DEFAULT).map((k) => [k, pickB(locale, (h[k] as Bilingual) ?? HOME_DEFAULT[k])])
  );

  const navOut = (ui?.navItems?.length ? ui.navItems : UI_NAV_DEFAULT).map((n: any, i: number) => ({
    label: pickB(locale, n.label as Bilingual) || UI_NAV_DEFAULT[i]?.label?.[locale] || (UI_NAV_DEFAULT[i]?.href ?? ''),
    href: n.href || '/',
  }));

  // footerText 兼容两种形态：后台双语对象 {zh,en} / 纯字符串
  const fbRaw: unknown = ui?.content?.footerText;
  const fbText =
    typeof fbRaw === 'string' ? fbRaw.trim() : pickB(locale, fbRaw as Bilingual | null | undefined);
  const footerText = fbText || `Powered by ${DEFAULT_SITE.title[locale] || 'Tackix'}`;

  // 后台入口标签：双语对象 {zh,en}，留空回退默认
  const faRaw: unknown = ui?.content?.footerAdminLabel;
  const footerAdminLabel =
    typeof faRaw === 'string' ? faRaw.trim() : pickB(locale, faRaw as Bilingual | null | undefined);

  const c = contact?.content ?? contact ?? {};
  const contactOut = Object.fromEntries(
    Object.keys(CONTACT_DEFAULT).map((k) => [k, pickB(locale, (c[k] as Bilingual) ?? CONTACT_DEFAULT[k])])
  ) as Record<string, string>;
  contactOut.tipsItems = (contact?.tipsItems?.length ? contact.tipsItems : CONTACT_TIPS_DEFAULT).map(
    (t: any, i: number) => {
      const d = CONTACT_TIPS_DEFAULT[i] ?? CONTACT_TIPS_DEFAULT[0];
      return pickB(locale, (t?.text as Bilingual) ?? d);
    }
  );

  const pg = pages?.content ?? pages ?? {};
  const pagesOut = Object.fromEntries(
    Object.keys(PAGES_DEFAULT).map((k) => [k, pickB(locale, (pg[k] as Bilingual) ?? PAGES_DEFAULT[k])])
  ) as Record<string, string>;

  const dt = detail?.content ?? detail ?? {};
  const detailOut = Object.fromEntries(
    Object.keys(DETAIL_DEFAULT).map((k) => [k, pickB(locale, (dt[k] as Bilingual) ?? DETAIL_DEFAULT[k])])
  ) as Record<string, string>;

  const a = about?.content ?? about ?? {};
  const aboutOut = {
    ...Object.fromEntries(
      Object.keys(ABOUT_DEFAULT).map((k) => [k, pickB(locale, (a[k] as Bilingual) ?? ABOUT_DEFAULT[k])])
    ),
    factoryImage: about?.factoryImage ?? '',
  } as Record<string, string> & { factoryImage: string };

  return {
    home: homeOut,
    ui: {
      navItems: navOut,
      footerText,
      footerAdminLabel: footerAdminLabel || (locale === 'en' ? 'Admin' : '后台管理'),
    },
    contact: contactOut,
    pages: pagesOut,
    detail: detailOut,
    about: aboutOut,
  };
}
