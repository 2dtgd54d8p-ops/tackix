import { config, collection, singleton, fields } from '@keystatic/core';
import { createElement } from 'react';

// 存储后端切换（仅决定 /keystatic 后台 UI 的数据读写来源，不影响静态站点的构建）：
// - 生产（构建 + Cloudflare Worker 运行时）一律使用 github 模式，后台经 GitHub App 读写仓库
// - 本地开发：显式设 KEYSTATIC_USE_LOCAL=1（见 package.json 的 dev 脚本）才使用 local，零配置
//
// ⚠️ 为什么不用 process.env.PUBLIC_GITHUB_OWNER 来判断？
//   本文件会被打进 Cloudflare Worker（dist/_worker.js/chunks/keystatic.config_*.mjs），并在
//   【运行时】重新求值。而 Cloudflare 的 PUBLIC_* 是【构建期】环境变量，运行时 process.env
//   里并不存在 —— 用它会误判成 local；workerd 非 Node 环境不支持 local，后台随即报
//   "The Keystatic API route is running in a non-Node.js environment..." / "not valid JSON"。
//   故这里改为：默认 github（仓库 owner/name 非机密，写死兜底），仅本地显式开关才用 local。
//
// ⚠️ 重要：静态首页的文章列表由 astro build 期用 createReader 从【本地文件系统】
//   (src/content/posts/*.yaml) 读取并写死进 index.html —— 它不调用 GitHub API，也【完全忽略】
//   下面的 storage 配置。所以 Keystatic 提交新文章后，必须“重新构建 + 部署”，首页才会出现
//   新文章。本仓库用 .github/workflows/deploy.yml 在每次 push 到 main（含 Keystatic 的提交）
//   时自动重建部署，从根本上解决“新增文章首页不显示”的问题。
const useLocal = typeof process !== 'undefined' && process.env?.KEYSTATIC_USE_LOCAL === '1';

// 文章分类下拉的可选项（Keystatic select 仅支持静态数组）。
// 与后台「分类管理」singleton 保持一致：增删分类时两处都要改。
const CATEGORY_OPTIONS = [
  { label: '技术', value: 'tech' },
  { label: '产品', value: 'product' },
  { label: '随笔', value: 'notes' },
];

// 文章标签下拉的可选项。与后台「标签管理」singleton 保持一致。
const TAG_OPTIONS = [
  { label: '选型指南', value: 'selection-guide' },
  { label: '环氧胶', value: 'epoxy' },
  { label: '聚氨酯胶', value: 'polyurethane' },
  { label: '硅酮密封胶', value: 'silicone-sealant' },
  { label: 'UV 固化胶', value: 'uv-adhesive' },
  { label: '瞬干胶', value: 'cyanoacrylate' },
  { label: '厌氧胶', value: 'anaerobic' },
  { label: '热熔胶', value: 'hotmelt' },
  { label: '基材粘接', value: 'substrate' },
  { label: '表面处理', value: 'surface-treatment' },
  { label: '结构粘接', value: 'structural-bonding' },
  { label: '密封防水', value: 'sealing' },
  { label: '耐温耐候', value: 'temperature-weather' },
  { label: '电子封装', value: 'electronics' },
  { label: '汽车制造', value: 'automotive' },
  { label: '新能源', value: 'new-energy' },
  { label: '建筑工程', value: 'construction' },
  { label: '包装印刷', value: 'packaging' },
  { label: '医疗器械', value: 'medical' },
  { label: '常见问题', value: 'faq' },
];

// 应用场景（胶粘剂/密封剂典型行业）。与 site-data DEFAULT_SCENARIOS 保持一致。
const SCENARIO_OPTIONS = [
  { label: '电子封装', value: 'electronics' },
  { label: '汽车制造', value: 'automotive' },
  { label: '新能源', value: 'newenergy' },
  { label: '建筑工程', value: 'construction' },
  { label: '包装印刷', value: 'packaging' },
  { label: '医疗器械', value: 'medical' },
  { label: '通用工业', value: 'general' },
];

