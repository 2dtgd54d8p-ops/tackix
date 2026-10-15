# Tackix — Site Structure & Content Plan (Bilingual: zh-CN + en)

> Content-architecture blueprint for the scenario-based industrial adhesive & sealant
> knowledge platform. Target audience: overseas contractors, installers and DIY users.
> Products are **not** a standalone database — they are embedded as "recommended products"
> inside each scenario page.
>
> **Bilingual (since 2026-10):** every page renders in **中文 (zh-CN, default, no URL prefix)**
> and **English (en, `/en` prefix)**. UI strings, singleton copy (`home`/`ui`/`contact`/`pages`/
> `detail`/`about`/`site`/`categories`/`tags`) and collection content (`knowledge`/`scenarios`)
> are all bilingual. Fill both languages in the Keystatic backend (`/keystatic`) before launch.

---

## 1. Site Structure (tree)

```
/                         Home (zh-CN default)
/en/                     Home (English mirror)
/solutions  /en/solutions                Scenario Solutions — list
/solutions/[slug]  /en/solutions/[slug]  Single scenario
/knowledge  /en/knowledge                Knowledge Base (category filter ?cat=)
/knowledge/[slug]  /en/knowledge/[slug]  Single article (FAQPage schema)
/about  /en/about                        About
/contact  /en/contact                    Contact & Enquiry
/search  /en/search                      Full-text search (Pagefind UI)
/llms.txt                AI-readable sitemap (bilingual link list)
/sitemap.xml             XML sitemap (zh-CN + en alternates, x-default)
```

Collections (Keystatic, `src/content/`):
- `knowledge/` — articles (`title` = slug; `name` = `{zh,en}` bilingual display title; `body` = `{zh,en}`)
- `scenarios/` — scenario solutions (same bilingual shape)

Singletons (Keystatic, root `*.index.yaml`):
- `home` · `ui` · `contact` · `pages` · `detail` · `about` · `site` · `categories` · `tags`
- All copy fields authored as bilingual `bi()` (`{zh,en}`); rendered via `pickB(locale, v)`.

Language: **Bilingual.** `zh-CN` is the default with **no URL prefix**; `en` is the
**`/en` prefix** mirror. Top-bar language button swaps the `/en` prefix and stores the
preference in `localStorage('locale')`; the URL path is the source of truth. No Vi/Th yet.

---

## 2. Homepage Content Framework (`home` singleton)

| Field | Placeholder |
|---|---|
| `heroEyebrow` | "Scenario-based material selection, made simple" |
| `heroCta1` | "Explore solutions" → `#solutions` |
| `heroCta2` | "Contact us for quotation" → `/contact` |
| `scenariosTitle` | "Scenario Solutions" |
| `scenariosSub` | "Four high-frequency jobs, each with a clear recommendation, the reasoning behind it, and products to ask about." |
| `knowledgeTitle` | "Knowledge Base" |
| `knowledgeSub` | "Guides, pitfalls and troubleshooting for real-world adhesive & sealant jobs." |
| `bandTitle` | "Need a tailored recommendation?" |
| `bandSub` | "Tell us your substrates, conditions and volume — our engineers will recommend a grade and quote." |
| `bandCta1` | "Contact us for quotation" → `/contact` |
| `bandCta2` | "Browse the Knowledge Base" → `/knowledge` |

Trust band (from `site` singleton `trust` + `certBadges`): title + subtitle + certification
badges (e.g. ISO 9001, RoHS, REACH). Hero stats show live counts:
`{scenarioCount} Scenario solutions · {articleCount} Knowledge articles · {categoryCount} Categories · {tagCount} Topics`.

---

## 3. Scenario Solutions — 4 frameworks

Each scenario page renders: **Bottom-line recommendation** → **Selection logic** (3–5 points)
→ optional **Body** → **Recommended products** (2–3 placeholders) → **FAQ** → **Inquiry CTA**.

### S1 — 厨卫防霉防漏 (Wet-area anti-mould & leak-proofing)
- **Excerpt:** 厨卫长期潮湿，防霉防漏是密封的第一目标。
- **Bottom-line:** 厨卫潮湿/漏水用**防霉柔性硅酮密封胶**（可长期泡水）；淋浴盘与高位移接缝用**高模量中性固化硅酮**。
- **Selection logic:**
  1. 选**中性固化（脱肟/脱醇）**硅酮——多数表面安全、低气味。
  2. 要求**防霉添加剂**与明确的防霉声明。
  3. 确认**位移能力** ≥ [movement capability]、**温度范围**覆盖 [temperature range]。
  4. 天然石材/金属避开醋酸型硅酮（蚀刻/腐蚀）。
