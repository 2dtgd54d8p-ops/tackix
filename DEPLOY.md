# 部署到 Cloudflare Pages —— Cheat Sheet

本文件仅作部署对照，代码已就绪（`main` 分支），你只需完成账号侧操作。

## 前置（已完成 ✅）
- 仓库 `2dtgd54d8p-ops/tackix` 已就绪（`main` 分支，含 Astro + Keystatic + Cloudflare 配置，`npm run build` 已验证通过）。
- GitHub App `tackix-cms-app` 已创建：
  - **slug** = `tackix-cms-app`（非机密，已写入 `.env.example`）
  - **client_id** = `Iv23litB8zAFrfDlYNDT`（非机密，已写入 `.env.example`）
  - 回调 `https://tackix.pages.dev/api/keystatic/github/oauth/callback`、权限 `Contents:write` + `Metadata:read` 均已配好。
- 你最早手动建的旧 App（`Iv23livuZEcbeP0HnRk8`）可删除，本项目用新建的 `tackix-cms-app`。

---

## 步骤 A：GitHub App 补一个 Client Secret 并安装（≈1 分钟）

1. 打开 `https://github.com/settings/apps/tackix-cms-app`
2. 左侧 **Client secrets** → **Generate a new client secret** → 复制 `ghs_...` 那串（只显示一次）。
3. 安装到仓库：打开 `https://github.com/apps/tackix-cms-app/installations/new` → 选 `tackix` → **Install**。

---

## 步骤 B：Cloudflare Pages 连接部署（≈3 分钟）

1. Cloudflare 控制台 → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → 授权 GitHub → 选仓库 **`tackix`** → **Begin setup**。
2. Build 配置：
   - Framework preset = **Astro**
   - Build command = `npm run build`
   - Output directory = `dist`
   - Node.js version = **22**
   - ⚠️ **不要设置任何「Deploy command / 部署命令」**（保持为空）。Pages 连 Git 后会自动部署 `dist/`。
     若误填了 `npx wrangler deploy`，会报 `It looks like you've run a Workers-specific command in a Pages project` 并部署失败。
   - ⚠️ 仓库**已移除 `wrangler.toml`**（它会被 Cloudflare 误当成 Workers 部署而触发上面的错误）。Pages Git 集成不需要它。
3. **环境变量**（**Production 和 Preview 都要加**；机密项选 Secret 类型）：

| 变量 | 值 | 类型 |
|---|---|---|
| `PUBLIC_GITHUB_OWNER` | `2dtgd54d8p-ops` | 明文 (build) |
| `PUBLIC_GITHUB_REPO` | `tackix` | 明文 (build) |
| `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` | `tackix-cms-app` | 明文 (build) |
| `PUBLIC_SITE_URL` | `https://tackix.pages.dev` | 明文 (build) |
| `KEYSTATIC_GITHUB_CLIENT_ID` | `Iv23litB8zAFrfDlYNDT` | secret |
| `KEYSTATIC_GITHUB_CLIENT_SECRET` | 步骤 A 生成的 `ghs_...` | secret |
| `KEYSTATIC_SECRET` | 自行生成（见下方命令） | secret |
| `KEYSTATIC_GITHUB_TOKEN` | 你的 `ghp_...` 令牌 或专用 Fine-grained PAT | secret |

   `KEYSTATIC_SECRET` 生成命令（本地终端跑一次，复制输出）：
   ```bash
   python3 -c "import secrets; print(secrets.token_urlsafe(32))"
   ```
4. **Settings → Functions → KV namespace bindings** → **Add binding**：
   - Variable name = `SESSION`
   - 绑定一个 KV 命名空间（没有就先 **Create a namespace** 再选）。
   - ⚠️ 不绑 `SESSION`，Keystatic 后台 OAuth 必失败。
   - 同页 **Compatibility flags** → 勾选 **`nodejs_compat`**（Keystatic 的 reader 用到 `node:path`/`node:fs`，运行时需此标志；原先写在 `wrangler.toml` 里，移除后改在控制台开）。
5. 返回部署页 **Save and Deploy**。

---

## 验证
- 部署完成后访问 `https://tackix.pages.dev` → 应看到含示例文章「Hello Tackix」的站点。
- 访问 `https://tackix.pages.dev/keystatic` → 用 GitHub 登录 → 可写文章并回写仓库。
- 若 `/keystatic` 登录报回调错误：确认 GitHub App 的 Callback URL 与上方一致，且 App 已 Install 到 `tackix`。

---

## 进阶：把 ghp_ 令牌换成 Fine-grained PAT（长期稳定运行）

`KEYSTATIC_GITHUB_TOKEN` 是给 **Cloudflare 拉取仓库文章内容**用的（只读即可），与 GitHub App 的 OAuth（登录后台写文章）是两回事，别混淆。首次部署可用你给的 `ghp_...`，但它 7 天过期且权限是整库 `repo` 全权限，长期不稳妥。建议部署后立即换成 **Fine-grained PAT**（限定 `tackix` 仓库 + Contents 只读 + 可设长期有效）。

### 1. 创建 Fine-grained PAT（≈2 分钟）
1. github.com → 头像 → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**。
2. Token name：`tackix-readonly`（随意）；Expiration：选 **No expiration**（或 1 year）。
3. Resource owner：选 **`2dtgd54d8p-ops`**（必须选你的账号才能选到仓库）。
4. Repository access：**Only select repositories** → 勾选 **`tackix`**。
5. Permissions → Repository permissions → **Contents** → **Read-only**（其余全部 No access）。
6. 底部 **Generate token** → 复制 `github_pat_...` 开头那串（只显示一次）。

### 2. 更新 Cloudflare 环境变量
1. Cloudflare → tackix Pages → **Settings** → **Environment variables** → 找到 `KEYSTATIC_GITHUB_TOKEN` → **Edit** → 粘贴新 `github_pat_...` → Save。
2. 回到 **Deployments** → 最新部署 **⋯ → Redeploy**（改了变量需重新部署让 Functions 加载新值）。**Production 和 Preview 都要改**（若两边都配了）。

### 3. 撤销旧的 ghp_ 令牌（建议）
github.com → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → 找到旧 `ghp_...` → **Revoke**。撤销不影响已建好的仓库与 App；之后若需本地 `git push` 再临时建 fine-grained 即可。

---

## 注意事项
- ⏰ 你给的 `ghp_...` 令牌约 **10/10 过期**；过期后 `KEYSTATIC_GITHUB_TOKEN` 失效，站点读不到 GitHub 内容。建议部署后换成专用 **Fine-grained PAT**（仅对 `tackix` 给 `Contents:read`），长期可用。
- `.env.example` 只是模板，Cloudflare **必须单独填真实环境变量**（构建时读真实环境变量，不读 `.env.example`）。
- 公开站点（文章列表/详情）上线**不依赖** slug/secret；只有 `/keystatic` 后台登录写回仓库才需要它们。可先部署看站点，后台后补也行。
- `public/robots.txt` 已屏蔽 `/keystatic` 被搜索引擎收录；`public/_headers` 已设相应头。
