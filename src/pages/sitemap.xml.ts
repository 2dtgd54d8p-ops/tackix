import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../keystatic.config';
import type { APIRoute } from 'astro';

// 静态预渲染：构建期生成 /sitemap.xml，无需额外依赖。
// 动态文章由 Keystatic reader 列出，保证新增文章后 sitemap 自动更新。
export const prerender = true;

// 路由 URL 与页面 canonical 保持一致（均带尾部斜杠）
const STATIC_ROUTES = ['/', '/posts/', '/contact/', '/search/'];

export const GET: APIRoute = async (Astro) => {
  const base = Astro.site ?? new URL('https://tackix.pages.dev');
  const reader = createReader(process.cwd(), keystaticConfig);
  let slugs: string[] = [];
  try {
    slugs = await reader.collections.posts.list();
  } catch {
    slugs = [];
  }
  const posts = (
    await Promise.all(
      slugs.map(async (slug) => {
        try {
          const post = await reader.collections.posts.read(slug);
          return post && post.published !== false ? slug : null;
        } catch {
          return null;
        }
      })
    )
  ).filter(Boolean) as string[];

  const urls = [...STATIC_ROUTES, ...posts.map((s) => `/posts/${s}/`)];
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${new URL(u, base).href}</loc></url>`).join('\n') +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
