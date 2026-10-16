# 内容平台优化提升补强方案（完整版）

> 目标：在现有「单集合 + 双维度（场景/分类）」架构之上，把平台从"内容浏览站"升级为"**价值信息获取工具**"。
> 范围：发现 → 决策 → 应用 → 信任 → 个性化 → AI 原生 → 反馈闭环，并贯穿"数据精准性"地基。
> 原则：**纯静态优先**，仅在确需运行时能力（RAG 问答、订阅推送）才引入 Cloudflare Functions / 外部服务。

---

## 0. 现状基线（已上线，无需重做）

| 能力 | 状态 |
|---|---|
| 单集合 `articles` + 双维度数组（`scenarios` / `categories`） | ✅ 已上线 |
| 场景页聚合（`/scenarios/[slug]`）+ 顶部 overview + 分组 | ✅ 已上线 |
| 知识库列表 + 场景/分类筛选 + 搜索（`/knowledge/`） | ✅ 已上线 |
| 共用详情页 `/knowledge/[slug]`（两入口同链） | ✅ 已上线 |
| i18n 双语、结构化数据（Article/FAQPage/HowTo）、`llms.txt`、`robots.txt` 放行 AI 爬虫 | ✅ 已上线（Tackix 仓库已有） |
| 自动部署（GitHub Actions → Cloudflare Pages） | ✅ 已上线 |

**已知缺口**：核心架构满分，但**生产运营层约 50% 未覆盖**（草稿/排程、i18n 完整度、规模化搜索、度量、重定向、测试）。本方案聚焦补全并做体验跃迁。

---

## 1. 总体补强框架（七层）

```
价值获取闭环
┌─────────────────────────────────────────────────────┐
│ L1 发现 Find      │ 筛选/搜索/相关推荐/类型入口        │ 纯静态
│ L2 决策 Decide    │ 选型向导/对比矩阵/该用A还是B       │ 纯静态
│ L3 应用 Apply     │ 步骤/工具/打包下载/可复制模板       │ 纯静态
│ L4 信任 Trust     │ 新鲜度/变更日志/来源权威/质量分     │ 纯静态
│ L5 个性化 Personal│ 记住语境/收藏清单/订阅更新          │ 大多纯静态
│ L6 AI 原生        │ RAG问答/速览/llms导出              │ 需后端(Worksers)
│ L7 反馈闭环       │ 有帮助投票/无结果采集/冷热报表      │ 轻后端/第三方
└─────────────────────────────────────────────────────┘
        ▲ 贯穿地基：数据精准性（受控词表+构建校验+质量分）
```

---

## 2. 数据精准性地基（贯穿所有层，最高杠杆）

> 一切"有价值、可精准"的前提是**内容数据本身不串、不丢、不漂移**。

### 2.1 受控词表（Closed Vocabulary）
- 场景 / 分类**不用自由输入**，改为枚举下拉；选项由 `taxonomy`（或 Keystatic 的 `scenarios` 集合）生成。
- 效果：彻底杜绝 `scenario-a` vs `scenarioA` 类拼写漂移。

### 2.2 构建期校验 + 孤儿检测（`src/lib/build-checks.ts`）
在 `astro build` 前/中调用，引用不存在的 slug 直接让构建失败：

```ts
import { getCollection } from 'astro:content';
import { scenarios, categories } from '../data/taxonomy';

export async function validateContent() {
  const articles = await getCollection('articles', ({ data }) => data.published);
  const scSet = new Set(scenarios.map((s) => s.slug));
  const catSet = new Set(categories.map((c) => c.slug));
  const errors: string[] = [];

  for (const a of articles) {
    a.data.scenarios.forEach((s) => !scSet.has(s) && errors.push(`${a.slug} 引用不存在的场景 ${s}`));
    a.data.categories.forEach((c) => !catSet.has(c) && errors.push(`${a.slug} 引用不存在的分类 ${c}`));
    if (!a.data.scenarios.length) errors.push(`${a.slug} 未归属任何场景`);
    if (!a.data.categories.length) errors.push(`${a.slug} 未归属任何分类`);
  }
  for (const s of scenarios)
    if (!articles.some((a) => a.data.scenarios.includes(s.slug)))
      errors.push(`场景 ${s.slug} 没有任何文章`);

  if (errors.length) { console.error('[内容校验]\n' + errors.join('\n')); process.exit(1); }
}
```

