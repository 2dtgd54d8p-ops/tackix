import { config, collection, singleton, fields } from '@keystatic/core';
import { createElement } from 'react';
// 文章「分类」「标签」下拉选项：由 scripts/gen-content-options.mjs 从后台
// 「分类管理」「标签管理」singleton（仓库根 categories/index.yaml、tags/index.yaml）
// 在构建期生成。改后台即自动跟随，不再手改本文件。
import { CATEGORY_OPTIONS, TAG_OPTIONS } from './src/generated/content-options';

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
//   (src/content/knowledge|scenarios/*.yaml) 读取并写死进 HTML —— 它不调用 GitHub API，也【完全忽略】
//   下面的 storage 配置。所以 Keystatic 提交新内容后，必须"重新构建 + 部署"，页面才会出现
//   新内容。本仓库用 .github/workflows/deploy.yml 在每次 push 到 main（含 Keystatic 的提交）
//   时自动重建部署，从根本上解决"新增内容页面不显示"的问题。
// 横排栅格辅助：Keystatic 0.6.9 仅在 fields.object 内支持 layout（12 栅格）。
const h2 = (n: number): number[] => Array.from({ length: n * 2 }, () => 6);

/**
 * 安全读取环境变量（仅服务端使用）。
 * ⚠️ 本文件会被打进浏览器端（/keystatic 后台的 astro-island 会 `import config from
 *   "/keystatic.config.ts"`），而**浏览器里没有 `process` 全局量**。此前直接写
 *   `process.env.PUBLIC_GITHUB_OWNER`，在浏览器求值时抛 `ReferenceError: process is not defined`
 *   → 整个 config 模块加载失败 → astro-island 报错、/keystatic 后台**白屏**。
 *   故所有 env 读取必须走本函数做 typeof 短路保护。
 */
const env = (key: string): string | undefined => {
  try {
    return typeof process !== 'undefined' ? process.env?.[key] : undefined;
  } catch {
    return undefined;
  }
};

/**
 * 是否 local 模式。
 * ⚠️ 不能在浏览器端用 env() 判断：浏览器没有 process，读不到 KEYSTATIC_USE_LOCAL，
 *   会一律得到 false → 本地 dev 也被当成 github 模式渲染「Log in with GitHub」。
 *   所以改用 __KEYSTATIC_USE_LOCAL__ 这个**构建期常量**：
 *   - 服务端：由下方 astro.config.mjs 的 vite.define 注入 process.env 的真实值；
 *   - 浏览器端：同样被 define 替换，值在构建那一刻就已确定。
 */
declare const __KEYSTATIC_USE_LOCAL__: boolean;
const useLocal =
  typeof __KEYSTATIC_USE_LOCAL__ !== 'undefined'
    ? __KEYSTATIC_USE_LOCAL__
    : env('KEYSTATIC_USE_LOCAL') === '1';

// CATEGORY_OPTIONS / TAG_OPTIONS 现在从 ./src/generated/content-options 导入，
// 该文件由 scripts/gen-content-options.mjs 依据后台「分类管理」「标签管理」
// singleton 在构建期生成（见文件顶部 import）。增删分类/标签只需改后台。

const storage = useLocal
  ? ({ kind: 'local' } as const)
  : ({
      kind: 'github' as const,
      repo: {
        // 兜底写死（非机密）；若运行时配了同名的公开变量则优先用它
        owner: env('PUBLIC_GITHUB_OWNER') || '2dtgd54d8p-ops',
        name: env('PUBLIC_GITHUB_REPO') || 'tackix',
      },
    } as const);

/**
 * 双语字段构造器：任意文本字段都包成 { zh, en } 两个子字段，
 * 后台分别填写中文 / 英文，前台按当前语种 pick。
 */
const bi = (
  label: string,
  opts: { multiline?: boolean; description?: string } = {}
) =>
  fields.object(
    {
      zh: fields.text({ label: '中文', multiline: opts.multiline, description: opts.description }),
      en: fields.text({ label: 'English', multiline: opts.multiline, description: opts.description }),
    },
    { label }
  );

