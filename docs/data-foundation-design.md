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
- R2 未开通（`tackix-media` 未创建），媒体走 `src/pages/uploads/[...slug].ts` 的 `ASSETS` 静态回退；
  `/api/media/upload` 目前会返回「MEDIA 未绑定」
- 选型域表尚未接后台录入 UI（P3）与 `/api/select`（P5）
- 站点仍处于预上线态（noindex + 询盘闸门关闭）