### 2.3 Facet 预计算注入（让计数永远准确）
构建期为知识库页算好各维度数量，注入 `<script type="application/json">`，前端只读不现算：

```ts
// 知识库页面 frontmatter
const facets = {
  scenario: scenarios.map((s) => ({
    slug: s.slug,
    n: articles.filter((a) => a.data.scenarios.includes(s.slug)).length,
  })),
  category: categories.map((c) => ({
    slug: c.slug,
    n: articles.filter((a) => a.data.categories.includes(c.slug)).length,
  })),
};
```
模板：`<script type="application/json" set:html={JSON.stringify(facets)} />`

### 2.4 内容质量分（写作时拦截）
构建期给每篇算"完整度"（有 excerpt？有标签？有 FAQ？字数够？），缺失则在 CI 警告，倒逼结构化高质量内容。

---

## 3. 知识库前端交互增强（L1/L5）

### 3.1 升级版筛选组件（带数量 + 已选 + 排序 + 历史）
```ts
// 读取注入的 facets JSON，渲染 "场景A (12)"，并据此禁用 0 结果组合
const facets = JSON.parse(document.getElementById('facets')!.textContent!);
const state = { scenario: '', category: '', q: '', sort: 'newest' };

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
    // 相关性排序：标题命中 > 标签命中 > 正文命中
  }
  countEl.textContent = `共 ${visible} 篇`;
  // 已选筛选以可删 pill 展示 + 一键清除
  // pushState 保留筛选历史（支持浏览器后退）
  const p = new URLSearchParams();
  if (state.scenario) p.set('scenario', state.scenario);
  if (state.category) p.set('category', state.category);
  if (state.q) p.set('q', state.q);
  history.pushState(null, '', `?${p.toString()}`);
}
```
要点：chip 显示命中数、已选 pill 可删除、空状态引导、排序（最新/最相关）、卡片显示场景+分类徽章、搜索防抖+高亮、`localStorage` 记忆上次筛选。

### 3.2 内容类型入口（按"我想干嘛"进入）
文章加 `contentType` 字段（`guide` / `compare` / `pitfall` / `howto`），知识库顶部一级 tab，降低选择成本。

---

## 4. 决策层（L2，价值感最强，纯静态）

### 4.1 选型向导（Wizard）
多步问答（基材 / 环境 / 位移量）→ 规则映射推荐方案。纯前端状态机，无需后端：

```ts
const rules = [
  { when: (a) => a.substrate === 'metal' && a.movement > 20, recommend: 'solution-x' },
  // ...
];
```
Tackix 原本即有"选型工具"概念，落此即可把"看文章"变"解决问题"。

### 4.2 对比矩阵 / "该用 A 还是 B"
用结构化字段渲染 side-by-side 对比表，配合 FAQPage/HowTo 结构化数据。

---

## 5. 应用层（L3，纯静态）

- **按场景打包下载**：步骤 + TDS/SDS 等 PDF 一键打包（Tackix 已有 steps + PDF）。
- **前端小工具**：用量估算、参数计算器等纯 JS 工具，零后端、体感强。
- **可复制模板**：参数/代码片段一键复制。

---

## 6. 信任层（L4，呼应"精准性"）

- **新鲜度信号**：显性"本文 X 前更新"。
- **变更日志**：文章修订记录（对 B2B 采购决策是关键可信度）。
- **来源与权威**：作者 / 技术审核标识、引用标准号。
- 结合 §2.4 质量分，形成"写时校验 + 读时可信"双保险。

---

## 7. 个性化（L5）

| 功能 | 实现 | 需后端？ |
|---|---|---|
| 记住语境（最近场景/角色） | `localStorage` → 首页"继续浏览/为你推荐" | 否 |
| 我的收藏清单 | `localStorage` 书签，可导出/分享 | 否 |
| 订阅场景更新 | 新内容邮件/Webhook 通知 | **是**（Workers/第三方） |

---

## 8. AI 原生层（L6，需后端）

- **RAG 站内问答 / Chat**：自然语言提问 → 基于全站内容回答并给来源链接。需 **Cloudflare Workers AI + Vectorize + 构建期产出的内容 JSON**。
- **30 秒速览 / 关键抽取**：详情页自动摘要。
- **llms.txt + `/api` 内容导出**（已具备基础）：让外部 AI 也能消费。
- 这是把平台从"资料库"升级为"答案引擎"的关键一跃。