// 决策阶段（买家旅程）：认知 → 评估 → 决策。
const STAGE_OPTIONS = [
  { label: '认知阶段', value: 'awareness' },
  { label: '评估阶段', value: 'consideration' },
  { label: '决策阶段', value: 'decision' },
];

// 产品类型（胶粘剂/密封剂化学体系）。与 site-data DEFAULT_PRODUCT_CATEGORIES 保持一致。
const PRODUCT_CATEGORY_OPTIONS = [
  { label: '环氧树脂胶', value: 'epoxy' },
  { label: '聚氨酯胶', value: 'polyurethane' },
  { label: '丙烯酸胶', value: 'acrylic' },
  { label: '硅胶/硅酮', value: 'silicone' },
  { label: '瞬干胶(氰基丙烯酸酯)', value: 'cyanoacrylate' },
  { label: 'UV 胶', value: 'uv' },
  { label: '厌氧胶', value: 'anaerobic' },
  { label: '热熔胶', value: 'hotmelt' },
];

// 产品认证（环保/安规）。与 site-data DEFAULT_CERTS 保持一致。
const CERT_OPTIONS = [
  { label: 'RoHS', value: 'rohs' },
  { label: 'REACH', value: 'reach' },
  { label: 'UL', value: 'ul' },
  { label: 'FDA', value: 'fda' },
  { label: 'NSF', value: 'nsf' },
  { label: 'ISO 9001', value: 'iso9001' },
  { label: '无卤', value: 'halogen-free' },
];

// 固化方式。与 site-data DEFAULT_CURE 保持一致。
const CURE_OPTIONS = [
  { label: '室温固化', value: 'rt' },
  { label: '加热固化', value: 'heat' },
  { label: 'UV 固化', value: 'uv' },
  { label: '湿气固化', value: 'moisture' },
  { label: '双组分混合', value: '2k' },
];

const storage = useLocal
  ? ({ kind: 'local' } as const)
  : ({
      kind: 'github' as const,
      repo: {
        // 兜底写死（非机密）；若运行时配了同名的公开变量则优先用它
        owner: process.env.PUBLIC_GITHUB_OWNER || '2dtgd54d8p-ops',
        name: process.env.PUBLIC_GITHUB_REPO || 'tackix',
      },
    } as const);

