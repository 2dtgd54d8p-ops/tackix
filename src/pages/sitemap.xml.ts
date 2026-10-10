import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../keystatic.config';
import type { APIRoute } from 'astro';

// 静态预渲染：构建期生成 /sitemap.xml，无需额外依赖。
// 动态文章由 Keystatic reader 列出，保证新增文章后 sitemap 自动更新。
export const prerender = true;

// 路由 URL 与页面 canonical 保持一致（均带尾部斜杠）
const STATIC_ROUTES = ['/', '/products/', '/selector/', '/cases/', '/posts/', '/contact/', '/search/'];

export const GET: APIRoute = async (Astro) => {
  const base = Astro.site ?? new URL('https://tackix.pages.dev');
  const reader = createReader(process.cwd(), keystaticConfig);

  // 文章
  let postSlugs: string[] = [];
  try {
    postSlugs = await reader.collections.posts.list();
  } catch {
    postSlugs = [];
  }
  const posts = (
    await Promise.all(
      postSlugs.map(async (slug) => {
        try {
          const post = await reader.collections.posts.read(slug);
          return post && post.published !== false ? slug : null;
        } catch {
          return null;
        }
      })
    )
  ).filter(Boolean) as string[];

  // 产品（B2B 产品库）
  let productSlugs: string[] = [];
  try {
    productSlugs = await reader.collections.products.list();
  } catch {
    productSlugs = [];
  }
  const products = (
    await Promise.all(
      productSlugs.map(async (slug) => {
        try {
          const product = await reader.collections.products.read(slug);
          return product && product.published !== false ? slug : null;
        } catch {
          return null;
        }
      })
    )
  ).filter(Boolean) as string[];

  // 案例
  let caseSlugs: string[] = [];
  try {
    caseSlugs = await reader.collections.cases.list();
  } catch {
    caseSlugs = [];
  }
  const cases = (
    await Promise.all(
      caseSlugs.map(async (slug) => {
        try {
          const item = await reader.collections.cases.read(slug);
          return item && item.published !== false ? slug : null;
        } catch {
          return null;
        }
      })
    )
  ).filter(Boolean) as string[];

  const urls = [
    ...STATIC_ROUTES,
    ...posts.map((s) => `/posts/${s}/`),
    ...products.map((s) => `/products/${s}/`),
    ...cases.map((s) => `/cases/${s}/`),
  ];
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${new URL(u, base).href}</loc></url>`).join('\n') +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
