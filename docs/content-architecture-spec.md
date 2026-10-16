# 内容平台架构方案（Astro + GitHub + Cloudflare Pages）

> 通用占位符约定：`scenario-a / scenario-b / scenario-c / scenario-d` 表示「场景」，`category-1 / category-2 / category-3` 表示「内容分类」。
> 核心约束：**所有内容只存一份**（单一 Content Collection），板块 A（按场景）与板块 B（按分类）都从该集合派生，改一处、两处同步。

---

## 1. 技术栈与核心思路

| 层 | 选型 | 说明 |
|---|---|---|
| 框架 | Astro 5（SSG，Content Layer API） | 纯静态、SEO 友好、构建期出 HTML |
| 数据存储 | 仓库内 `src/content/articles/*.md` | 单一数据源，Git 版本化、可 PR 协作 |
| 分类体系 | `src/data/taxonomy.ts` | 场景/分类的「元信息」（`slug`/`name`/`overview`），与文章内容解耦 |
| 托管 | Cloudflare Pages | `main` 分支推送即自动构建部署 |
| 全文搜索 | 可选 Pagefind（构建期索引） | 与客户端分面筛选互补 |

**数据关系（一篇文章的归属）：**

```
article.scenarios = ['scenario-a', 'scenario-c']   // 可多场景
article.categories = ['category-1', 'category-2']  // 可多分类
```

- 板块 A：遍历 `scenarios`，按 `article.scenarios.includes(slug)` 聚合。
- 板块 B：遍历 `categories`，按 `article.categories.includes(slug)` 聚合，并支持搜索。
- 详情页：两板块卡片都链向同一个 `/knowledge/[slug]`，**唯一真源**。

---

## 2. 内容集合 Schema（Astro Content Collections）

### 2.1 集合定义（`src/content.config.ts`）

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articles = defineCollection({
  // 单一数据源：所有文章都在这里，一篇一份
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articles' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      // 关键：多值数组，决定文章出现在哪些板块
      scenarios: z.array(z.string()).default([]),   // 关联 scenario slug
      categories: z.array(z.string()).default([]),  // 关联 category slug
      excerpt: z.string().optional(),
      cover: image().optional(),
      publishedAt: z.coerce.date(),
      updatedAt: z.coerce.date().optional(),
      published: z.boolean().default(true),         // false 则两板块都不出现
      featured: z.boolean().default(false),
      tags: z.array(z.string()).default([]),
    }),
});

export const collections = { articles };
```

### 2.2 字段说明

| 字段 | 类型 | 用途 |
|---|---|---|
| `title` | string | 标题；同时用于详情页 `<h1>`、列表卡片、SEO |
| `scenarios` | string[] | **维度一**：决定文章出现在哪些场景页（板块 A） |
| `categories` | string[] | **维度二**：决定文章出现在哪些分类（板块 B） |
| `excerpt` | string? | 列表摘要、社交分享、meta description |
| `cover` | image? | 卡片封面（Astro 资源，自动优化） |
| `publishedAt` | date | 排序、时间展示 |
| `published` | boolean | 总开关；两板块统一过滤 |
| `featured` | boolean | 置顶/精选，排序时用 |
| `tags` | string[] | 次级标签，可选 |

### 2.3 示例文章（`src/content/articles/example-article.md`）

```md
---
title: "示例文章：一篇可同时属于多场景多分类的内容"
scenarios:
  - scenario-a
  - scenario-c
categories:
  - category-1
  - category-3
excerpt: "演示一篇文章如何同时出现在板块 A 与板块 B，并在两处同步更新。"
publishedAt: 2026-10-16
published: true
featured: false
tags:
  - tag-x
cover: ./cover.png
---

正文用 Markdown 书写。板块 A 的场景页与板块 B 的列表都会引用这份正文，
编辑此处即同步更新两个入口。
```

### 2.4 场景 / 分类元信息（`src/data/taxonomy.ts`）

> 放在代码里而非文章里，便于后台「增删场景」不必改每篇文章。

```ts
export interface Scenario {
  slug: string;
  name: string;
  overview: string; // 板块 A 顶部的总体概述
}
export interface Category {
  slug: string;
  name: string;
}

export const scenarios: Scenario[] = [
  { slug: 'scenario-a', name: '场景 A', overview: '场景 A 的总体概述：适用工况与推荐思路。' },
  { slug: 'scenario-b', name: '场景 B', overview: '场景 B 的总体概述。' },
  { slug: 'scenario-c', name: '场景 C', overview: '场景 C 的总体概述。' },
  { slug: 'scenario-d', name: '场景 D', overview: '场景 D 的总体概述。' },
];

