import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../../keystatic.config';
import type { APIRoute } from 'astro';

// 文章纯 Markdown 端点：/posts/<slug>.md
// 供 AI 检索体直接抓取结构化正文（绕过 HTML 装饰），SEO/AI 优化重点之一。
export const prerender = true;

export async function getStaticPaths() {
  const reader = createReader(process.cwd(), keystaticConfig);
  let slugs: string[] = [];
  try {
    slugs = await reader.collections.posts.list();
  } catch {
    return [];
  }
  const entries = await Promise.all(
    slugs.map(async (slug) => {
      try {
        const post = await reader.collections.posts.read(slug);
        return post && post.published !== false ? { params: { slug } } : null;
      } catch {
        return null;
      }
    })
  );
  return entries.filter(Boolean);
}

export const GET: APIRoute = async ({ params }) => {
  const reader = createReader(process.cwd(), keystaticConfig);
  const slug = params.slug!;
  let post;
  try {
    post = await reader.collections.posts.read(slug);
  } catch {
    post = null;
  }
  if (!post || post.published === false) {
    return new Response('Not Found', { status: 404 });
  }
  const meta: string[] = [];
  if (post.excerpt) meta.push(`> ${post.excerpt}`);
  if (post.publishedAt) meta.push(`发布日期: ${post.publishedAt}`);
  if (post.category) meta.push(`分类: ${post.category}`);
  const md = `# ${post.title}\n\n${meta.join('\n')}\n\n${post.body ?? ''}\n`;
  return new Response(md, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