export default config({
  storage,

  // 后台 UI 全中文。Keystatic 内置语言包（见 @keystatic/core 的 app/l10n/locales），
  // 支持 zh-CN / zh-TW 等 33 种语言；设置后右上角用户菜单里的 "Log out" 等
  // 系统文案会自动显示为中文（"退出登录"），无需自行翻译。
  locale: 'zh-CN',

  // 后台侧边栏顶部的品牌位。这里渲染成指向站点首页的链接：
  // - 加 target="_blank"：新标签页打开，不覆盖后台本身（方便 CMS ↔ 前台对照）
  // - mark 槽位有固定尺寸约束，不能直接塞中文，否则会被压扁成竖条纹（已踩坑），
  //   所以这里只放一个矢量 SVG 图标；站点名交给 name 字段正常排版。
  // 注意用 createElement 而非 JSX —— 本文件是 .ts（不是 .tsx），且会被打进
  // Cloudflare Worker 运行时，必须避免 JSX 语法。
  ui: {
    brand: {
      name: 'Tackix',
      mark: () =>
        createElement(
          'a',
          {
            href: '/',
            target: '_blank',
            rel: 'noopener noreferrer',
            title: '在新标签页打开站点首页',
            'aria-label': '在新标签页打开站点首页',
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            },
          },
          createElement(
            'svg',
            {
              width: 26,
              height: 26,
              viewBox: '0 0 24 24',
              fill: 'none',
              stroke: 'currentColor',
              strokeWidth: 2,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              'aria-hidden': 'true',
            },
            // 小房子轮廓：明确表达"回到站点首页"
            createElement('path', { d: 'M3 10.5 12 3l9 7.5' }),
            createElement('path', { d: 'M5 9.5V21h14V9.5' }),
            createElement('path', { d: 'M9.5 21v-6h5v6' })
          )
        ),
    },
  },

  collections: {
    posts: collection({
      label: '文章',
      slugField: 'title', // 由标题自动生成 URL 友好的 slug
      path: 'src/content/posts/*',
      schema: {
        title: fields.slug({ name: { label: '标题' } }),
        excerpt: fields.text({ label: '摘要', multiline: true }),
        publishedAt: fields.date({ label: '发布日期' }),
        // 草稿开关：false 的文章不会被构建进站点（见 index.astro / [slug].astro 的过滤）
        published: fields.checkbox({ label: '已发布', defaultValue: true }),
        featured: fields.checkbox({ label: '首页置顶', defaultValue: false }),
        // ⚠️ Keystatic 的 select.options 只支持静态数组（见
        // @keystatic/core form/fields/select 的签名），无法运行时读取文件，
        // 所以这里必须硬编码。新增/删除分类要同时改两处，保证前后台一致：
        //   ① 下方 CATEGORY_OPTIONS
        //   ② 后台「分类管理」singleton（site/categories.yaml）
        // 前台首页筛选条以「分类管理」为准。
        category: fields.select({
          label: '分类',
          options: [
            { label: '未分类', value: 'uncategorized' },
            ...CATEGORY_OPTIONS,
          ],
          defaultValue: 'uncategorized',
        }),
        // ⚠️ 同 category：Keystatic select/multiselect 的 options 只支持静态数组，
        // 新增/删除标签要同时改下方 TAG_OPTIONS 和后台「标签管理」singleton。
        tags: fields.multiselect({
          label: '标签',
          options: TAG_OPTIONS,
        }),
        // 应用场景：便于按行业检索与组织内容（与 site-data DEFAULT_SCENARIOS 保持一致）
        scenario: fields.select({
          label: '应用场景',
          options: [{ label: '未指定', value: '' }, ...SCENARIO_OPTIONS],
          defaultValue: '',
        }),
        // 决策阶段：认知 / 评估 / 决策，用于按买家旅程分层内容
        stage: fields.select({
          label: '决策阶段',
          options: [{ label: '未指定', value: '' }, ...STAGE_OPTIONS],
          defaultValue: '',
        }),
        // 常见问题：渲染为 FAQ 区块并生成 FAQPage 结构化数据，利于 AI/搜索直接抽取答案
        // ⚠️ 两个 Keystatic 0.6.9 的坑（叠加后会让**所有**文章读取失败）：
        //   ① array() 第一个参数必须「直接是 schema 对象」，写成 array({label, schema:{...}}) 会把整包当 schema 解析；
        //   ② fields.text 返回的是 SlugFormField，而 array 会用 slugField 机制把元素里的 slug 类字段
        //      当作「条目唯一标识」劫持，报 "Expected never to be called"。
        // 用 fields.object 包一层即可得到非 slug 的 ObjectField，YAML 数据结构（question/answer）保持不变。
        faq: fields.array(
          fields.object(
            {
              question: fields.text({ label: '问题' }),
              answer: fields.text({ label: '答案', multiline: true }),
            },
            { label: '问答' }
          ),
          { label: '常见问题（FAQ）' }
        ),
        // 图片会经 GitHub App 提交到仓库 public/uploads/，构建时由静态资源直接产出
        cover: fields.image({
          label: '封面图',
          directory: 'public/uploads',
          publicPath: '/uploads/',
        }),
        // 富文本编辑器（ProseMirror）：编辑体验带工具栏，但序列化后仍是 Markdown 字符串，
        // 写进 YAML 的依旧是 body 字符串 —— 因此前端 marked() 无需改动，
        // 且仓库里现有文章的 body（普通 Markdown 字符串）完全兼容，零迁移。
        // 注意：不要用 fields.document（已废弃且存结构化数组），也不要用
        // fields.markdoc（存 Markdoc AST 对象，需要换渲染器）。
        body: fields.mdx.inline({ label: '正文' }),
        // ── 英文内容（T12 多语言）────────────────────────────────────────
        titleEn: fields.text({ label: '标题(EN)', description: '留空则回退中文标题' }),
        excerptEn: fields.text({ label: '摘要(EN)', multiline: true }),
        bodyEn: fields.mdx.inline({ label: '正文(EN)' }),
        // FAQ 英文译文：与 faq 同序，长度不一致时按索引安全取值（见 i18n-content.ts）
        faqEn: fields.array(
          fields.object(
            {
              question: fields.text({ label: '问题(EN)' }),
              answer: fields.text({ label: '答案(EN)', multiline: true }),
            },
            { label: 'Q&A (EN)' }
          ),
          { label: 'FAQ(EN)' }
        ),
      },
    }),
    // 产品库（B2B 核心模块）：参数化产品数据，前台做筛选/选型/询盘
    products: collection({
      label: '产品',
      slugField: 'name',
      path: 'src/content/products/*',
      schema: {
        name: fields.slug({ name: { label: '产品名称' } }),
        model: fields.text({ label: '型号' }),
        excerpt: fields.text({ label: '一句话简介', multiline: true }),
        // 草稿开关：false 不进入站点
        published: fields.checkbox({ label: '已发布', defaultValue: true }),
        featured: fields.checkbox({ label: '首页推荐', defaultValue: false }),
        // ⚠️ Keystatic select 仅支持静态数组，选项与 site-data DEFAULT_PRODUCT_CATEGORIES 保持一致
        category: fields.select({
          label: '胶粘剂类型',
          options: [{ label: '未分类', value: '' }, ...PRODUCT_CATEGORY_OPTIONS],
          defaultValue: '',
        }),
        scenario: fields.select({
          label: '应用场景',
          options: [{ label: '未指定', value: '' }, ...SCENARIO_OPTIONS],
          defaultValue: '',
        }),
        baseMaterial: fields.text({ label: '适用基材', description: '如 钢/铝/碳纤维/FRP' }),
        displacement: fields.text({ label: '间隙/涂布厚度', description: '如 0.05-2mm' }),
        tempRange: fields.text({ label: '耐温范围', description: '如 -40~150℃' }),
        cureType: fields.select({
          label: '固化方式',
          options: [{ label: '未指定', value: '' }, ...CURE_OPTIONS],
          defaultValue: '',
        }),
        viscosity: fields.text({ label: '粘度', description: '如 5000 mPa·s' }),
        certifications: fields.multiselect({ label: '认证', options: CERT_OPTIONS }),
        // PDF 经 GitHub App 提交到 public/uploads/，构建时由静态资源直接产出下载链接
        tds: fields.file({
          label: 'TDS 技术说明书(PDF)',
          directory: 'public/uploads',
          publicPath: '/uploads/',
        }),
        sds: fields.file({
          label: 'SDS 安全数据表(PDF)',
          directory: 'public/uploads',
          publicPath: '/uploads/',
        }),
        cover: fields.image({
          label: '产品图',
          directory: 'public/uploads',
          publicPath: '/uploads/',
        }),
        body: fields.mdx.inline({ label: '产品描述' }),
        // ── 英文内容（T12 多语言）────────────────────────────────────────
        // 平行字段而非独立集合：改动最小、后台可编辑、无需迁移既有数据。
        // 任一字段留空即回退中文原文（见 src/lib/i18n-content.ts 的 pick）。
        nameEn: fields.text({ label: '产品名称(EN)', description: '留空则显示中文原名' }),
        excerptEn: fields.text({ label: '一句话简介(EN)', multiline: true }),
        bodyEn: fields.mdx.inline({ label: '产品描述(EN)' }),
      },
    }),
    // 案例库：行业成功案例，关联产品库，形成 内容 → 案例 → 产品 → 询盘 的闭环
    cases: collection({
      label: '案例',
      slugField: 'title',
      path: 'src/content/cases/*',
      schema: {
        title: fields.slug({ name: { label: '案例标题' } }),
        excerpt: fields.text({ label: '一句话摘要', multiline: true }),
        published: fields.checkbox({ label: '已发布', defaultValue: true }),
        featured: fields.checkbox({ label: '推荐', defaultValue: false }),
        scenario: fields.select({
          label: '所属行业/场景',
          options: [{ label: '未指定', value: '' }, ...SCENARIO_OPTIONS],
          defaultValue: '',
        }),
        client: fields.text({ label: '客户 / 项目', description: '可匿名，如「某新能源电池厂商」' }),
        challenge: fields.text({ label: '挑战', multiline: true }),
        solution: fields.text({ label: '解决方案', multiline: true }),
        result: fields.text({ label: '成果', multiline: true }),
        // 关联产品：从产品库中选择，详情页自动生成内链（案例 → 产品）
        // ⚠️ 多选关联必须用 fields.multiRelationship（返回 string[]）；
        //    fields.relationship 是单值（string|null），传数组会报 "Must be a string"。
        products: fields.multiRelationship({
          label: '关联产品',
          collection: 'products',
        }),
        cover: fields.image({
          label: '封面图',
          directory: 'public/uploads',
          publicPath: '/uploads/',
        }),
        body: fields.mdx.inline({ label: '正文' }),
        // ── 英文内容（T12 多语言）────────────────────────────────────────
        titleEn: fields.text({ label: '案例标题(EN)' }),
        excerptEn: fields.text({ label: '一句话摘要(EN)', multiline: true }),
        challengeEn: fields.text({ label: '挑战(EN)', multiline: true }),
        solutionEn: fields.text({ label: '解决方案(EN)', multiline: true }),
        resultEn: fields.text({ label: '成果(EN)', multiline: true }),
        bodyEn: fields.mdx.inline({ label: '正文(EN)' }),
      },
    }),
  },

  singletons: {
    site: {
      label: '站点信息',
      schema: {
        title: fields.text({ label: '站点标题' }),
        description: fields.text({ label: '站点描述', multiline: true }),
        // 首页 Hero 区那句主标语，留空则回落到默认文案
        tagline: fields.text({ label: '首页标语' }),
        // 全站页脚署名（留空则只显示站点标题）
        footer: fields.text({ label: '页脚文字' }),
        // 全站 WhatsApp 号码（仅数字，含国家码，如 8613800138000）；留空则前台不显示 WhatsApp 悬浮按钮
        whatsapp: fields.text({
          label: 'WhatsApp 号码',
          description: '仅数字，含国家码。留空则不显示 WhatsApp 悬浮入口。',
        }),
      },
    },
    // 分类管理：分类从此处可增删改，不再写死在代码里。
    // 为什么需要它：Keystatic 的 fields.select 的 options 只接受静态数组
    // （见 @keystatic/core 的 form/fields/select 签名 options: readonly Option[]），
    // 不支持运行时读取文件，因此无法直接把「分类列表」变成动态数据源。
    // 折中做法：分类用一个可编辑的 singleton 来维护，文章表单仍用静态
    // 下拉框（其选项由下方 CATEGORY_OPTIONS 同步），两者保持一致。
    // 新增分类步骤：① 在此页添加一项 → ② 把同样的 label/value 加到
    // keystatic.config.ts 的 CATEGORY_OPTIONS → ③ 提交并等自动部署。
    categories: {
      label: '分类管理',
      schema: {
        items: fields.array(
          {
            label: '分类',
            schema: {
              label: fields.text({
                label: '显示名称',
                description: '前台筛选条与文章卡片上显示的文字，如「技术」',
              }),
              value: fields.text({
                label: '标识',
                description:
                  '英文唯一标识，写入文章 frontmatter，如 tech。已发布文章请勿随意修改，否则会失去对应分类。',
              }),
            },
          },
          { label: '分类项' }
        ),
      },
    },
    // 标签管理：与分类同构，但支持一篇多选（tags 是 multiselect）。
    tags: {
      label: '标签管理',
      schema: {
        items: fields.array(
          {
            label: '标签',
            schema: {
              label: fields.text({ label: '显示名称', description: '前台显示的文字，如「教程」' }),
              value: fields.text({
                label: '标识',
                description: '英文唯一标识，写入文章 frontmatter，如 tutorial',
              }),
            },
          },
          { label: '标签项' }
        ),
      },
    },
  },
});
