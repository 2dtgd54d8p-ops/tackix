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

// ── 英文内容映射（T12 补充）：产品规格值（化学体系/场景/固化/认证）的英文展示名。
//    这些下拉选项在 keystatic.config 里是静态数组、且必须与英文站一致，故此处用静态
//    默认值即可（后台改分类/标签不影响产品规格体系值）。值必须与 DEFAULT_* 的 value 对齐。
export const DEFAULT_PRODUCT_CATEGORIES_EN = [
  { label: 'Epoxy Adhesive', value: 'epoxy' },
  { label: 'Polyurethane Adhesive', value: 'polyurethane' },
  { label: 'Acrylic Adhesive', value: 'acrylic' },
  { label: 'Silicone Sealant', value: 'silicone' },
  { label: 'Cyanoacrylate (Instant)', value: 'cyanoacrylate' },
  { label: 'UV Adhesive', value: 'uv' },
  { label: 'Anaerobic Adhesive', value: 'anaerobic' },
  { label: 'Hot Melt Adhesive', value: 'hotmelt' },
];

export const DEFAULT_SCENARIOS_EN = [
  { label: 'Electronics Encapsulation', value: 'electronics' },
  { label: 'Automotive', value: 'automotive' },
  { label: 'New Energy', value: 'newenergy' },
  { label: 'Construction', value: 'construction' },
  { label: 'Packaging', value: 'packaging' },
  { label: 'Medical Devices', value: 'medical' },
  { label: 'General Industry', value: 'general' },
];

export const DEFAULT_CURE_EN = [
  { label: 'Room Temperature', value: 'rt' },
  { label: 'Heat Cure', value: 'heat' },
  { label: 'UV Cure', value: 'uv' },
  { label: 'Moisture Cure', value: 'moisture' },
  { label: 'Two-Part Mix', value: '2k' },
];

// 认证英文展示名（RoHS/REACH 等本身即国际通用写法，保持原值）
export const DEFAULT_CERTS_EN = [
  { label: 'RoHS', value: 'rohs' },
  { label: 'REACH', value: 'reach' },
  { label: 'UL', value: 'ul' },
  { label: 'FDA', value: 'fda' },
  { label: 'NSF', value: 'nsf' },
  { label: 'ISO 9001', value: 'iso9001' },
  { label: 'Halogen-Free', value: 'halogen-free' },
];

