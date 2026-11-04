# 选型数据基座 · 设计与落地（tackix）

> 本文是跨设备 / 跨会话的**唯一真相源**：任何新会话、新机器接手，先读这里。
> 最后更新：2026-11-02 ｜ 所在分支：`refactor/d1-content-backend`

## 0. 一句话
为 tackix（工业胶粘剂/密封剂选型知识平台）建立结构化「选型数据基座」：产品主数据 + 基材 + 应用场景 + 兼容矩阵，支撑**选型、搜索、AI 问答**。

## 1. 背景与决策

- 当前两套后端并存：
  - **线上 main**：Keystatic（GitHub 存储）——已部署、预上线态（noindex）。
  - **WIP refactor**：自建 Cloudflare **D1 + R2** 后台——未部署。
- 数据基座的核心是**关系 + 查询**（基材 × 产品矩阵、多条件选型），关系库更合适，YAML 文件堆不适合。
- 方案结论：
  - **过渡期：混合**（长文继续 Keystatic，选型结构化数据上 D1）——快速见效、零风险。
  - **终局：全量 D1**（补齐编辑器 + `content_revisions` 版本回滚后收敛为单源单后台）。
- 长期运营判断：**全量 D1** 在运维面 / 一致性 / 安全上更优；**混合是阶段性最优**，不宜作为终局（两套后台/登录/发布是长期运营税）。

## 2. 数据模型（D1 表）

文件：`migrations/0002_domain.sql`（幂等：`IF NOT EXISTS` / `INSERT OR IGNORE`）。
与 `0001_init.sql` 的 `content_entries`（长文内容）**并存**，不替换。

| 表 | 作用 | 关键点 |
|---|---|---|
| `products` | 产品主数据（胶粘剂/密封剂） | 牌号/化学体系/固化/粘度/拉伸/耐温/硬度/混合比/操作时间；`attrs` 存扩展 JSON |
| `substrates` | 基材库 | 金属/塑料/木材/玻璃/陶瓷/混凝土/复合材料/橡胶；`surface_energy` 高/低 |
| `applications` | 应用场景 / 工况 | 环境（室内/室外/水下/高温/化学）+ 载荷类型 + 认证 |
| `compatibility` | **基材 × 产品 → 适配度（选型核心）** | `suitability` 1–4；`primer_req` 是否需底涂；`UNIQUE(product_id, substrate_id)` |
| `product_applications` | 产品 × 场景（多对多） | 复合主键 |
| `product_docs` | TDS/SDS 文档索引 | 实体文件存 R2，表里存 `r2_key` / `url` |
| `suppliers` | 供应商 / 货源 | 区域/MOQ/交期/参考价 |
| `selection_rules` | 选型规则引擎（先留表不启用） | `conditions` / `boost` JSON |

**种子数据**：内置 14 条标准基材（`SUB-ALU` … `SUB-RUBBER`）+ 7 条应用场景（`APP-AUTO` … `APP-DIY`），可增删。

## 3. 迁移与导入

### 3.1 建表
```bash
npx wrangler d1 migrations apply tackix-content --local   # 本地
npx wrangler d1 migrations apply tackix-content --remote  # 线上（需已建库 + API token）
```
> 会依次执行 `0001_init.sql` + `0002_domain.sql`。

### 3.2 存量长文（知识库/场景/单例）
复用现有脚本：
```bash
node scripts/migrate-to-d1.mjs --local     # 本地
node scripts/migrate-to-d1.mjs --remote    # 线上
```

### 3.3 产品与兼容矩阵（CSV / JSON）
脚本：`scripts/import-products.mjs`（幂等 `INSERT OR REPLACE`）
```bash
node scripts/import-products.mjs --template data/products.sample.csv   # 生成 CSV 模板
node scripts/import-products.mjs --file data/products.csv --compat data/compatibility.csv --local
node scripts/import-products.mjs --file data/products.json --remote   # JSON 可内含 products + compatibility
node scripts/import-products.mjs --file data/products.csv --sql-only   # 只生成 SQL 检查
```
- products 列：`id,slug,brand,name_zh,name_en,category,chemistry,cure_type,color,viscosity,tensile_str,elongation,temp_min,temp_max,shore,mix_ratio,pot_life_min,cure_time_min,shelf_life,features`
- compatibility 列：`product_id,substrate_id,suitability,primer_req,surface_prep,note`
- `product_id` 可写 id 或 slug；`substrate_id` 可写 `aluminum` 或 `SUB-ALU`（内置映射）

