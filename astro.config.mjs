// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';

// 独立站平台：Astro + Cloudflare Pages（自建 D1 后台，无 GitHub / Keystatic 依赖）
// - output: 'static'（默认）-> 页面默认静态预渲染（快/免费/无限带宽）；
//   仅后台登录态相关页面（/admin/*）与内容 CRUD 接口（/api/content/*、/api/media/*）
//   走 Cloudflare Pages Functions（SSR）。
// - adapter: cloudflare()（高级模式，编译进 dist/_worker.js）
//   注意：@astrojs/cloudflare v13+ 已转向 Workers，Pages 必须锁 v12
export default defineConfig({
  // 站点域名（用于 canonical/绝对链接）。通过 PUBLIC_SITE_URL 环境变量注入，
  // 本地未设时回退占位；Cloudflare Pages 构建环境变量里填你的 Pages/自定义域名。
  site: import.meta.env.PUBLIC_SITE_URL || 'https://tackix.pages.dev',
  output: 'static',
  adapter: cloudflare(),
  // 本后台鉴权用自签会话 cookie（src/lib/auth.ts），不依赖 Astro Sessions。
  // 显式指定 memory 驱动，避免 @astrojs/cloudflare 自动强行要求 SESSION KV 绑定。
  session: { driver: 'memory' },
  // 多语言路由：中文为默认语种，路由无前缀（/）；英文位于 /en/ 下。
  // prefixDefaultLocale:false 让默认语种不带 /zh-CN 前缀，保持首页干净。
  i18n: {
    defaultLocale: 'zh-CN',
    locales: ['zh-CN', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    react(),
  ],
});
