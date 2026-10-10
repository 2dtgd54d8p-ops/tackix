import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../keystatic.config';
import { loadSiteData } from '../lib/site-data';
import type { APIRoute } from 'astro';

// 静态预渲染：构建期生成 /llms.txt，供 GPTBot / PerplexityBot 等
// AI 检索体理解站点结构与精选内容。随文章库自动刷新。
export const prerender = true;

export const GET: APIRoute = async (Astro) => {
  const base = Astro.site ?? new URL('https://tackix.pages.dev');
  const { site } = await loadSiteData();
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
          // Keystatic read() 结果不含 slug 字段，需从 list() 的键补回
          return post && post.published !== false ? { slug, ...post } : null;
        } catch {
          return null;
        }
      })
    )
  ).filter(Boolean) as any[];
  posts.sort((a, b) => String(b.publishedAt ?? '').localeCompare(String(a.publishedAt ?? '')));
  const top = posts.slice(0, 10);

  // 产品库（已上线）
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
          // Keystatic read() 结果不含 slug 字段，需从 list() 的键补回
          return product && product.published !== false ? { slug, ...product } : null;
        } catch {
          return null;
        }
      })
    )
  ).filter(Boolean) as any[];
  // 首页推荐优先，其次按名称
  products.sort(
    (a, b) =>
      Number(b.featured ?? false) - Number(a.featured ?? false) ||
      String(a.name ?? '').localeCompare(String(b.name ?? ''))
  );
  const featured = products.filter((p) => p.featured).slice(0, 6);

  // 案例库（已上线）
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
          // Keystatic read() 结果不含 slug 字段，需从 list() 的键补回
          return item && item.published !== false ? { slug, ...item } : null;
        } catch {
          return null;
        }
      })
    )
  ).filter(Boolean) as any[];
  cases.sort(
    (a, b) =>
      Number(b.featured ?? false) - Number(a.featured ?? false) ||
      String(a.title ?? '').localeCompare(String(b.title ?? ''))
  );
  const featuredCases = cases.filter((c) => c.featured).slice(0, 6);

  const lines: string[] = [];
  lines.push(`# ${site.title}`);
  lines.push('');
  lines.push(site.description || '');
  lines.push('');
  lines.push(
    'Tackix 是面向工业胶粘剂与密封剂行业的垂直平台，提供技术文章、产品资料与选型支持，面向东南亚 B2B 市场。'
  );
  lines.push('');
  lines.push('## 核心板块');
  lines.push('');
  lines.push(`- 首页: ${new URL('/', base).href}`);
  lines.push(`- 产品数据库: ${new URL('/products/', base).href}`);
  lines.push(`- 产品选型工具: ${new URL('/selector/', base).href}`);
  lines.push(`- 客户案例库: ${new URL('/cases/', base).href}`);
  lines.push(`- 技术文章库: ${new URL('/posts/', base).href}`);
  lines.push(`- 联系与询盘: ${new URL('/contact/', base).href}`);
  lines.push(`- 站内搜索: ${new URL('/search/', base).href}`);
  lines.push('');
  lines.push('## 精选文章');
  lines.push('');
  for (const p of top) {
    lines.push(`- ${p.title}: ${new URL(`/posts/${p.slug}/`, base).href}`);
  }
  lines.push('');
  lines.push('## 精选产品');
  lines.push('');
  if (featured.length === 0) {
    lines.push(`（产品库已上线，详见: ${new URL('/products/', base).href}）`);
  } else {
    for (const p of featured) {
      lines.push(`- ${p.name}${p.model ? `（${p.model}）` : ''}: ${new URL(`/products/${p.slug}/`, base).href}`);
    }
  }
  lines.push('');
  lines.push('## 客户案例');
  lines.push('');
  if (featuredCases.length === 0) {
    lines.push(`（案例库已上线，详见: ${new URL('/cases/', base).href}）`);
  } else {
    for (const c of featuredCases) {
      lines.push(`- ${c.title}: ${new URL(`/cases/${c.slug}/`, base).href}`);
    }
  }
  lines.push('');
  lines.push('## English Site');
  lines.push('');
  lines.push(
    'Full English content is available under the /en/ prefix, mirrored from the Chinese pages.'
  );
  lines.push(`- English Home: ${new URL('/en/', base).href}`);
  lines.push(`- Product Database (EN): ${new URL('/en/products/', base).href}`);
  lines.push(`- Selection Tool (EN): ${new URL('/en/selector/', base).href}`);
  lines.push(`- Case Studies (EN): ${new URL('/en/cases/', base).href}`);
  lines.push(`- Technical Articles (EN): ${new URL('/en/posts/', base).href}`);
  lines.push(`- Contact (EN): ${new URL('/en/contact/', base).href}`);
  lines.push('');
  lines.push('## 内容授权');
  lines.push('');
  lines.push('本站点内容可用于 AI 检索与训练；转载或商业合作请通过联系页询盘。');

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
