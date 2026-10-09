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
        tags: fields.multiselect({
          label: '标签',
          options: [
            { label: 'Astro', value: 'astro' },
            { label: 'Cloudflare', value: 'cloudflare' },
            { label: 'Keystatic', value: 'keystatic' },
            { label: '教程', value: 'tutorial' },
          ],
        }),
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
  },
});
