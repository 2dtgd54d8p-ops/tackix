import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../keystatic.config';
import type { APIRoute } from 'astro';

// 静态预渲染：构建期生成 /sitemap.xml，无需额外依赖。
// 动态文章由 Keystatic reader 列出，保证新增文章后 sitemap 自动更新。
export const prerender = true;

// 路由 URL 与页面 canonical 保持一致（均带尾部斜杠）
// zh-CN 为默认语言（无前缀）；en 有真实内容页。
// ⚠️ vi / th 尚未产出内容页，**不写入** sitemap —— 声明不存在的 URL 会造成软 404。
const STATIC_ROUTES = ['/', '/products/', '/selector/', '/cases/', '/posts/', '/contact/', '/search/'];
const STATIC_ROUTES_EN = ['/en/', '/en/products/', '/en/selector/', '/en/cases/', '/en/posts/', '/en/contact/'];

/**
 * 为单个 URL 生成 zh/en 互指的 hreflang 组（Sitemap 协议）。
 * 让 Google 把中英两版识别为「同一内容的两个语言版本」，
 * 而非两个独立页面互相竞争。
 */
function alternatesFor(u: string, base: URL): string {
  const isEn = u.startsWith('/en/');
  const zhPath = isEn ? u.replace(/^\/en/, '') || '/' : u;
  const enPath = isEn ? u : `/en${u === '/' ? '/' : u}`;
  const zh = new URL(zhPath, base).href;
  const en = new URL(enPath, base).href;
  return (
    `    <xhtml:link rel="alternate" hreflang="zh-CN" href="${zh}"/>\n` +
    `    <xhtml:link rel="alternate" hreflang="en" href="${en}"/>\n` +
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${en}"/>`
  );
}

/** 读取某集合中所有 published 的 slug（未发布的不进 sitemap） */
async function publishedSlugs(reader: any, name: string): Promise<string[]> {
  let slugs: string[] = [];
  try {
    slugs = await reader.collections[name].list();
  } catch {
    return [];
  }
  const out = await Promise.all(
    slugs.map(async (slug) => {
      try {
        const item = await reader.collections[name].read(slug);
        return item && item.published !== false ? slug : null;
      } catch {
        return null;
      }
    })
  );
  return out.filter(Boolean) as string[];
}

export const GET: APIRoute = async (Astro) => {
  const base = Astro.site ?? new URL('https://tackix.pages.dev');
  const reader = createReader(process.cwd(), keystaticConfig);

  const posts = await publishedSlugs(reader, 'posts');
  const products = await publishedSlugs(reader, 'products');
  const cases = await publishedSlugs(reader, 'cases');

  const urls = [
    ...STATIC_ROUTES,
    ...posts.map((s) => `/posts/${s}/`),
    ...products.map((s) => `/products/${s}/`),
    ...cases.map((s) => `/cases/${s}/`),
    // 英文对应页
    ...STATIC_ROUTES_EN,
    ...posts.map((s) => `/en/posts/${s}/`),
    ...products.map((s) => `/en/products/${s}/`),
    ...cases.map((s) => `/en/cases/${s}/`),
  ];

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    urls
      .map(
        (u) =>
          `  <url>\n    <loc>${new URL(u, base).href}</loc>\n${alternatesFor(u, base)}\n  </url>`
      )
      .join('\n') +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