## 4. 落地路线

| 阶段 | 内容 | 依赖 |
|---|---|---|
| P0 | D1(`tackix-content`) + R2(`tackix-media`) 建库 + 密钥 + 推 `eac70df` | — |
| P1 | apply `0002_domain.sql` | P0 |
| P2 | 存量长文迁移（`migrate-to-d1.mjs`） | P1 |
| P3 | 后台录入 UI（products/substrates/applications/compatibility/suppliers） | P1 |
| P4 | 批量导入（`import-products.mjs`） | P1 |
| P5 | `/api/select` 选型服务（JOIN 四表，按 suitability 排序） | P3/P4 |
| P6 | Vectorize 灌 product+knowledge，接 AI 问答 RAG | P5 |
| P7（终局） | 长文并入 D1 + `content_revisions` 版本回滚，收敛全量 D1 | P6 |

## 5. 开放问题

- 产品主数据是否已有结构化源（Excel/CSV）？无则走后台录入 + 批量导入。
- 兼容矩阵：人工标注 vs 按 chemistry×substrate 规则半自动生成？
- 编辑器选型：TipTap / Milkdown，还是先「Markdown 源码 + 预览」？
- `content_revisions` 表设计（前后快照 + 一键回滚）待定。

## 6. 换设备 / 换会话如何继续

1. 克隆仓库并切分支：`git checkout refactor/d1-content-backend`
2. 读本文 + `DEPLOY-RUNBOOK.md`（仓库根）
3. 凭据在 **GitHub Secrets** 与 **Cloudflare 控制台**，不在任何本机文件里
4. 给新会话一段自包含 prompt（示例）：
   > 项目 tackix，仓库 `2dtgd54d8p-ops/tackix`，分支 `refactor/d1-content-backend`。
   > 先读 `docs/data-foundation-design.md` 与 `migrations/0002_domain.sql`，然后按本文第 4 节推进 P5（写 `/api/select`）。

## 7. 变更记录

- 2026-11-02 初版：确定选型领域基座；新增 `0002_domain.sql`（8 表 + 种子）、`import-products.mjs`；本文档。
- 2026-11-04 全量 D1 落地（见下节第 8 节）。
- 2026-11-04 媒体改 KV（§8.7）、版本回滚闭环（§9）、死配置核查与清理（§10）。

## 8. 全量 D1 落地实况（2026-11-04）

### 8.1 单库收敛（终态）
只有一个 D1 库：`tackix-content` = `6983915c-5ed7-4e64-be33-16c1d4da8498`（WNAM），绑定名 `DB`。
历史上还有 `tackix-db` = `169af261-6c6f-4590-84c7-c7e994bd42b5`，只存 `submissions` / `visits`，
已通过 `migrations/0004_business.sql` + 数据搬迁并入 `tackix-content`（1 条询盘 + 77 条访问，原子无损）。
旧库仅作**冷备**保留，不再有任何绑定，确认无问题后可在控制台删除。

Pages 只支持**一个** `DB` 绑定，这是必须单库的硬约束。

### 8.2 表清单（tackix-content）
- 内容：`content_entries`、`content_revisions`
- 选型域：`products`、`substrates`、`applications`、`compatibility`、`product_docs`、`product_applications`、`suppliers`、`selection_rules`
- 业务：`submissions`、`visits`

### 8.3 发布机制（重要变更）
Pages 项目为**直接上传模式**（`source=undefined`，未连 Git）→ **Deploy Hook 不可用**。
后台「发布」按钮改为双通道（`src/pages/api/content/publish.ts`）：
1. `PAGES_DEPLOY_HOOK`（若将来项目改为连 Git 仓库，配了就用这条）
2. `GITHUB_DISPATCH_TOKEN` → `POST /repos/2dtgd54d8p-ops/tackix/actions/workflows/deploy.yml/dispatches`（`ref=main`）