export const categories: Category[] = [
  { slug: 'category-1', name: '分类 1' },
  { slug: 'category-2', name: '分类 2' },
  { slug: 'category-3', name: '分类 3' },
];

// O(1) 查名，渲染时避免重复遍历
export const scenarioMap = new Map(scenarios.map((s) => [s.slug, s]));
export const categoryMap = new Map(categories.map((c) => [c.slug, c]));
```

---

## 3. 页面路由结构

| 路由 | 类型 | 数据来源 | 说明 |
|---|---|---|---|
| `/` | 静态 | `taxonomy` | 首页，两板块入口 |
| `/scenarios/` | 静态 | `scenarios` | 场景总览（4 个场景卡） |
| `/scenarios/[slug]/` | SSG | 过滤 `articles` | **板块 A**：顶部概述 + 该场景下所有文章 |
| `/knowledge/` | 静态 | `articles` + 客户端筛选 | **板块 B**：全量文章 + 分类/场景筛选 + 搜索 |
| `/knowledge/[slug]/` | SSG | 单篇 `article` | **共用详情页**：两板块都链到这里 |
| `/categories/` | 静态（可选） | `categories` | 分类总览（可选，板块 B 的另一种入口） |

**关键原则**：文章详情页只有一个真源 URL（`/knowledge/[slug]`）。场景页、分类页、搜索结果都只是「带筛选条件的列表」，卡片点击统一跳转到该详情页。

---

## 4. 场景页（板块 A）聚合逻辑

### 4.1 构建期生成（`src/pages/scenarios/[slug].astro`）

```ts
---
import { getCollection } from 'astro:content';
import { scenarios, scenarioMap } from '../../data/taxonomy';

export async function getStaticPaths() {
  const all = await getCollection('articles', ({ data }) => data.published);
  return scenarios.map((sc) => ({
    params: { slug: sc.slug },
    props: {
      scenario: sc,
      // 按场景聚合：一篇文章可属于多个场景，各自独立命中
      articles: all
        .filter((a) => a.data.scenarios.includes(sc.slug))
        .sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime()),
    },
  }));
}

const { scenario, articles } = Astro.props;
const byCategory = categories
  .map((c) => ({
    category: c,
    items: articles.filter((a) => a.data.categories.includes(c.slug)),
  }))
  .filter((g) => g.items.length > 0);
---
```

### 4.2 渲染结构

```astro
<Base title={scenario.name}>
  <!-- 顶部：该场景的总体概述 -->
  <section class="scenario-hero">
    <h1>{scenario.name}</h1>
    <p>{scenario.overview}</p>
  </section>

  <!-- 该场景下的所有相关文章，按分类分组展示（可选增强） -->
  {byCategory.map(({ category, items }) => (
    <section class="group">
      <h2>{category.name}</h2>
      <div class="grid">
        {items.map((a) => (
          <!-- 两板块统一跳详情页 -->
          <a class="card" href={`/knowledge/${a.slug}`}>
            <h3>{a.data.title}</h3>
            {a.data.excerpt && <p>{a.data.excerpt}</p>}
          </a>
        ))}
      </div>
    </section>
  ))}
</Base>
```

**聚合要点**
- 过滤条件只有一条：`a.data.scenarios.includes(slug)` + `published`。
- 一篇文章同时属于 `scenario-a` 和 `scenario-c` → 分别出现在两个场景页，**这是预期行为**。
- 单页内用 `slug` 去重（正常不会发生重复，除非 frontmatter 写重）。
- 排序统一用 `publishedAt` 倒序，`featured` 可加权置顶。

---

## 5. 知识库页（板块 B）筛选与搜索

板块 B 是「全量文章 + 客户端分面筛选」。静态站无服务端，筛选在浏览器里做：所有文章已渲染进 HTML，JS 只控制显隐。

### 5.1 页面（`src/pages/knowledge/index.astro`）

```ts
---
import { getCollection } from 'astro:content';
import { scenarios, categories, scenarioMap, categoryMap } from '../../data/taxonomy';

const articles = (await getCollection('articles', ({ data }) => data.published))
  .sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());
