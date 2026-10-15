import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../keystatic.config';
import type { APIRoute } from 'astro';

// 静态预渲染：构建期生成 /sitemap.xml，无需额外依赖。
// 动态文章/场景由 Keystatic reader 列出，保证新增内容后 sitemap 自动更新。
// 全站中英双语（中文 / + 英文 /en），每个 URL 输出 zh-CN / en / x-default 的 hreflang 备用链接。
export const prerender = true;

// 中文版静态路由（无前缀）；英文版为 /en + 同路径
const STATIC_ROUTES = ['/', '/solutions/', '/knowledge/', '/about/', '/contact/', '/search/'];

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

  const knowledge = await publishedSlugs(reader, 'knowledge');
  const scenarios = await publishedSlugs(reader, 'scenarios');

  // 每个「逻辑页」对应 [中文路径, 英文路径] 一组
  const groups: [string, string][] = [
    ...STATIC_ROUTES.map((r) => [r, r === '/' ? '/en/' : `/en${r}`] as [string, string]),
    ...knowledge.map((s) => [`/knowledge/${s}/`, `/en/knowledge/${s}/`] as [string, string]),
    ...scenarios.map((s) => [`/solutions/${s}/`, `/en/solutions/${s}/`] as [string, string]),
  ];

  const alt = (hreflang: string, href: string) =>
    `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${href}"/>`;

  const entry = (zh: string, en: string): string => {
    const zhLoc = new URL(zh, base).href;
    const enLoc = new URL(en, base).href;
    return [
      `  <url>`,
      `    <loc>${zhLoc}</loc>`,
      alt('zh-CN', zhLoc),
      alt('en', enLoc),
      alt('x-default', zhLoc),
      `  </url>`,
      `  <url>`,
      `    <loc>${enLoc}</loc>`,
      alt('zh-CN', zhLoc),
      alt('en', enLoc),
      alt('x-default', zhLoc),
      `  </url>`,
    ].join('\n');
  };

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    groups.map(([z, e]) => entry(z, e)).join('\n') +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