export const DEFAULT_SITE = {
  title: 'Tackix',
  description:
    'Tackix 是面向工业胶粘剂与密封剂行业的垂直平台，提供产品数据库、选型工具、技术文章与案例库，支持多语言与在线询盘。',
  tagline: '工业胶粘剂与密封剂 · 选型 · 技术 · 询盘',
  // 联系方式（P0-3）：默认值全为空，前台会隐藏对应入口，需在后台「站点信息」填写
  email: '',
  company: '',
  phone: '',
  address: '',
  hours: '',
  whatsapp: '',
  whatsappPrefill: '',
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
      // ⚠️ 这里必须**逐字段列出** singleton 的所有字段：Keystatic 的 read()
      // 返回的就是 YAML 原样，新增字段若不显式透传就会被静默丢弃
      // （P0-3 加联系字段时踩过：只有 whatsapp 生效，email/phone 等全部为 undefined）。
      site = {
        title: s.title || DEFAULT_SITE.title,
        description: s.description || DEFAULT_SITE.description,
        tagline: s.tagline || DEFAULT_SITE.tagline,
        // 联系方式（P0-3）：留空即为空串，前台据此隐藏对应入口
        email: s.email || '',
        company: s.company || '',
        phone: s.phone || '',
        address: s.address || '',
        hours: s.hours || '',
        whatsapp: s.whatsapp || '',
        whatsappPrefill: s.whatsappPrefill || '',
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

  // 英文标签映射（T12 补充）：供 /en 页面渲染规格值的英文展示名
  const productCategoryEnMap = new Map(DEFAULT_PRODUCT_CATEGORIES_EN.map((c) => [c.value, c.label]));
  const scenarioEnMap = new Map(DEFAULT_SCENARIOS_EN.map((c) => [c.value, c.label]));
  const certEnMap = new Map(DEFAULT_CERTS_EN.map((c) => [c.value, c.label]));
  const cureEnMap = new Map(DEFAULT_CURE_EN.map((c) => [c.value, c.label]));

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
    // ── 英文标签函数（T12 补充，供 /en 页面使用）──────────────────────
    productCategoryLabelEn: (v: string | undefined) => (v ? productCategoryEnMap.get(v) ?? v : ''),
    scenarioLabelEn: (v: string | undefined) => (v ? scenarioEnMap.get(v) ?? v : ''),
    certLabelEn: (v: string) => certEnMap.get(v) ?? v,
    cureLabelEn: (v: string | undefined) => (v ? cureEnMap.get(v) ?? v : ''),
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

// ═══════════════════════════════════════════════════════════════════════════
// T13：全站静态文案默认值（后台未填时使用），中英双语。
// 与前端各页面当前硬编码文案保持一致，保证「后台不填也不空页」，且后台可编辑。
// ═══════════════════════════════════════════════════════════════════════════

type Bilingual = { zh: string; en: string };
const p = (zh: string, en: string): Bilingual => ({ zh, en });

// 首页
const HOME_DEFAULT: Record<string, Bilingual> = {
  heroEyebrow: p('工业胶粘剂与密封剂 · 选型 · 技术 · 询盘', 'Industrial Adhesives & Sealants · Selection · Technology · Inquiry'),
  heroCta1: p('探索解决方案', 'Explore Solutions'),
  heroCta2: p('联系我们报价', 'Contact Us for Quotation'),
  solutionsTitle: p('解决方案', 'Solutions'),
  solutionsSub: p('从产品选型到落地应用，一站式找到适合的胶粘剂方案', 'From product selection to real-world application — find the right adhesive solution in one place'),
  browseTitle: p('浏览分类', 'Browse by Category'),
  browseSub: p('按主题快速找到你感兴趣的内容', 'Quickly find content by topic'),
  featuredTitle: p('精选推荐', 'Editor’s Picks'),
  featuredSub: p('值得优先一读的文章', 'Articles worth reading first'),
  latestTitle: p('最新文章', 'Latest Articles'),
  latestSub: p('持续记录，持续更新', 'Continuously documented and updated'),
  tagsTitle: p('热门标签', 'Popular Tags'),
  tagsSub: p('点击标签，查看同主题文章', 'Click a tag to see related articles'),
  bandTitle: p('需要选型建议？', 'Need a selection recommendation?'),
  bandSub: p('面向工业胶粘剂与密封剂行业的垂直平台，提供产品、选型、技术与案例。', 'A vertical platform for the industrial adhesive & sealant industry — products, selection, technology and cases.'),
  bandCta1: p('联系我们获取报价', 'Contact Us for Quotation'),
  bandCta2: p('浏览技术文章', 'Browse Technical Articles'),
};

const HOME_CARDS_DEFAULT: { title: Bilingual; desc: Bilingual; cta: Bilingual; href: string }[] = [
  { title: p('产品数据库', 'Product Database'), desc: p('按化学体系、固化方式与认证筛选工业胶粘剂与密封剂，查看关键参数与文档。', 'Filter industrial adhesives & sealants by chemistry, cure and certification; review key specs and docs.'), cta: p('浏览胶粘剂产品库', 'Browse the adhesive product library'), href: '/products' },
  { title: p('选型工具', 'Selection Tool'), desc: p('根据应用场景、固化需求与基材自动推荐匹配的胶型，快速缩小选型范围。', 'Auto-recommend matching adhesive types from application, cure needs and substrates to narrow your shortlist.'), cta: p('开始在线选型', 'Start online selection'), href: '/selector' },
  { title: p('应用案例', 'Application Cases'), desc: p('看同行如何在新能源、电子、汽车等场景落地胶粘剂方案与选型结果。', 'See how peers deploy adhesive solutions across new energy, electronics, automotive and more.'), cta: p('查看应用案例', 'View application cases'), href: '/cases' },
  { title: p('在线询盘', 'Online Inquiry'), desc: p('提供应用场景与技术要求，获取针对性选型建议、样品与技术文档。', 'Share your application and requirements to get tailored selection advice, samples and technical docs.'), cta: p('获取选型建议与报价', 'Get advice & quotation'), href: '/contact' },
];

// 全局界面
const UI_NAV_DEFAULT: { label: Bilingual; href: string }[] = [
  { label: p('首页', 'Home'), href: '/' },
  { label: p('产品', 'Products'), href: '/products' },
  { label: p('选型', 'Selector'), href: '/selector' },
  { label: p('案例', 'Cases'), href: '/cases' },
  { label: p('文章', 'Articles'), href: '/posts' },
  { label: p('联系', 'Contact'), href: '/contact' },
];
const FOOTER_DEFAULT: Bilingual = p('', '');

// 联系页
const CONTACT_DEFAULT = {
  contactInfoTitle: p('联系方式', 'Contact Information'),
  formSectionTitle: p('在线留言', 'Send us a message'),
  pageTitle: p('联系我们', 'Contact Sales'),
  pageSub: p('告诉我们您的基材、工况与产能，我们的技术团队将提供针对性的选型建议与报价。', 'Tell us your substrates, operating conditions and volume — our engineers will recommend a grade and quote.'),
  formTitle: p('发送消息', 'Send us a message'),
  formName: p('您的姓名', 'Your name'),
  formEmail: p('商务邮箱', 'Business email'),
  formMsg: p('您的应用场景', 'Your application'),
  submit: p('发送询盘', 'Send Enquiry'),
  success: p('感谢您的留言，我们会尽快回复。', 'Thank you — your enquiry has been received. We will reply shortly.'),
  prelaunchTitle: p('本站尚未正式上线', 'This site is not yet live'),
  prelaunchBody: p('在线表单暂时关闭，避免测试数据与真实询盘混淆。请通过邮件或 WhatsApp 直接联系我们。', 'The online form is temporarily closed. Please reach us directly by email or WhatsApp.'),
  tipsTitle: p('留言时请包含', 'What to include'),
};
const CONTACT_TIPS_DEFAULT: Bilingual[] = [
  p('基材（如铝、钢、PC、FRP）', 'Substrates (e.g. aluminium, steel, PC, FRP)'),
  p('载荷类型与接头活动量', 'Load type and joint movement'),
  p('工作温度范围', 'Operating temperature range'),
  p('固化偏好与产线节拍', 'Cure preference and line takt'),
  p('认证要求（RoHS、REACH、UL 等）', 'Certification requirements (RoHS, REACH, UL)'),
];

// 列表页标题
const PAGES_DEFAULT: Record<string, Bilingual> = {
  postsTitle: p('全部文章', 'All Articles'),
  postsSub: p('共 {n} 篇 · 记录技术、实践与思考', '{n} articles · notes on technology, practice and thinking'),
  productsTitle: p('产品库', 'Product Database'),
  productsSub: p('共 {n} 款工业胶粘剂与密封剂 · 按类型与场景筛选，支持 TDS/SDS 下载与在线询盘', '{n} industrial adhesives & sealants · filter by type and scenario, with TDS/SDS download and online inquiry'),
  casesTitle: p('客户案例', 'Customer Cases'),
  casesSub: p('共 {n} 个行业落地案例 · 真实场景中的胶粘剂选型与工艺验证', '{n} real-world cases · adhesive selection and process validation in real scenarios'),
  selectorTitle: p('产品选型', 'Adhesive Selection'),
  selectorSub: p('按应用场景、固化方式与适用基材，为您推荐匹配的工业胶粘剂与密封剂。', 'Recommend matching industrial adhesives & sealants by application, cure method and substrate.'),
  selectorResult: p('推荐结果', 'Recommended Results'),
  searchPlaceholder: p('搜索文章、产品、案例…', 'Search articles, products, cases…'),
};

// 详情页区块标题
const DETAIL_DEFAULT: Record<string, Bilingual> = {
  productSpecsTitle: p('技术参数', 'Technical Specifications'),
  productDescTitle: p('产品描述', 'Product Description'),
  productDocsTitle: p('技术文档', 'Documents'),
  productQuoteTitle: p('获取报价与技术支持', 'Get Quotation & Technical Support'),
  productQuoteCopy: p('本平台为工业胶粘剂与密封剂 B2B 渠道，所有产品按订单与规格报价。请留下需求，我们的技术团队将在 1 个工作日内回复。', 'This is a B2B channel for industrial adhesives & sealants; all products are quoted per order and specification. Leave your requirements and our team will reply within 1 business day.'),
  caseChallengeTitle: p('挑战', 'Challenge'),
  caseSolutionTitle: p('解决方案', 'Solution'),
  caseResultTitle: p('成果', 'Result'),
  caseRelatedTitle: p('本案例使用的产品', 'Products Used in This Case'),
  caseCtaTitle: p('有类似需求？', 'Have a similar need?'),
  caseCtaCopy: p('告诉我们您的基材、工况与产能，我们的技术团队将提供针对性的选型建议与样品支持。', 'Tell us your substrates, conditions and volume — our team will provide tailored selection advice and samples.'),
  faqTitle: p('常见问题（FAQ）', 'Frequently Asked Questions'),
};

/** 取双语字段：后台 zh/en 优先，缺失回退默认值 */
function pickB(def: Bilingual, zh?: string | null, en?: string | null): Bilingual {
  return {
    zh: zh && zh.trim() ? zh : def.zh,
    en: en && en.trim() ? en : def.en,
  };
}

/**
 * 兼容两种数据形态：
 * - 后台填写的 item（如 solutionCards[i]）字段是普通字符串（title / titleEn 分开）；
 * - 本地默认常量（HOME_CARDS_DEFAULT / UI_NAV_DEFAULT）字段是 Bilingual 对象。
 * 统一抽取出 zh 字符串，再交给 pickB。
 */
function zhOr(v: any): string | undefined {
  if (v && typeof v === 'object' && 'zh' in v) return (v as Bilingual).zh;
  return v;
}

/**
 * T13：读取全站静态文案单例（home/ui/contact/pages/detail），与默认值合并。
 * 返回结构化对象，前端按 locale 取 zh 或 en。后台任意字段留空即回退默认值。
 */
export async function loadContent() {
  const reader = createReader(process.cwd(), keystaticConfig);
  const [home, ui, contact, pages, detail] = await Promise.all([
    reader.singletons.home.read().catch(() => null),
    reader.singletons.ui.read().catch(() => null),
    reader.singletons.contact.read().catch(() => null),
    reader.singletons.pages.read().catch(() => null),
    reader.singletons.detail.read().catch(() => null),
  ]) as any[];

  const homeOut = {
    heroEyebrow: pickB(HOME_DEFAULT.heroEyebrow, home?.heroEyebrow, home?.heroEyebrowEn),
    heroCta1: pickB(HOME_DEFAULT.heroCta1, home?.heroCta1, home?.heroCta1En),
    heroCta2: pickB(HOME_DEFAULT.heroCta2, home?.heroCta2, home?.heroCta2En),
    solutionsTitle: pickB(HOME_DEFAULT.solutionsTitle, home?.solutionsTitle, home?.solutionsTitleEn),
    solutionsSub: pickB(HOME_DEFAULT.solutionsSub, home?.solutionsSub, home?.solutionsSubEn),
    solutionCards: (home?.solutionCards?.length ? home.solutionCards : HOME_CARDS_DEFAULT).map((c: any, i: number) => {
      const d = HOME_CARDS_DEFAULT[i] ?? HOME_CARDS_DEFAULT[0];
      return {
        title: pickB(d.title, zhOr(c.title), c.titleEn),
        desc: pickB(d.desc, zhOr(c.desc), c.descEn),
        cta: pickB(d.cta, zhOr(c.cta), c.ctaEn),
        href: c.href || d.href,
      };
    }),
    browseTitle: pickB(HOME_DEFAULT.browseTitle, home?.browseTitle, home?.browseTitleEn),
    browseSub: pickB(HOME_DEFAULT.browseSub, home?.browseSub, home?.browseSubEn),
    featuredTitle: pickB(HOME_DEFAULT.featuredTitle, home?.featuredTitle, home?.featuredTitleEn),
    featuredSub: pickB(HOME_DEFAULT.featuredSub, home?.featuredSub, home?.featuredSubEn),
    latestTitle: pickB(HOME_DEFAULT.latestTitle, home?.latestTitle, home?.latestTitleEn),
    latestSub: pickB(HOME_DEFAULT.latestSub, home?.latestSub, home?.latestSubEn),
    tagsTitle: pickB(HOME_DEFAULT.tagsTitle, home?.tagsTitle, home?.tagsTitleEn),
    tagsSub: pickB(HOME_DEFAULT.tagsSub, home?.tagsSub, home?.tagsSubEn),
    bandTitle: pickB(HOME_DEFAULT.bandTitle, home?.bandTitle, home?.bandTitleEn),
    bandSub: pickB(HOME_DEFAULT.bandSub, home?.bandSub, home?.bandSubEn),
    bandCta1: pickB(HOME_DEFAULT.bandCta1, home?.bandCta1, home?.bandCta1En),
    bandCta2: pickB(HOME_DEFAULT.bandCta2, home?.bandCta2, home?.bandCta2En),
  };

  const navOut = (ui?.navItems?.length ? ui.navItems : UI_NAV_DEFAULT).map((n: any, i: number) => {
    const d = UI_NAV_DEFAULT[i] ?? UI_NAV_DEFAULT[0];
    return {
      label: pickB(d.label, zhOr(n.label), n.labelEn),
      href: n.href || d.href,
    };
  });

  const contactOut = {
    contactInfoTitle: pickB(CONTACT_DEFAULT.contactInfoTitle, contact?.contactInfoTitle, contact?.contactInfoTitleEn),
    formSectionTitle: pickB(CONTACT_DEFAULT.formSectionTitle, contact?.formSectionTitle, contact?.formSectionTitleEn),
    pageTitle: pickB(CONTACT_DEFAULT.pageTitle, contact?.pageTitle, contact?.pageTitleEn),
    pageSub: pickB(CONTACT_DEFAULT.pageSub, contact?.pageSub, contact?.pageSubEn),
    formTitle: pickB(CONTACT_DEFAULT.formTitle, contact?.formTitle, contact?.formTitleEn),
    formName: pickB(CONTACT_DEFAULT.formName, contact?.formName, contact?.formNameEn),
    formEmail: pickB(CONTACT_DEFAULT.formEmail, contact?.formEmail, contact?.formEmailEn),
    formMsg: pickB(CONTACT_DEFAULT.formMsg, contact?.formMsg, contact?.formMsgEn),
    submit: pickB(CONTACT_DEFAULT.submit, contact?.submit, contact?.submitEn),
    success: pickB(CONTACT_DEFAULT.success, contact?.success, contact?.successEn),
    prelaunchTitle: pickB(CONTACT_DEFAULT.prelaunchTitle, contact?.prelaunchTitle, contact?.prelaunchTitleEn),
    prelaunchBody: pickB(CONTACT_DEFAULT.prelaunchBody, contact?.prelaunchBody, contact?.prelaunchBodyEn),
    tipsTitle: pickB(CONTACT_DEFAULT.tipsTitle, contact?.tipsTitle, contact?.tipsTitleEn),
    tipsItems: (contact?.tipsItems?.length ? contact.tipsItems : CONTACT_TIPS_DEFAULT).map((t: any, i: number) => {
      const d = CONTACT_TIPS_DEFAULT[i] ?? CONTACT_TIPS_DEFAULT[0];
      const zh = t?.text ?? d.zh;
      const en = t?.textEn ?? d.en;
      return pickB(d, zh, en);
    }),
  };

  const pagesOut = {
    postsTitle: pickB(PAGES_DEFAULT.postsTitle, pages?.postsTitle, pages?.postsTitleEn),
    postsSub: pickB(PAGES_DEFAULT.postsSub, pages?.postsSub, pages?.postsSubEn),
    productsTitle: pickB(PAGES_DEFAULT.productsTitle, pages?.productsTitle, pages?.productsTitleEn),
    productsSub: pickB(PAGES_DEFAULT.productsSub, pages?.productsSub, pages?.productsSubEn),
    casesTitle: pickB(PAGES_DEFAULT.casesTitle, pages?.casesTitle, pages?.casesTitleEn),
    casesSub: pickB(PAGES_DEFAULT.casesSub, pages?.casesSub, pages?.casesSubEn),
    selectorTitle: pickB(PAGES_DEFAULT.selectorTitle, pages?.selectorTitle, pages?.selectorTitleEn),
    selectorSub: pickB(PAGES_DEFAULT.selectorSub, pages?.selectorSub, pages?.selectorSubEn),
    selectorResult: pickB(PAGES_DEFAULT.selectorResult, pages?.selectorResult, pages?.selectorResultEn),
    searchPlaceholder: pickB(PAGES_DEFAULT.searchPlaceholder, pages?.searchPlaceholder, pages?.searchPlaceholderEn),
  };

  const detailOut = {
    productSpecsTitle: pickB(DETAIL_DEFAULT.productSpecsTitle, detail?.productSpecsTitle, detail?.productSpecsTitleEn),
    productDescTitle: pickB(DETAIL_DEFAULT.productDescTitle, detail?.productDescTitle, detail?.productDescTitleEn),
    productDocsTitle: pickB(DETAIL_DEFAULT.productDocsTitle, detail?.productDocsTitle, detail?.productDocsTitleEn),
    productQuoteTitle: pickB(DETAIL_DEFAULT.productQuoteTitle, detail?.productQuoteTitle, detail?.productQuoteTitleEn),
    productQuoteCopy: pickB(DETAIL_DEFAULT.productQuoteCopy, detail?.productQuoteCopy, detail?.productQuoteCopyEn),
    caseChallengeTitle: pickB(DETAIL_DEFAULT.caseChallengeTitle, detail?.caseChallengeTitle, detail?.caseChallengeTitleEn),
    caseSolutionTitle: pickB(DETAIL_DEFAULT.caseSolutionTitle, detail?.caseSolutionTitle, detail?.caseSolutionTitleEn),
    caseResultTitle: pickB(DETAIL_DEFAULT.caseResultTitle, detail?.caseResultTitle, detail?.caseResultTitleEn),
    caseRelatedTitle: pickB(DETAIL_DEFAULT.caseRelatedTitle, detail?.caseRelatedTitle, detail?.caseRelatedTitleEn),
    caseCtaTitle: pickB(DETAIL_DEFAULT.caseCtaTitle, detail?.caseCtaTitle, detail?.caseCtaTitleEn),
    caseCtaCopy: pickB(DETAIL_DEFAULT.caseCtaCopy, detail?.caseCtaCopy, detail?.caseCtaCopyEn),
    faqTitle: pickB(DETAIL_DEFAULT.faqTitle, detail?.faqTitle, detail?.faqTitleEn),
  };

  return {
    home: homeOut,
    ui: {
      navItems: navOut,
      footerText: pickB(FOOTER_DEFAULT, ui?.footerText, ui?.footerTextEn),
    },
    contact: contactOut,
    pages: pagesOut,
    detail: detailOut,
  };
}