---
<Base title="知识库">
  <!-- 筛选条：场景 chips -->
  <nav class="filters" id="f-scenario">
    <button class="chip is-active" data-filter data-type="scenario" data-value="">全部场景</button>
    {scenarios.map((s) => (
      <button class="chip" data-filter data-type="scenario" data-value={s.slug}>{s.name}</button>
    ))}
  </nav>

  <!-- 筛选条：分类 chips -->
  <nav class="filters" id="f-category">
    <button class="chip is-active" data-filter data-type="category" data-value="">全部分类</button>
    {categories.map((c) => (
      <button class="chip" data-filter data-type="category" data-value={c.slug}>{c.name}</button>
    ))}
  </nav>

  <!-- 搜索框 -->
  <input id="search" type="search" placeholder="搜索标题与正文…" />

  <p id="count"></p>

  <div class="grid" id="list">
    {articles.map((a) => (
      <article
        class="card"
        data-scenarios={JSON.stringify(a.data.scenarios)}
        data-categories={JSON.stringify(a.data.categories)}
        data-text={`${a.data.title} ${a.data.excerpt ?? ''}`}
      >
        <a href={`/knowledge/${a.slug}`}><h3>{a.data.title}</h3></a>
        {a.data.excerpt && <p>{a.data.excerpt}</p>}
      </article>
    ))}
  </div>
</Base>

<script is:inline>
  const list = document.getElementById('list');
  const cards = [...list.querySelectorAll('.card')];
  const countEl = document.getElementById('count');
  const search = document.getElementById('search');
  const state = { scenario: '', category: '', q: '' };

  function apply() {
    let visible = 0;
    for (const card of cards) {
      const sc = JSON.parse(card.dataset.scenarios || '[]');
      const ca = JSON.parse(card.dataset.categories || '[]');
      const text = (card.dataset.text || '').toLowerCase();
      const okS = !state.scenario || sc.includes(state.scenario);
      const okC = !state.category || ca.includes(state.category);
      const okQ = !state.q || text.includes(state.q.toLowerCase());
      const show = okS && okC && okQ;
      card.style.display = show ? '' : 'none';
      if (show) visible++;
    }
    countEl.textContent = `共 ${visible} 篇`;
    // 同步到 URL，便于分享筛选结果
    const params = new URLSearchParams();
    if (state.scenario) params.set('scenario', state.scenario);
    if (state.category) params.set('category', state.category);
    if (state.q) params.set('q', state.q);
    history.replaceState(null, '', `?${params.toString()}`);
  }

  document.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      document.querySelectorAll(`[data-type="${type}"]`).forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      state[type] = btn.dataset.value;
      apply();
    });
  });
  search.addEventListener('input', () => { state.q = search.value.trim(); apply(); });

  // 进入页面时还原 URL 中的筛选参数
  const p = new URLSearchParams(location.search);
  if (p.get('scenario')) { state.scenario = p.get('scenario'); /* 同步激活对应 chip */ }
  if (p.get('category')) { state.category = p.get('category'); }
  if (p.get('q')) { state.q = p.get('q'); search.value = state.q; }
  apply();
</script>
```

**筛选方案要点**
- **分类筛选 + 场景筛选可叠加**（AND 关系），再叠加文本搜索。
- 全部文章始终在 HTML 中（利于 SEO 与无 JS 降级），JS 仅切换 `display`。
- 筛选状态写入 URL（`?scenario=&category=&q=`），可分享、可刷新保留。
- 进入页面读取 URL 参数还原筛选，体验连贯。
- 若文章量很大（数千篇），客户端遍历仍可用；超大规模再引入 Pagefind 全文索引或预生成 JSON。

---

## 6. 文章详情页共用方案

两板块都链到 `/knowledge/[slug]`，详情页**只此一份**，从同一集合读取。

```ts
// src/pages/knowledge/[slug].astro
---
import { getCollection, render } from 'astro:content';

export async function getStaticPaths() {
  const all = await getCollection('articles', ({ data }) => data.published);
  return all.map((article) => ({
    params: { slug: article.slug },
    props: { article },
  }));
}

const { article } = Astro.props;
const { Content } = await render(article);
const d = article.data;
---
<Base title={d.title} description={d.excerpt}>
  <article>
    <h1>{d.title}</h1>
    <p class="meta">
      发布于 {d.publishedAt.toISOString().slice(0, 10)}
      <!-- 展示归属，强化双维度线索，也利于内链 -->
      场景：{d.scenarios.map((s) => scenarioMap.get(s)?.name).filter(Boolean).join('、')}
      分类：{d.categories.map((c) => categoryMap.get(c)?.name).filter(Boolean).join('、')}
    </p>
    <Content />
  </article>

  <!-- 相关推荐：同场景或同分类的其他文章（内链闭环） -->
