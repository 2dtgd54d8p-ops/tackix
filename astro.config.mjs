// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import cloudflare from '@astrojs/cloudflare';

// 独立站平台：Astro + Keystatic + Cloudflare Pages
// - output: 'static'（默认）-> 页面默认静态预渲染（快/免费/无限带宽）；
//   仅 @keystatic/astro 集成自动把 /keystatic 与 /api/keystatic/* 标记为
//   prerender:false，走 Cloudflare Pages Functions（OAuth 回调需要服务端）
// - adapter: cloudflare()（高级模式，编译进 dist/_worker.js）
//   注意：@astrojs/cloudflare v13+ 已转向 Workers，Pages 必须锁 v12
export default defineConfig({
  // 站点域名（用于 canonical/绝对链接）。通过 PUBLIC_SITE_URL 环境变量注入，
  // 本地未设时回退占位；Cloudflare Pages 构建环境变量里填你的 Pages/自定义域名。
  site: import.meta.env.PUBLIC_SITE_URL || 'https://tackix.pages.dev',
  output: 'static',
  adapter: cloudflare(),
  // 多语言（T10 脚手架）：声明支持语种，为后续 /en /vi /th 内容路由与
  // SEO hreflang 备用链接预留。当前静态站尚未生成非默认语种内容页，
  // 默认语种不加路径前缀（prefixDefaultLocale:false），外壳 UI 文案由
  // Base.astro 的客户端切换器做 localStorage 偏好替换。
  i18n: {
    defaultLocale: 'zh-CN',
    locales: ['zh-CN', 'en', 'vi', 'th'],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    react(),
    keystatic(), // 注入 /keystatic 后台与 /api/keystatic/* 接口
  ],
  vite: {
    optimizeDeps: {
      // 只排除 @keystatic/astro：它内部 import 'astro:env/server'（Astro 虚拟模块），
      // 会被 Vite 的 esbuild 预构建器误扫描而报 "Could not resolve 'astro:env/server'"。
      // 注意：@keystatic/core 绝不能排除——它的 CJS 依赖（如 lodash）需要 Vite 做
      // CJS→ESM 互操作，否则客户端会报 "does not provide an export named 'default'"，
      // 导致 /keystatic 后台 React 挂载失败、页面空白。
      exclude: ['@keystatic/astro'],
    },
  },
});
