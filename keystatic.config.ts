import { config, collection, singleton, fields } from '@keystatic/core';
import { createElement } from 'react';
// 文章「分类」「标签」下拉选项：由 scripts/gen-content-options.mjs 从后台
// 「分类管理」「标签管理」singleton（仓库根 categories/index.yaml、tags/index.yaml）
// 在构建期生成。改后台即自动跟随，不再手改本文件。
import { CATEGORY_OPTIONS, TAG_OPTIONS, SCENARIO_OPTIONS } from './src/generated/content-options';

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
      en: fields.text({ label: '英文', multiline: opts.multiline, description: opts.description }),
    },
    { label }
  );

/**
 * 自定义内容区块：后台可自由组合任意类型的结构化区块（标题 / 段落 / 图片 / 提示框 / 引用），
 * 与正文（Markdown）互补，满足「任意自定义内容的填报与发布」。
 * 详情页组件负责按 type 渲染（见 src/lib/custom-sections.ts 与详情页组件）。
 */
const customSectionsField = (label: string) =>
  fields.array(
    fields.object(
      {
        type: fields.select({
          label: '区块类型',
          options: [
            { label: '标题', value: 'heading' },
            { label: '段落', value: 'paragraph' },
            { label: '图片', value: 'image' },
            { label: '提示框', value: 'callout' },
            { label: '引用', value: 'quote' },
          ],
          defaultValue: 'paragraph',
        }),
        heading: fields.text({ label: '标题文字' }),
        text: fields.text({ label: '文字内容', multiline: true }),
        image: fields.image({ label: '图片', directory: 'public/uploads', publicPath: '/uploads/' }),
        imageCaption: fields.text({ label: '图片说明' }),
        calloutTone: fields.select({
          label: '提示级别',
          options: [
            { label: '提示', value: 'info' },
            { label: '警告', value: 'warn' },
            { label: '危险', value: 'danger' },
          ],
          defaultValue: 'info',
        }),
      },
      { label: '自定义区块' }
    ),
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
      label: '知识库文章',
      slugField: 'title', // 由标题自动生成 URL 友好的 slug（单一英文标题，作为 URL slug 来源）
      path: 'src/content/knowledge/*',
      schema: {
        // ───────── 第 1 步：定身份（地址 slug + 人看的中英标题）─────────
        title: fields.slug({
          name: fields.text({
            label: '标题（同时作为 URL slug，建议英文）',
            description:
              '英文、URL 友好，作为页面地址（例：kitchen-bath-mould-sealant）。改标题会改链接，发布后尽量别动。',
          }),
        }),
        name: bi('展示标题', {
          description:
            '卡片与详情页显示的中英双语标题。与「标题(slug)」不同：slug 是地址，这里才是人看到的名字，中英文都要填。',
        }),

        // ───────── 第 2 步：一句话结论（最重要，先写）─────────
        excerpt: bi('一句话结论 / 摘要', {
          multiline: true,
          description:
            '用一句话回答「这篇文章讲什么、该用啥」。显示于列表卡片、详情页顶部、搜索摘要，并驱动场景页 HowTo。务必先填。',
        }),

        // ───────── 第 3 步：双维度归类（决定文章出现在哪两个板块）─────────
        scenario: fields.select({
          label: '所属场景（维度一）',
          description:
            '把文章归入一个场景方案 → 自动出现在该场景页的「相关内容」区。选「无」则只进知识库、不进场景页。',
          options: [
            { label: '无', value: 'none' },
            ...SCENARIO_OPTIONS,
          ],
          defaultValue: 'none',
        }),
        category: fields.select({
          label: '分类（维度二）',
          description:
            '文章在知识库里的归类（单选）。决定它出现在知识库哪个分类下。不要留「未分类」。',
          options: [
            { label: '未分类', value: 'uncategorized' },
            ...CATEGORY_OPTIONS,
          ],
          defaultValue: 'uncategorized',
        }),
        tags: fields.multiselect({
          label: '标签（维度三·多选）',
          description:
            '从词表里选 2–4 个标签，用于细粒度检索与「相关内容」推荐。只能选已有词，不能手敲新词（防漂移）。',
          options: TAG_OPTIONS,
        }),

        // ───────── 第 4 步：写正文 ─────────
        body: fields.object(
          {
            zh: fields.mdx.inline({ label: '正文（中文）' }),
            en: fields.mdx.inline({ label: '正文（英文）' }),
          },
          {
            label: '双语正文',
            description: '中英各一份。多用 H2/H3、列表、表格写，便于 AI 与搜索直接抽取。',
          }
        ),
        // 结构化步骤：驱动详情页「操作步骤」区块 + HowTo 结构化数据。
        // 勾选 pitfall 的条目以「避坑提示」警示样式渲染，并【不】计入 HowTo 的编号步骤，
        // 从而把「施工避坑」类内容自然转成 HowTo 富媒体结果，又不污染步骤序列。
        steps: fields.array(
          fields.object(
            {
              title: bi('步骤标题'),
              text: bi('步骤说明', { multiline: true }),
              pitfall: fields.checkbox({
                label: '避坑提示（以警示样式渲染，不计入编号步骤）',
                defaultValue: false,
              }),
            },
            { label: '步骤' }
          ),
          {
            label: '结构化步骤（驱动 HowTo）',
            description:
              '施工/操作的可编号步骤 → 生成 HowTo 结构化数据。勾「避坑提示」的条目以警示框展示、不进编号。',
          }
        ),
        // 自定义内容区块：后台自由组合结构化区块，满足任意自定义内容的填报与发布
        customSections: customSectionsField('自定义内容区块（标题/段落/图片/提示框/引用）'),

        // ───────── 第 5 步：常见问题（必填≥3，利于 AI 抽取）─────────
        faq: fields.array(
          fields.object(
            {
              question: bi('问题'),
              answer: bi('答案', { multiline: true }),
            },
            { label: '问答' }
          ),
          {
            label: '常见问题',
            description:
              '每篇至少 3 条 FAQ → 自动生成 FAQPage 结构化数据，搜索/AI 可直接抽答案卡片。建议覆盖选型、施工、售后三类疑问。',
          }
        ),

        // ───────── 第 6 步：封面与发布 ─────────
        cover: fields.image({
          label: '封面图',
          description: '列表卡片与详情页顶部图。可不填，系统有占位。',
          directory: 'public/uploads',
          publicPath: '/uploads/',
        }),
        publishedAt: fields.date({
          label: '发布日期',
          description: '用于排序与「新鲜度」展示。修订重要内容时更新此日期。',
        }),
        // 草稿开关：false 的文章不会被构建进站点
        published: fields.checkbox({
          label: '已发布',
          defaultValue: true,
          description: '取消勾选 = 下架（数据保留，可随时恢复）。',
        }),
        featured: fields.checkbox({
          label: '在首页展示',
          defaultValue: false,
          description: '由主管控制：勾选后进入首页文章流/场景卡置顶。',
        }),
      },
    }),
    // 场景方案：4 个高频场景，产品以占位嵌入，不单独建库。中英双语。
    scenarios: collection({
      label: '场景方案',
      slugField: 'title',
      path: 'src/content/scenarios/*',
      schema: {
        title: fields.slug({ name: fields.text({ label: '场景标题（同时作为 URL slug，建议英文）' }) }),
        name: bi('展示标题'),
        excerpt: bi('摘要', { multiline: true }),
        published: fields.checkbox({ label: '已发布', defaultValue: true }),
        featured: fields.checkbox({ label: '在首页展示', defaultValue: false }),
        // 首句直接结论（双语）：回答「这个场景该用什么」，置于页面顶部
        conclusion: bi('一句话结论', {
          multiline: true,
          description:
            '例如：厨卫防霉防漏请选用耐持续浸水的防霉柔性密封胶。',
        }),
        // 选型逻辑要点（3-5 条）：每条含「要点标题」+「要点说明」，
        // 直接映射为场景页 HowTo 的 HowToStep（name=标题, text=说明）。
        selectionLogic: fields.array(
          fields.object({
            title: bi('要点标题'),
            point: bi('要点说明', { multiline: true }),
          }, { label: '要点' }),
          { label: '选型逻辑（驱动 HowTo）' }
        ),
        // 推荐产品占位（2-3 个），参数用占位符如 [movement capability] / [temperature range]
        recommendedProducts: fields.array(
          fields.object({
            name: bi('推荐产品占位（例如：产品 A）'),
            slug: fields.text({ label: '产品 slug（用于 TDS/SDS 下载，留空则不显示下载按钮）', description: '需与 public/uploads 下 tackix-tds-<slug>.pdf / tackix-sds-<slug>.pdf 的文件名一致' }),
            params: bi('参数占位符（例如：[位移能力] / [温度范围]）'),
          }, { label: '推荐产品' }),
          { label: '推荐产品' }
        ),
        faq: fields.array(
          fields.object(
            { question: bi('问题'), answer: bi('答案', { multiline: true }) },
            { label: '问答' }
          ),
          { label: '常见问题' }
        ),
        inquiryCta: bi('询盘按钮文案', { description: '例如：获取量身定制的建议' }),
        cover: fields.image({ label: '封面图', directory: 'public/uploads', publicPath: '/uploads/' }),
        body: fields.object(
          {
            zh: fields.mdx.inline({ label: '正文（中文，可选）' }),
            en: fields.mdx.inline({ label: '正文（英文，可选）' }),
          },
          { label: '正文' }
        ),
        // 自定义内容区块：后台自由组合结构化区块，满足任意自定义内容的填报与发布
        customSections: customSectionsField('自定义内容区块'),
      },
    }),
  },

  singletons: {
    //    字段均为「覆盖式」：后台不填则前端用默认值（见 src/lib/site-data.ts 的 DEFAULT_*）。

    home: {
      label: '首页内容',
      schema: {
        content: fields.object(
          {
            heroEyebrow: bi('首屏眉标', { description: '主标题上方的小标签' }),
            heroCta1: bi('首屏按钮 1', { description: '例如：“浏览场景方案”' }),
            heroCta2: bi('首屏按钮 2', { description: '例如：“联系我们获取报价”' }),
            scenariosTitle: bi('场景区标题'),
            scenariosSub: bi('场景区副标题', { multiline: true }),
            knowledgeTitle: bi('知识区标题'),
            knowledgeSub: bi('知识区副标题', { multiline: true }),
            bandTitle: bi('行动号召区标题'),
            bandSub: bi('行动号召区副标题', { multiline: true }),
            bandCta1: bi('行动号召按钮 1'),
            bandCta2: bi('行动号召按钮 2'),
          },
          { label: '首页文案' }
        ),
      },
    },


    ui: {
      label: '全局界面文案',
      schema: {
        navItems: fields.array(
          fields.object({
            label: bi('导航标签'),
            href: fields.text({ label: '链接', description: '例如 /solutions' }),
            scenariosMenu: fields.checkbox({
              label: '下拉展示场景方案',
              description: '开启后该导航项悬停/点击展开全部场景方案（自动读取 scenarios 集合，后台增删场景即同步）。',
              defaultValue: false,
            }),
          }, { label: '导航项' }),
          { label: '主导航' }
        ),
        // 页脚署名
        content: fields.object(
          {
            footerText: bi('页脚文字', { description: '留空则回退到站点标题。' }),
            footerAdminLabel: bi('后台入口标签', { description: '页脚指向后台管理系统的链接文字。' }),
            footerReportLabel: bi('页脚报表链接标签', { description: '页脚指向运营报表的链接文字（如“运营报表”）。' }),
            whatsappLabel: bi('WhatsApp 按钮标签', { description: '右下角浮动 WhatsApp 按钮显示的文字。' }),
            whatsappAria: bi('WhatsApp 按钮无障碍标签', { description: '屏幕阅读器朗读的 aria-label。' }),
            contactAria: bi('联系按钮无障碍标签', { description: '右下角浮动“联系我们”按钮的 aria-label。' }),
          },
          { label: '页脚与浮动按钮' }
        ),
      },
    },


    contact: {
      label: '联系页',
      schema: {
        content: fields.object(
          {
            pageTitle: bi('页面标题'),
            pageSub: bi('页面副标题', { multiline: true }),
            contactInfoTitle: bi('联系信息标题'),
            formSectionTitle: bi('表单区标题', { description: '例如：“给我们留言”' }),
            formName: bi('姓名字段标签'),
            formEmail: bi('邮箱字段标签'),
            formMsg: bi('留言字段标签'),
            submit: bi('提交按钮'),
            success: bi('成功提示', { multiline: true }),
            prelaunchTitle: bi('预上线提示标题'),
            prelaunchBody: bi('预上线提示正文', { multiline: true }),
            tipsTitle: bi('提示标题'),
          },
          { label: '联系页文案' }
        ),
        tipsItems: fields.array(
          fields.object({
            text: bi('提示内容', { multiline: true }),
          }, { label: '提示' }),
          { label: '提示列表' }
        ),
      },
    },


    pages: {
      label: '列表页标题',
      schema: {
        content: fields.object(
          {
            knowledgeTitle: bi('知识库列表标题'),
            knowledgeSub: bi('知识库列表副标题', { multiline: true }),
            scenariosTitle: bi('场景列表标题'),
            scenariosSub: bi('场景列表副标题', { multiline: true }),
            searchPlaceholder: bi('搜索框占位符'),
          },
          { label: '列表页标题' }
        ),
      },
    },


    detail: {
      label: '详情页区块',
      schema: {
        content: fields.object(
          {
            articleFaqTitle: bi('文章常见问题标题'),
            articleStepsTitle: bi('文章：步骤标题'),
            articlePitfallsTitle: bi('文章：避坑标题'),
            scenarioConclusionTitle: bi('场景：结论标题'),
            scenarioSelectionTitle: bi('场景：选型逻辑标题'),
            scenarioProductsTitle: bi('场景：推荐产品标题'),
            scenarioInquiryTitle: bi('场景：询盘 CTA 标题'),
            scenarioArticlesTitle: bi('场景：相关内容标题', { description: '场景分类页底部「该场景下的内容」区块标题。' }),
          },
          { label: '详情页区块标题' }
        ),
      },
    },


    about: {
      label: '关于页',
      schema: {
        content: fields.object(
          {
            storyTitle: bi('品牌故事标题'),
            storyBody: bi('品牌故事正文', { multiline: true }),
            missionTitle: bi('使命标题'),
            missionBody: bi('使命正文', { multiline: true }),
            factoryCaption: bi('工厂图片说明'),
          },
          { label: '关于页内容' }
        ),
        factoryImage: fields.image({ label: '工厂图片', directory: 'public/uploads', publicPath: '/uploads/' }),
      },
    },

    // 站点 & 公司信息（中英双语）。联系方式留空则不渲染对应入口。
    site: {
      label: '站点与公司信息',
      schema: {
        // 站点/联系信息分组
        info: fields.object(
          {
            title: bi('站点标题'),
            brandName: bi('页头品牌名', {
              description: '左上角页头显示的品牌名，留空则回退到站点标题。用于品牌名与完整站点标题不同的场合。',
            }),
            description: bi('站点描述', { multiline: true }),
            // 首页 Hero 区那句主标语，留空则回落到默认文案
            tagline: bi('首页标语'),
            // 商务邮箱（询盘主通道，兼顾 Gmail/Outlook/企业邮箱）—— 语言无关，单语
            email: fields.text({
              label: '商务邮箱',
              description: '例如 sales@tackix.com。留空则不显示邮箱入口。',
              validation: { pattern: { regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: '邮箱格式无效' } },
            }),
            // 公司全称：用于页脚署名与联系页主体信息，影响 B2B 买家的商业信任判断
            company: fields.text({ label: '公司名称', description: '例如：Tackix Materials Co., Ltd.（公司全称）' }),
            // 办公电话（含国家码，用于电话咨询与部分地区的采购流程要求）
            phone: fields.text({
              label: '电话',
              description: 'Include country code, e.g. +65 6xxx xxxx. Leave empty to hide.',
            }),
            // 全站 WhatsApp 号码（仅数字，含国家码）；留空则前台不显示 WhatsApp 悬浮按钮
            whatsapp: fields.text({
              label: 'WhatsApp 号码',
              description: 'Digits only, with country code. Leave empty to hide the WhatsApp entry.',
            }),
            // 办公地址（部分工程/采购流程需要登记供应商地址，影响资质审核）
            address: fields.text({ label: '地址', multiline: true, description: 'Leave empty to hide.' }),
            // 营业时间：海外买家判断能否及时回复的参考
            hours: fields.text({ label: '营业时间', description: '例如：周一至周五 09:00-18:00（GMT+8）' }),
            // WhatsApp 预填话术：不同页面入口用不同引导语，提升回复率
            whatsappPrefill: fields.text({
              label: 'WhatsApp 预填话术',
              description: 'Text pre-filled when a buyer opens the WhatsApp chat. Falls back to a default if empty.',
            }),
            // WhatsApp 悬浮按钮开关：默认关闭（右下角只保留「联系我们」按钮）。
            // 关闭时即使填了号码也不显示绿色悬浮按钮，但页脚/联系页的 WhatsApp 入口不受影响。
            showWhatsappFloat: fields.checkbox({
              label: '显示 WhatsApp 悬浮按钮',
              description: '开启后右下角显示绿色 WhatsApp 悬浮按钮；默认关闭，只保留「联系我们」按钮。',
              defaultValue: false,
            }),
          },
          { label: '站点与联系信息' }
        ),
        // 信任带（首页 CTA 之上 / 关于页）：一句话 + 副标题
        trust: fields.object(
          {
            trustTitle: bi('信任带标题'),
            trustSub: bi('信任带副标题', { multiline: true }),
          },
          { label: '信任带' }
        ),
        // 认证 / 信任徽章（关于页与首页信任带可复用）
        certBadges: fields.array(
          fields.object(
            {
              label: bi('徽章标签', { description: '例如 ISO 9001' }),
              note: bi('徽章说明', { multiline: true, description: '显示在徽章下方的简短说明。' }),
            },
            { label: '徽章' }
          ),
          { label: '认证与信任徽章' }
        ),
      },
    },

    // 分类管理：分类从此处可增删改，不再写死在代码里。
    categories: {
      label: '分类管理',
      schema: {
        items: fields.array(
          fields.object(
            {
              label: bi('显示名称', {
                description: '显示在筛选栏与文章卡片上的文字，例如“选型指南”。',
              }),
              value: fields.text({
                label: '值（slug）',
                description:
                  '写入文章数据的唯一英文标识，例如 selection-guide。文章引用后请勿修改。',
              }),
            },
            { label: '分类' }
          ),
          {
            label: '分类项',
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
      label: '标签',
      schema: {
        items: fields.array(
          fields.object(
            {
              label: bi('显示名称', { description: '显示在前端的文字，例如“硅酮密封胶”。' }),
              value: fields.text({
                label: '值（slug）',
                description: 'Unique English identifier written to article frontmatter, e.g. silicone-sealant.',
              }),
            },
            { label: '标签' }
          ),
          {
            label: '标签项',
            itemLabel: (props) =>
              (props.fields.label.value?.zh as string) ||
              (props.fields.label.value?.en as string) ||
              'Untitled',
          }
        ),
      },
    },
  },
});