</Base>
```

**共用要点**
- 板块 A 卡片：`href={`/knowledge/${slug}`}`；板块 B 卡片：同一 `href`。**URL 唯一**，无重复内容。
- 详情页内可展示「所属场景 / 所属分类」，并把它们做成指向对应聚合页的链接，形成内链闭环。
- 面包屑可按入口动态显示（场景页进来显示「场景 A / 文章」，知识库进来显示「知识库 / 文章」），但 canonical URL 始终是 `/knowledge/[slug]`。

---

## 7. GitHub Actions 自动构建部署

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install
        run: npm ci

      - name: Build
        run: npm run build
        env:
          # 若用外部 CMS（如 Keystatic GitHub 模式）读取内容，需要此令牌
          KEYSTATIC_GITHUB_TOKEN: ${{ secrets.KEYSTATIC_GITHUB_TOKEN }}

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: my-content-site   # 在 Cloudflare Pages 后台创建的项目名
          directory: ./dist               # Astro 构建产物
          wranglerVersion: '3'
```

> 若使用 `@astrojs/cloudflare` 适配器，本地 `astro build` 产出 `dist/`，直接交给我们上面的 action 即可；无需 Wrangler 额外配置函数。

**密钥配置（仓库 Settings → Secrets）**
- `CLOUDFLARE_API_TOKEN`：含 `Pages: Edit` 权限的 API Token。
- `CLOUDFLARE_ACCOUNT_ID`：Cloudflare 账户 ID。
- `KEYSTATIC_GITHUB_TOKEN`（可选）：若内容经 GitHub API 读取，需一个 `contents:read` 的 PAT。

---

## 8. 技术细节与潜在问题

1. **单一数据源 ↔ 双板块同步**
   所有展示都来自 `articles` 集合 + `taxonomy`。改一篇文章 frontmatter，板块 A/B 与详情页在下一次构建时**全部自动更新**。不要在多处复制内容。

2. **多归属的去重与圈选**
   一篇文章可同时命中多个场景/分类，这是特性不是 bug。列表页内用 `slug` 作为唯一键防止同页重复；跨页（不同场景页）出现同一篇是预期。

3. **`published` 总开关**
   两个板块都应统一过滤 `published !== false`，否则会出现「场景页有、知识库没有」或反之的不一致。

4. **Schema 校验与静默丢弃**
   Zod 校验失败的文章会被 Astro 在构建时**直接报错**（好）——但若你改用外部 CMS reader（如 Keystatic），某些 reader 会**静默丢弃**字段值不在选项表里的条目。务必保证 `scenarios`/`categories` 的值都存在于 `taxonomy`，否则文章会“消失”。

5. **URL 与重复内容（SEO）**
   详情页唯一真源，聚合页是 hub 页（带 `?` 筛选参数的知识库页对搜索引擎应 `noindex` 或 canonical 回 `/knowledge/`）。场景页/分类页是独立主题页，可正常索引。

6. **客户端筛选 vs 构建期聚合**
   板块 A 用**构建期**聚合（SSG，利于 SEO、首屏直出）；板块 B 用**客户端**筛选（无需服务端）。两者职责分清，不要试图在服务端按 query 参数过滤静态页。

7. **搜索扩展性**
   数百篇内，上面的客户端遍历足够。若到数千篇：①改用 Pagefind 做全文检索；②或预生成 `articles.json` 交给前端做离线索引。

8. **可访问性**
   筛选控件用 `<button>`（`aria-pressed`）而非 `<a>`，避免无意义的导航；搜索框带 `<label>`；卡片链接语义清晰。

9. **i18n（可选）**
   若要双语：推荐「每篇文章双语字段」（`title: { zh, en }`）或「每 locale 一份文件 + locale 前缀路由」；分类/场景元信息同样双语。保持「单集合」原则不变，只是字段变双语对象。

10. **Cloudflare 边缘缓存**
    构建部署后有边缘缓存，验证时若看到旧 HTML，用 `?cb=<时间戳>` 破坏缓存重抓；生产环境通过 `Cache-Control` 与 `purge` 控制。

11. **缩略图/封面**
    用 Astro `image()` 字段可在构建期自动优化；若封面来自外部 URL，注意 Cloudflare 图片优化与跨域。

12. **预览环境**
    `astro preview` 在非 Node 适配器下可能不支持；本地预览用 `npx serve dist` 或 `python3 -m http.server` 即可。
