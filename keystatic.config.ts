import { config, collection, singleton, fields } from '@keystatic/core';

// 存储后端切换：
// - 本地开发（import.meta.env.PROD === false）使用 local，直接读写仓库文件，零配置
// - 生产构建（Cloudflare Pages）使用 github 模式，编辑经 GitHub App 提交回仓库
//   repo owner/name 通过 PUBLIC_ 环境变量在构建时内联进前端（后台 UI 需要）
const isProd = import.meta.env.PROD;

const storage = isProd
  ? {
      kind: 'github' as const,
      repo: {
        owner: import.meta.env.PUBLIC_GITHUB_OWNER!,
        name: import.meta.env.PUBLIC_GITHUB_REPO!,
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