### 8.4 环境变量（Cloudflare Pages 项目，production）
密钥类全部为 **secret_text**：`ADMIN_PASSWORD`、`SESSION_SECRET`、`GITHUB_DISPATCH_TOKEN`、
`ADMIN_TOKEN`、`RESEND_API_KEY`、`CONTACT_NOTIFY_TO`。构建期变量由 GitHub Actions 注入，
不写在 `wrangler.toml`。

> ⚠️ **坑**：`wrangler pages deploy` 会把 `wrangler.toml` 未声明的 **plain_text** 变量清空
> （secret_text 不受影响）。因此所有线上变量都必须是 secret_text，且 `wrangler.toml` 里
> **不要写 `[vars]`**、**不要写 `account_id`**（Pages 配置校验会直接报错）。

### 8.5 两个已修复的线上 Bug
1. `wrangler.toml` 含 `account_id` → `wrangler pages deploy` 校验失败（CI run 41752433655 红）。
2. **API 路由只把 `locals` 传给 `isAuthed`** → Cloudflare 适配器下 `locals` 无 `request`/`cookies`，
   会话 cookie 恒读不到，表现为「登录成功但所有后台接口 401」。修复：7 个路由统一改传完整 `ctx`。

### 8.6 验证基线
- 构建期 D1 拉取：`[fetch-content] ✅ …（knowledge 12 / scenarios 4 / singletons 8）`
- 生成快照与 D1 语义**完全一致**（仅 key 顺序不同），证明迁移无损
- 后台链路：`POST /api/admin/login` → 会话 cookie（HttpOnly+Secure）→ `/api/admin/me` 返回 `authed:true`
  → `/api/content/list` 读到 D1 条目 → `POST /api/content/publish` 触发 GitHub Actions

### 8.7 尚未完成
- ~~R2 未开通，媒体走 ASSETS 回退~~ → **已改 KV**（2026-11-04）：`MEDIA_KV` = `e959f2b9…`，
  读取链 `R2 → KV → ASSETS` 三级回退，上传落 KV（单文件 20MB，图片 + PDF）。R2 仍需绑卡才能开，
  不是必需项；将来开通只需加绑定，代码不用改。
- 选型域表尚未接后台录入 UI（P3）与 `/api/select`（P5）
- 站点仍处于预上线态（noindex + 询盘闸门关闭）

### 8.8 推送兜底：`scripts/push-via-api.mjs`
本机网络经公司代理，`github.com`（git 传输层）经常被拦——`git push` 报
`CONNECT tunnel failed, response 502` 或直连超时，但 `api.github.com` 通常仍可达。

此时用：

```bash
GITHUB_TOKEN=<PAT> node scripts/push-via-api.mjs           # 推当前分支 + 快进 main
GITHUB_TOKEN=<PAT> node scripts/push-via-api.mjs --dry-run # 只看会推什么
```

原理：读远端分支 head 的 tree，在本地历史里找 tree 相同的提交当基点（API 造出的提交本地没有
对象，但 tree 一致，可据此对齐），然后逐提交上传 blob → 建 tree → 建 commit → 移动分支指针。

> 注意：用脚本推完后，本地的 commit sha 与远端**不同**（内容相同）。下次本地继续开发不受影响
> ——脚本每次都会重新按 tree 对齐基点。若哪天 `github.com` 恢复，`git fetch && git reset --hard origin/main`
> 即可把本地历史与远端对齐。

## 9. 内容版本历史与一键回滚（2026-11-04）

`content_revisions` 表此前**只写不读**——每次保存都留快照，但没有任何读取/恢复入口，等于内容被
后台改坏后无法回退。现已补齐闭环，三层：

| 层 | 文件 | 作用 |
|---|---|---|
| 数据 | `src/lib/content-db.ts` | `listRevisions` / `readRevision` / `countRevisions`，全部 try/catch（未应用 `0003` 迁移时返空，不阻断页面） |
| 接口 | `src/pages/api/content/revisions.ts` | `GET ?id=` 列表、`GET ?revisionId=` 单快照、`POST {id,revisionId}` 回滚 |
| 界面 | `src/pages/admin/revisions.astro` | 历史列表（时间/动作/体积）+ 懒加载 JSON 预览 + 一键回滚；入口在 `/admin/edit` 顶部「版本历史」 |