---

## 9. 反馈闭环（L7，迭代燃料）

- **"是否有帮助"投票** → 训练相关排序。
- **搜索无结果 → 内容缺口清单** → 直接指导选题（接回度量）。
- **冷热内容报表** → 反哺 taxonomy 优化。
- 轻量实现：投票/无结果先落第三方表单或 Workers KV，不必自建账号系统。

---

## 10. 纯静态 vs 需后端 边界

| 纯静态即可（现在能做） | 需后端 / 外部服务 |
|---|---|
| 受控词表、构建校验、Facet 预计算、质量分 | RAG Chat（Workers AI + Vectorize） |
| 内容类型入口、选型向导、对比矩阵、前端工具 | 订阅推送（邮件/Webhook） |
| 知识库筛选增强、卡片徽章、新鲜度/变更日志 | 跨设备书签、协同过滤 |
| localStorage 个性化、收藏、llms 导出 | 真实用户账号体系 |
| 反馈收集（第三方表单/KV） | — |

---

## 11. 分阶段落地路线图

### Phase 0 — 精准性地基（纯静态，P0）
- **目标**：内容数据零漂移、零孤儿、计数精准。
- **改动**：`src/data/taxonomy.ts` 受控词表；`src/lib/build-checks.ts` 校验+孤儿检测（接入 `astro build` 前钩子）；知识库页 Facet 预计算注入；质量分 lint。
- **验收**：CI 中引用不存在 slug / 孤儿文章 → 构建失败；知识库 chip 显示准确数量。

### Phase 1 — 体验跃迁（纯静态，P1）
- **目标**：用户更快拿到对的内容、并能"解决问题"。
- **改动**：升级版筛选组件（数量/已选/排序/空状态/历史）；`contentType` 类型入口；选型向导；对比矩阵；前端小工具；新鲜度+变更日志展示；`localStorage` 收藏与记忆。
- **验收**：筛选 0 死链、筛选状态可分享/可后退；选型向导能输出推荐；收藏跨刷新保留。

### Phase 2 — 度量闭环（轻后端/第三方，P2）
- **目标**：知道双维度组织是否真的帮到用户。
- **改动**：筛选点击/搜索提交埋点；"有帮助"投票 + 无结果采集（落 KV/表单）；定期孤儿/覆盖报告。
- **验收**：能回答"各场景流量、Top 搜索词、无结果词、孤儿内容"四问。

### Phase 3 — 智能跃迁（需 Workers，P3）
- **目标**：平台升级为答案引擎。
- **改动**：构建期产出内容 JSON → Vectorize 建索引 → Workers AI RAG 问答；自动摘要；订阅推送。
- **验收**：自然语言提问命中来源文章；新内容触发订阅通知。

---

## 12. 成功指标（怎么算"全面价值工具"）

| 维度 | 指标 |
|---|---|
| 覆盖 | 0 孤儿文章、0 空场景、每场景 ≥1 篇 |
| 精准 | 0 死链筛选组合、0 slug 漂移、Facet 计数 100% 准确 |
| 发现 | 搜索成功率（有结果率）、平均到达有用内容的点击步数 |
| 决策 | 选型向导使用率、对比页停留 |
| 信任 | 内容新鲜度达标率、变更日志覆盖率 |
| 智能 | AI 问答命中率（含来源）、订阅/回访率 |

---

## 13. 落地建议

- **MVP 起步**：Phase 0 + Phase 1（纯静态，零新增依赖，风险最低，立刻提升精准与体验）。
- **若要只挑 3 件**：① 选型向导 + 内容类型入口（L2，价值感最强）；② RAG 问答（L6，答案引擎，需 Workers）；③ 有帮助投票 + 无结果采集（L7，零成本迭代燃料）。
- **前置澄清**：Phase 3 的 RAG 问答需确认是否启用 Cloudflare Workers AI + Vectorize（涉及配额/密钥），属本方案唯一明确的"跨入动态能力"决策点。

> 本方案所有"纯静态"部分均可基于现有 Keystatic 数据源直接落地；仅 L6/L7 的订阅与 RAG 需要后端，已在文中标注。