- **Recommended products:** Product A — 防霉卫浴硅酮 ([movement capability] / [temperature range])；Product B — 高模量淋浴硅酮 ([cure time])。
- **FAQ:** "旧胶上能直接打新胶吗？" · "打完多久能沾水？"
- **SEO 优化:** 答案前置（Bottom-line 置于首部高亮）→ FAQ Schema + HowTo Schema（选型要点映射为步骤）。

### S2 — 门窗渗水修补 (Window/door leak repair)
- **Excerpt:** 门窗周边渗水、缝隙漏风，从诊断到修补一条龙。
- **Bottom-line:** 门窗框与洞口缝隙渗水，先用**背衬棒 + 低模量硅酮或 MS 聚合物**封缝；外立面接缝用**耐候可涂装的 MS 聚合物/硅酮**。
- **Selection logic:**
  1. 需涂装/异材粘结选 **MS 聚合物**。
  2. 大热位移接缝选**低模量硅酮**。
  3. 确认**UV 稳定**与耐变色，适配外立面暴露。
  4. 正确塞背衬棒，使密封胶仅双面粘结。
- **Recommended products:** Product C — 外墙 MS 聚合物密封胶 ([paintable] / [movement capability])；Product D — UV 稳定立面硅酮 ([temperature range])。
- **FAQ:** " painted 框架用硅酮还是 MS？" · "缝隙多宽能补？"
- **SEO 优化:** 答案前置 + FAQ Schema + HowTo Schema。

### S3 — 屋顶/墙面裂缝防水 (Roof & wall crack waterproofing) ·新增
- **Excerpt:** 屋顶与外墙裂缝渗水，常由结构伸缩与温差引起。
- **Bottom-line:** 屋顶/墙面裂缝防水用**高弹性、抗 UV 的聚氨酯或硅酮防水涂料/密封胶**；活动裂缝用**低模量、可位移的弹性密封胶**，配背衬棒控制胶层厚度。
- **Selection logic:**
  1. 按裂缝是否活动选**低/高模量**密封胶。
  2. 屋面用**耐候抗 UV 涂层**。
  3. 活动裂缝留足伸缩余量，避免二次开裂。
  4. 背衬棒控制胶深比（约 2:1）。
- **Recommended products:** Product I — 弹性聚氨酯防水 ([temperature range])；Product J — 低模量屋面硅酮 ([movement capability])。
- **FAQ:** "活动裂缝怎么处理才不复发？" · "屋面防水能保几年？"
- **SEO 优化:** 答案前置 + FAQ Schema + HowTo Schema。

### S4 — 瓷砖/石材粘接与填缝 (Tile & stone bonding + grouting)
- **Excerpt:** 瓷砖与天然石材粘贴牢固、不空鼓、不泛碱、填缝美观耐久。
- **Bottom-line:** 瓷砖用 **C2/C2TE 级瓷砖胶**；天然石材用**非污染（白、低碱）胶粘剂** + 配套石材防护；填缝用**柔性、防霉填缝剂**。
- **Selection logic:**
  1. 胶粘剂等级匹配砖尺寸与厚度（大板用 C2TE）。
  2. 天然石材强制**非污染配方**（无可溶性碱析出）。
  3. 控制**开放时间**与**滑移**，适配立面/大砖。
  4. 活动地面配**柔性填缝剂**。
- **Recommended products:** Product E — C2TE 瓷砖胶 ([bed thickness] / [open time])；Product F — 非污染石材胶 ([compatibility])；Product K — 柔性防霉填缝剂。
- **FAQ:** "大理石为什么发黄？" · "大板瓷砖用什么胶？"
- **SEO 优化:** 答案前置 + FAQ Schema + HowTo Schema。

---

## 4. Knowledge Base — 9 placeholder articles

Categories: **Selection Guide** · **Application Pitfalls** · **Troubleshooting**
(tags from `tags` singleton: silicone-sealant, polyurethane, epoxy, ms-polymer, waterproofing,
mould-resistant, tile-stone, expansion-joints, surface-prep, substrate, temperature, diy, professional)