设计要点：
- **entry id 规则**与 `save.ts` 一致：`${kind}/${slug}`，如 `singleton/contact`、`knowledge/xxx`。
- **防跨条目回滚**：回滚前校验 `rev.entry_id === id`，不匹配返 400。
- **回滚也留痕**：回滚写一条 `action='restore:<revisionId>'` 的新快照，所以「回滚」本身还能被回滚。
- **回滚不等于上线**：只改 D1，需点「发布」重建站点前台才生效（接口 message 已明说）。
- `published` / `featured` 不在快照里，回滚时沿用当前行的值，避免把已发布状态改掉。

生产验收（`https://tackix.pages.dev`，23 项全过）：登录 → 保存产生快照 → 预览快照与当前内容
sha256 一致 → 跨条目回滚 400 → 回滚 200 且有 `restoredFrom` → 快照数再 +1 且 `action=restore:N`
→ 内容 sha256 与 baseline 一致 → 页面 200 / 未登录 302。

## 10. 遗留 YAML 与死配置清理（2026-11-04 核查）

### 10.1 `src/content/*.yaml`（16 个文件）—— **不能删**
原计划当死文件删掉，逐个核查后发现仍有真实引用，删除会造成回归：

| 引用方 | 用途 | 删除后后果 |
|---|---|---|
| `scripts/build-checks.mjs`（prebuild） | 校验文章字段/词表一致性 | 目录不存在时打日志跳过，校验静默失效 |
| `scripts/quality-score.mjs`（prebuild） | 生成 `reports/quality-report.json` | 质量报告归零 |
| `scripts/fetch-content.mjs --from-yaml` | D1 不可达时的引导重建路径 | 引导通道断掉 |
| `scripts/migrate-to-d1.mjs` | 一次性迁移工具 | 无法重放迁移 |
| `scripts/ai-enrich.mjs` / `embed.mjs` | 本地内容加工工具 | 工具失效 |
| `scripts/gen-content-options.mjs` | codegen `src/generated/content-options.ts` | 该生成物停止更新 |

结论：保留，作为「引导 + 校验 + 工具链」的输入。真正的真相源已是 D1，两者关系是
**D1 为主、YAML 为历史/引导**；日常运营不再动 YAML。

### 10.2 `src/generated/content-options.ts` 实际无人消费（已知缺口）
`src/lib/admin-schema.ts` 的下拉选项是**硬编码数组**（`SCENARIO_OPTIONS` / `CATEGORY_OPTIONS` /
`TAG_OPTIONS`），并未 import 生成的 `content-options.ts`。后果：在后台新增分类/标签/场景后，
文章编辑器的下拉**不会自动出现新项**（`edit.astro` 会把未知值补一个「(未列出)」选项兜底，所以不
会写坏数据，只是不好选）。修法（未做，属独立小任务）：`admin-schema.ts` 改读 `content-options.ts`
并把 `gen-content-options.mjs` 的场景来源从 YAML 换成 `src/generated/content.json`（D1 快照）。

### 10.3 Cloudflare 死环境变量 —— **已清理**
`KEYSTATIC_ADMIN_PASSWORD` / `KEYSTATIC_PAT` / `KEYSTATIC_GITHUB_TOKEN` / `KEYSTATIC_SECRET` /
`KEYSTATIC_GITHUB_CLIENT_SECRET` 5 个（Keystatic 时代遗留，代码已零引用），production 与 preview
各删一遍：**11 → 6 个**。现存全部 `secret_text`：

`ADMIN_PASSWORD`、`SESSION_SECRET`、`GITHUB_DISPATCH_TOKEN`、`ADMIN_TOKEN`、`RESEND_API_KEY`、`CONTACT_NOTIFY_TO`

清理后回归：登录 200、`/api/admin/me` authed、`/api/content/list` 24 条、版本历史 2 条、后台页 200。

> 说明：`PUBLIC_GITHUB_*` / `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` 在更早的部署里已随 `[vars]` 移除而不存在。
> `.astro/keystatic-imports.js` 是构建缓存（`.astro/` 已 gitignore），无需处理。
> 仓库根 `DEPLOY-RUNBOOK.md` 仍是「D1 + R2」旧口径（且未纳入版本管理），建议删除或重写。