export default config({
  storage,

  // 后台 UI 语言（仅影响 Keystatic 自身 chrome，不影响内容字段——内容字段用上面的 bi()
  // 显式标注「中文 / English」子标签）。中文后台更符合运营习惯。
  locale: 'zh-CN',

  // 后台侧边栏顶部的品牌位。渲染成指向站点首页的链接（新标签页打开，不覆盖后台）。
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
            title: '在新标签打开站点首页',
            'aria-label': '在新标签打开站点首页',
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
            createElement('path', { d: 'M3 10.5 12 3l9 7.5' }),
            createElement('path', { d: 'M5 9.5V21h14V9.5' }),
            createElement('path', { d: 'M9.5 21v-6h5v6' })
          )
        ),
    },
  },

  collections: {
    // 知识库文章（中英双语）。分类下拉选项来自 CATEGORY_OPTIONS（构建期 codegen）。
    knowledge: collection({
      label: 'Knowledge Articles',
      slugField: 'title', // 由标题自动生成 URL 友好的 slug（单一英文标题，作为 URL slug 来源）
      path: 'src/content/knowledge/*',
      schema: {
        // 标题：单一字段，同时作为 URL slug 来源（建议用英文，保证 URL 稳定）
        title: fields.slug({ name: fields.text({ label: 'Title (also URL slug, English recommended)' }) }),
        // 展示标题：中英双语，卡片/详情页按当前语种取用
        name: bi('Display title'),
        excerpt: bi('Excerpt', { multiline: true }),
        publishedAt: fields.date({ label: 'Publish date' }),
        // 草稿开关：false 的文章不会被构建进站点
        published: fields.checkbox({ label: 'Published', defaultValue: true }),
        featured: fields.checkbox({ label: 'Show on home', defaultValue: false }),
        // 分类下拉选项来自 `src/generated/content-options.ts` 的 CATEGORY_OPTIONS，
        // 该文件由 `scripts/gen-content-options.mjs` 在 predev/prebuild 阶段从
        // 后台「分类管理」singleton（categories/index.yaml）构建期生成。
        category: fields.select({
          label: 'Category',
          options: [
            { label: 'Uncategorized', value: 'uncategorized' },
            ...CATEGORY_OPTIONS,
          ],
          defaultValue: 'uncategorized',
        }),
        // 标签多选选项来自 `src/generated/content-options.ts` 的 TAG_OPTIONS
        tags: fields.multiselect({
          label: 'Tags',
          options: TAG_OPTIONS,
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
              question: bi('Question'),
              answer: bi('Answer', { multiline: true }),
            },
            { label: 'Q&A' }
          ),
          { label: 'FAQ' }
        ),
        // 结构化步骤：驱动详情页「操作步骤」区块 + HowTo 结构化数据。
        // 勾选 pitfall 的条目以「避坑提示」警示样式渲染，并【不】计入 HowTo 的编号步骤，
        // 从而把「施工避坑」类内容自然转成 HowTo 富媒体结果，又不污染步骤序列。
        steps: fields.array(
          fields.object(
            {
              title: bi('Step title'),
              text: bi('Step description', { multiline: true }),
              pitfall: fields.checkbox({
                label: 'Pitfall / caution (render as warning, exclude from numbered steps)',
                defaultValue: false,
              }),
            },
            { label: 'Step' }
          ),
          { label: 'Step-by-step (drives HowTo)' }
        ),
        // 图片会经 GitHub App 提交到仓库 public/uploads/，构建时由静态资源直接产出
        cover: fields.image({
          label: 'Cover image',
          directory: 'public/uploads',
          publicPath: '/uploads/',
        }),
        // 富文本编辑器（ProseMirror）：编辑体验带工具栏，但序列化后仍是 Markdown 字符串。
        // 双语正文：中英各一份 mdx.inline。
        body: fields.object(
          {
            zh: fields.mdx.inline({ label: '正文（中文）' }),
            en: fields.mdx.inline({ label: 'Body (English)' }),
          },
          { label: 'Body' }
        ),
      },
    }),
    // 场景方案：4 个高频场景，产品以占位嵌入，不单独建库。中英双语。
    scenarios: collection({
      label: 'Scenario Solutions',
      slugField: 'title',
      path: 'src/content/scenarios/*',
      schema: {
        title: fields.slug({ name: fields.text({ label: 'Scenario title (also URL slug, English recommended)' }) }),
        name: bi('Display title'),
        excerpt: bi('Excerpt', { multiline: true }),
        published: fields.checkbox({ label: 'Published', defaultValue: true }),
        featured: fields.checkbox({ label: 'Show on home', defaultValue: false }),
        // 首句直接结论（双语）：回答「这个场景该用什么」，置于页面顶部
        conclusion: bi('Bottom-line recommendation', {
          multiline: true,
          description:
            'e.g. For mould and leaks in kitchens and bathrooms, use a fungicidal flexible sealant rated for continuous water contact.',
        }),
        // 选型逻辑要点（3-5 条）
        selectionLogic: fields.array(
          fields.object({ point: bi('Point') }, { label: 'Point' }),
          { label: 'Selection logic' }
        ),
        // 推荐产品占位（2-3 个），参数用占位符如 [movement capability] / [temperature range]
        recommendedProducts: fields.array(
          fields.object({
            name: bi('Recommended product placeholder (e.g. Product A)'),
            params: bi('Parameter placeholders (e.g. [movement capability] / [temperature range])'),
          }, { label: 'Recommended product' }),
          { label: 'Recommended products' }
        ),
        faq: fields.array(
          fields.object(
            { question: bi('Question'), answer: bi('Answer', { multiline: true }) },
            { label: 'Q&A' }
          ),
          { label: 'FAQ' }
        ),
        inquiryCta: bi('Inquiry button text', { description: 'e.g. Get a tailored recommendation' }),
        cover: fields.image({ label: 'Cover image', directory: 'public/uploads', publicPath: '/uploads/' }),
        body: fields.object(
          {
            zh: fields.mdx.inline({ label: '正文（中文，可选）' }),
            en: fields.mdx.inline({ label: 'Body (English, optional)' }),
          },
          { label: 'Body' }
        ),
      },
    }),
  },

  singletons: {
    // 站点 & 公司信息（中英双语）。联系方式留空则不渲染对应入口。
    site: {
      label: 'Site & Company',
      schema: {
        // 站点/联系信息分组
        info: fields.object(
          {
            title: bi('Site title'),
            description: bi('Site description', { multiline: true }),
            // 首页 Hero 区那句主标语，留空则回落到默认文案
            tagline: bi('Homepage tagline'),
            // 商务邮箱（询盘主通道，兼顾 Gmail/Outlook/企业邮箱）—— 语言无关，单语
            email: fields.text({
              label: 'Business email',
              description: 'e.g. sales@tackix.com. Leave empty to hide the email entry.',
              validation: { pattern: { regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email format' } },
            }),
            // 公司全称：用于页脚署名与联系页主体信息，影响 B2B 买家的商业信任判断
            company: fields.text({ label: 'Company name', description: 'e.g. Tackix Materials Co., Ltd.' }),
            // 办公电话（含国家码，用于电话咨询与部分地区的采购流程要求）
            phone: fields.text({
              label: 'Phone',
              description: 'Include country code, e.g. +65 6xxx xxxx. Leave empty to hide.',
            }),
            // 全站 WhatsApp 号码（仅数字，含国家码）；留空则前台不显示 WhatsApp 悬浮按钮
            whatsapp: fields.text({
              label: 'WhatsApp number',
              description: 'Digits only, with country code. Leave empty to hide the WhatsApp entry.',
            }),
            // 办公地址（部分工程/采购流程需要登记供应商地址，影响资质审核）
            address: fields.text({ label: 'Address', multiline: true, description: 'Leave empty to hide.' }),
            // 营业时间：海外买家判断能否及时回复的参考
            hours: fields.text({ label: 'Business hours', description: 'e.g. Mon-Fri 09:00-18:00 (GMT+8)' }),
            // WhatsApp 预填话术：不同页面入口用不同引导语，提升回复率
            whatsappPrefill: fields.text({
              label: 'WhatsApp prefill message',
              description: 'Text pre-filled when a buyer opens the WhatsApp chat. Falls back to a default if empty.',
            }),
          },
          { label: 'Site & Contact Info' }
        ),
        // 信任带（首页 CTA 之上 / 关于页）：一句话 + 副标题
        trust: fields.object(
          {
            trustTitle: bi('Trust band title'),
            trustSub: bi('Trust band subtitle', { multiline: true }),
          },
          { label: 'Trust Band' }
        ),
        // 认证 / 信任徽章（关于页与首页信任带可复用）
        certBadges: fields.array(
          fields.object(
            {
              label: bi('Badge label', { description: 'e.g. ISO 9001' }),
              note: bi('Badge note', { multiline: true, description: 'Short description shown under the badge.' }),
            },
            { label: 'Badge' }
          ),
          { label: 'Certifications / Trust Badges' }
        ),
      },
    },
    // 分类管理：分类从此处可增删改，不再写死在代码里。
    categories: {
      label: 'Categories',
      schema: {
        items: fields.array(
          fields.object(
            {
              label: bi('Display name', {
                description: 'Text shown on the filter bar and article cards, e.g. "Selection Guide".',
              }),
              value: fields.text({
                label: 'Value (slug)',
                description:
                  'Unique English identifier written to article frontmatter, e.g. selection-guide. Do not change once articles use it.',
              }),
            },
            { label: 'Category' }
          ),
          {
            label: 'Category items',
            itemLabel: (props) =>
              (props.fields.label.value?.zh as string) ||
              (props.fields.label.value?.en as string) ||
              'Untitled',
          }
        ),
      },
    },
    // 标签管理：与分类同构，但支持一篇多选（tags 是 multiselect）。
    tags: {
      label: 'Tags',
      schema: {
        items: fields.array(
          fields.object(
            {
              label: bi('Display name', { description: 'Text shown on the frontend, e.g. "Silicone Sealant".' }),
              value: fields.text({
                label: 'Value (slug)',
                description: 'Unique English identifier written to article frontmatter, e.g. silicone-sealant.',
              }),
            },
            { label: 'Tag' }
          ),
          {
            label: 'Tag items',
            itemLabel: (props) =>
              (props.fields.label.value?.zh as string) ||
              (props.fields.label.value?.en as string) ||
              'Untitled',
          }
        ),
      },
    },
    // ── 内容文案单例：把前端静态文案收归后台编辑，实现「所有模块均可编辑、前后端贯通」
    //    字段均为「覆盖式」：后台不填则前端用默认值（见 src/lib/site-data.ts 的 DEFAULT_*）。

    home: {
      label: 'Homepage Content',
      schema: {
        content: fields.object(
          {
            heroEyebrow: bi('Hero eyebrow', { description: 'Small label above the hero title' }),
            heroCta1: bi('Hero button 1', { description: 'e.g. "Explore solutions"' }),
            heroCta2: bi('Hero button 2', { description: 'e.g. "Contact us for quotation"' }),
            scenariosTitle: bi('Scenarios section title'),
            scenariosSub: bi('Scenarios section subtitle', { multiline: true }),
            knowledgeTitle: bi('Knowledge section title'),
            knowledgeSub: bi('Knowledge section subtitle', { multiline: true }),
            bandTitle: bi('CTA band title'),
            bandSub: bi('CTA band subtitle', { multiline: true }),
            bandCta1: bi('CTA band button 1'),
            bandCta2: bi('CTA band button 2'),
          },
          { label: 'Homepage Copy' }
        ),
      },
    },

    ui: {
      label: 'Global UI Text',
      schema: {
        navItems: fields.array(
          fields.object({
            label: bi('Nav label'),
            href: fields.text({ label: 'Link', description: 'e.g. /solutions' }),
          }, { label: 'Nav item' }),
          { label: 'Main navigation' }
        ),
        // 页脚署名
        content: fields.object(
          {
            footerText: bi('Footer text', { description: 'Leave empty to fall back to the site title.' }),
          },
          { label: 'Footer' }
        ),
      },
    },

    contact: {
      label: 'Contact Page',
      schema: {
        content: fields.object(
          {
            pageTitle: bi('Page title'),
            pageSub: bi('Page subtitle', { multiline: true }),
            contactInfoTitle: bi('Contact info title'),
            formSectionTitle: bi('Form section title', { description: 'e.g. "Send us a message"' }),
            formTitle: bi('Form title'),
            formName: bi('Name field label'),
            formEmail: bi('Email field label'),
            formMsg: bi('Message field label'),
            submit: bi('Submit button'),
            success: bi('Success message', { multiline: true }),
            prelaunchTitle: bi('Prelaunch notice title'),
            prelaunchBody: bi('Prelaunch notice body', { multiline: true }),
            tipsTitle: bi('Tips title'),
          },
          { label: 'Contact Page Copy' }
        ),
        tipsItems: fields.array(
          fields.object({
            text: bi('Tip', { multiline: true }),
          }, { label: 'Tip' }),
          { label: 'Tips list' }
        ),
      },
    },

    pages: {
      label: 'List Page Titles',
      schema: {
        content: fields.object(
          {
            knowledgeTitle: bi('Knowledge list title'),
            knowledgeSub: bi('Knowledge list subtitle', { multiline: true }),
            scenariosTitle: bi('Scenarios list title'),
            scenariosSub: bi('Scenarios list subtitle', { multiline: true }),
            searchPlaceholder: bi('Search placeholder'),
          },
          { label: 'List Page Titles' }
        ),
      },
    },

    detail: {
      label: 'Detail Page Blocks',
      schema: {
        content: fields.object(
          {
            articleFaqTitle: bi('Article FAQ title'),
            articleStepsTitle: bi('Article: steps title'),
            articlePitfallsTitle: bi('Article: pitfalls (caution) title'),
            scenarioConclusionTitle: bi('Scenario: bottom-line title'),
            scenarioSelectionTitle: bi('Scenario: selection logic title'),
            scenarioProductsTitle: bi('Scenario: recommended products title'),
            scenarioInquiryTitle: bi('Scenario: inquiry CTA title'),
          },
          { label: 'Detail Page Block Titles' }
        ),
      },
    },

    about: {
      label: 'About Page',
      schema: {
        content: fields.object(
          {
            pageTitle: bi('Page title'),
            pageSub: bi('Page subtitle', { multiline: true }),
            storyTitle: bi('Story section title'),
            storyBody: bi('Story body', { multiline: true }),
            missionTitle: bi('Mission section title'),
            missionBody: bi('Mission body', { multiline: true }),
            factoryCaption: bi('Factory image caption'),
          },
          { label: 'About Page Content' }
        ),
        factoryImage: fields.image({ label: 'Factory image', directory: 'public/uploads', publicPath: '/uploads/' }),
      },
    },
  },
});