### Selection Guide
1. **Silicone vs Polyurethane vs MS Polymer: which sealant when?** — `selection-guide`, tags: silicone-sealant, polyurethane, ms-polymer. *FAQ: "Can I paint over silicone?"*
2. **How to read a TDS: the properties that actually matter** — `selection-guide`, tags: substrate, temperature. *FAQ: "What is movement capability?"*
3. **Choosing the right adhesive for metal, plastic and FRP** — `selection-guide`, tags: epoxy, substrate. *FAQ: "Why is surface prep critical?"*

### Application Pitfalls
4. **Why your sealant turned yellow or grew mould** — `application-pitfalls`, tags: mould-resistant, silicone-sealant. *FAQ: "Does acetoxy silicone cause yellowing?"*
5. **Surface-prep mistakes that quietly ruin the bond** — `application-pitfalls`, tags: surface-prep, substrate. *FAQ: "Is wiping with solvent enough?"*
6. **Joint design: sizing the gap and using a backing rod** — `application-pitfalls`, tags: expansion-joints, waterproofing. *FAQ: "What happens if the joint is too wide?"*

### Troubleshooting
7. **Sealant won't cure / stays tacky** — `troubleshooting`, tags: silicone-sealant, temperature. *FAQ: "Will it cure in cold weather?"*
8. **Adhesive failed under load — root causes** — `troubleshooting`, tags: epoxy, substrate. *FAQ: "Was it the primer or the mix ratio?"*
9. **Discoloration on natural stone and how to avoid it** — `troubleshooting`, tags: tile-stone, mould-resistant. *FAQ: "Is the stain reversible?"*

Each article template (Markdown body):
```
## Background
[1–2 sentences on the user's situation and the cost of getting it wrong]

## What you need to know
- [bullet: key principle 1]
- [bullet: key principle 2]
- [bullet: key principle 3]

## Step-by-step
1. [action]
2. [action]
3. [action]

## Quick checklist
- [ ] [check 1]
- [ ] [check 2]

## FAQ
**Q: [question]**
A: [answer — also emitted as FAQPage structured data]
```

---

## 5. About Page Framework (`about` singleton)

| Field | Placeholder |
|---|---|
| `pageTitle` | "About Tackix" |
| `pageSub` | "We help overseas contractors, installers and DIY users pick the right adhesive or sealant for the job." |
| `storyTitle` | "Our story" |
| `storyBody` | [origin: frustration that datasheets assume you already know the answer → scenario-first knowledge base] |
| `missionTitle` | "Our mission" |
| `missionBody` | [make material selection transparent & efficient] |
| `factoryCaption` | "Our production facility" |
| `factoryImage` | upload in `/keystatic` (stored to `public/uploads/`) |

Certifications block: reuse `site.certBadges` (label + note) — e.g. ISO 9001 / RoHS / REACH.

---

## 6. Contact Page Notes (`contact` singleton)

- Contact info renders **only filled fields** from `site` singleton: business email, WhatsApp,
  phone, company, address, business hours. Leave empty → hidden (no dead links).
- Form fields: name / business email / application message → `POST /api/contact`.
- Pre-launch: form is gated (returns `{prelaunch:true}`); show notice + direct email/WhatsApp.
- `tipsItems`: what to include — substrates, load/joint movement, temperature range,
  cure preference, certification requirements.

---

## 7. Before launch checklist
- [ ] Fill `site` singleton: company name, email, WhatsApp, address, trust title/sub, cert badges.
- [ ] Fill `home` / `ui` / `contact` / `pages` / `detail` / `about` copy in **both zh-CN and en** in Keystatic.
- [ ] Create 4 scenarios in `scenarios` collection (use §3 frameworks) — `name` + `body` in both languages.
- [ ] Create 9 articles in `knowledge` collection (use §4 template; add FAQ for schema) — both languages.
- [ ] Replace placeholder TDS/SDS PDFs with real files (currently English placeholders).
- [ ] Flip prelaunch gate to live (`launch.js --revert` or set `PRELAUNCH=0`) — this also enables hreflang + canonical.
- [ ] Rebuild & verify `/sitemap.xml` (en alternates), `/llms.txt` (bilingual), `/pagefind` (zh+en indexes).
