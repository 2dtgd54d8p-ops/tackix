import { config, collection, singleton, fields } from '@keystatic/core';

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

  collections: {
    posts: collection({
      label: '文章',
      slugField: 'title', // 由标题自动生成 URL 友好的 slug
      path: 'src/content/posts/*',
      schema: {
        title: fields.slug({ name: { label: '标题' } }),
        excerpt: fields.text({ label: '摘要' }),
        publishedAt: fields.date({ label: '发布日期' }),
        // 草稿开关：false 的文章不会被构建进站点（见 index.astro / [slug].astro 的过滤）
        published: fields.checkbox({ label: '已发布', defaultValue: true }),
        // 用多行文本存 Markdown，避免依赖 @astrojs/markdoc（其最新版要求 Astro 7）
        body: fields.text({ label: '正文 (Markdown)', multiline: true }),
      },
    }),
  },

  singletons: {
    site: {
      label: '站点设置',
      schema: {
        title: fields.text({ label: '站点标题' }),
        description: fields.text({ label: '站点描述', multiline: true }),
      },
    },
  },
});
