import { config, collection, singleton, fields } from '@keystatic/core';

// 存储后端切换（仅决定 /keystatic 后台 UI 的数据读写来源，不影响静态站点的构建）：
// - 本地开发（未设 PUBLIC_GITHUB_OWNER）使用 local，直接读写仓库文件，零配置
// - 生产构建（Cloudflare Pages，已设 PUBLIC_GITHUB_OWNER）使用 github 模式，后台经 GitHub App 读写仓库
// 用 process.env（而非 import.meta.env）判断：@keystatic/astro 加载本配置时未必经过 Vite 注入，
// PROD / PUBLIC_* 在求值期可能为 undefined；process.env 在 Node 构建期始终可用。
//
// ⚠️ 重要：静态首页的文章列表由 astro build 期用 createReader 从【本地文件系统】
//   (src/content/posts/*.yaml) 读取并写死进 index.html —— 它不调用 GitHub API，也【完全忽略】
//   下面的 storage 配置。所以 Keystatic 提交新文章后，必须“重新构建 + 部署”，首页才会出现
//   新文章。本仓库用 .github/workflows/deploy.yml 在每次 push 到 main（含 Keystatic 的提交）
//   时自动重建部署，从根本上解决“新增文章首页不显示”的问题。
const useGithub = Boolean(process.env.PUBLIC_GITHUB_OWNER);

const storage = useGithub
  ? {
      kind: 'github' as const,
      repo: {
        owner: process.env.PUBLIC_GITHUB_OWNER!,
        name: process.env.PUBLIC_GITHUB_REPO!,
      },
    }
  : ({ kind: 'local' } as const);

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
