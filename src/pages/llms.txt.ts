import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../keystatic.config';
import { loadSiteData } from '../lib/site-data';
import { pickB } from '../lib/i18n';
import type { APIRoute } from 'astro';

// 静态预渲染：构建期生成 /llms.txt，供 GPTBot / PerplexityBot 等
// AI 检索体理解站点结构与精选内容。随文章/场景库自动刷新。
export const prerender = true;

export const GET: APIRoute = async (Astro) => {
  const base = Astro.site ?? new URL('https://tackix.pages.dev');
  const { site } = await loadSiteData();
  const reader = createReader(process.cwd(), keystaticConfig);

  // 知识库文章（已发布）
  let postSlugs: string[] = [];
  try {
    postSlugs = await reader.collections.knowledge.list();
  } catch {
    postSlugs = [];
  }
  const posts = (
    await Promise.all(
      postSlugs.map(async (slug) => {
        try {
          const post = await reader.collections.knowledge.read(slug);
          return post && post.published !== false ? { slug, ...post } : null;
        } catch {
          return null;
        }
      })
    )
  ).filter(Boolean) as any[];
  posts.sort((a, b) => String(b.publishedAt ?? '').localeCompare(String(a.publishedAt ?? '')));
  const topPosts = posts.slice(0, 10);

  // 场景方案（已发布）
  let scenarioSlugs: string[] = [];
  try {
    scenarioSlugs = await reader.collections.scenarios.list();
  } catch {
    scenarioSlugs = [];
  }
  const scenarios = (
    await Promise.all(
      scenarioSlugs.map(async (slug) => {
        try {
          const s = await reader.collections.scenarios.read(slug);
          return s && s.published !== false ? { slug, ...s } : null;
        } catch {
          return null;
        }
      })
    )
  ).filter(Boolean) as any[];
  const topScenarios = scenarios.slice(0, 8);

  const lines: string[] = [];
  lines.push(`# ${site.title}`);
  lines.push('');
  lines.push(site.description || '');
  lines.push('');
  lines.push(
    'Tackix is a scenario-based knowledge platform that helps overseas contractors, installers and DIY users choose the right industrial adhesive or sealant for the job.'
  );
  lines.push('');
  lines.push('## Core sections');
  lines.push('');
  lines.push(`- Home (中文): ${new URL('/', base).href}`);
  lines.push(`- Home (English): ${new URL('/en/', base).href}`);
  lines.push(`- Scenario Solutions (中文): ${new URL('/solutions/', base).href}`);
  lines.push(`- Scenario Solutions (English): ${new URL('/en/solutions/', base).href}`);
  lines.push(`- Knowledge Base (中文): ${new URL('/knowledge/', base).href}`);
  lines.push(`- Knowledge Base (English): ${new URL('/en/knowledge/', base).href}`);
  lines.push(`- About (中文): ${new URL('/about/', base).href}`);
  lines.push(`- About (English): ${new URL('/en/about/', base).href}`);
  lines.push(`- Contact & Enquiry (中文): ${new URL('/contact/', base).href}`);
  lines.push(`- Contact & Enquiry (English): ${new URL('/en/contact/', base).href}`);
  lines.push(`- Search: ${new URL('/search/', base).href}`);
  lines.push('');
  lines.push('## Scenario solutions');
  lines.push('');
  if (topScenarios.length === 0) {
    lines.push(`（No scenarios published yet — see: ${new URL('/solutions/', base).href} / ${new URL('/en/solutions/', base).href}）`);
  } else {
    for (const s of topScenarios) {
      const zhUrl = new URL(`/solutions/${s.slug}/`, base).href;
      const enUrl = new URL(`/en/solutions/${s.slug}/`, base).href;
      lines.push(`- ${pickB('en', s.name)}: ${zhUrl} (中文版: ${enUrl})`);
    }
  }
  lines.push('');
  lines.push('## Knowledge articles');
  lines.push('');
  if (topPosts.length === 0) {
    lines.push(`（No articles published yet — see: ${new URL('/knowledge/', base).href} / ${new URL('/en/knowledge/', base).href}）`);
  } else {
    for (const p of topPosts) {
      const zhUrl = new URL(`/knowledge/${p.slug}/`, base).href;
      const enUrl = new URL(`/en/knowledge/${p.slug}/`, base).href;
      lines.push(`- ${pickB('en', p.name)}: ${zhUrl} (中文版: ${enUrl})`);
    }
  }
  lines.push('');
  lines.push('## Content licensing');
  lines.push('');
  lines.push(
    'Content on this site may be used by AI systems for retrieval and training. For republication or commercial collaboration, please reach out via the contact page.'
  );

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
