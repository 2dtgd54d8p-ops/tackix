# 部署到 Cloudflare Pages —— Cheat Sheet

本文件仅作部署对照，代码已就绪（`main` 分支），你只需完成账号侧操作。
**无需 GitHub App / 无需 OAuth / 不依赖 GitHub 作为内容后端**——内容后台完全自建（Cloudflare D1 + R2）。

## 前置（已完成 ✅）
- 仓库 `2dtgd54d8p-ops/tackix` 已就绪（`main` 分支，含 Astro + Cloudflare Pages + 自建 D1 后台，`npm run build` 已验证通过）。
- `wrangler.toml` 已配置：D1 绑定 `DB`（`tackix-content`）、R2 绑定 `MEDIA`（`tackix-media`）、`nodejs_compat` 兼容标志、`PAGES_DEPLOY_HOOK` 变量。
- 自建后台登录入口为 `/admin`（口令 + HMAC 会话 cookie），不再有 `/keystatic`。

---

## 步骤 A：Cloudflare 资源准备（≈3 分钟）

1. **D1 数据库**（如尚未创建）：
   ```bash
   wrangler d1 create tackix-content
   # 把输出的 database_id 填进 wrangler.toml 的 [[d1_databases]] database_id
   ```
2. **R2 存储桶**（如尚未创建）：
   ```bash
   wrangler r2 bucket create tackix-media
   ```
3. **执行迁移 + 初次灌库**（把仓库内遗留 YAML 内容写入 D1 / R2）：
   ```bash
   npm run migrate:remote     # 走 Cloudflare D1 REST；需要 CLOUDFLARE_API_TOKEN
   # 或本地： npm run migrate:local
   ```
   灌库脚本幂等（INSERT OR REPLACE），可重复执行。

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
3. **Variables and Secrets**（**Production 和 Preview 都要加**；机密项选 Secret 类型）：

   | 变量 | 值 | 类型 |
   |---|---|---|
   | `PUBLIC_SITE_URL` | `https://tackix.pages.dev` | 明文 (build) |
   | `ADMIN_PASSWORD` | 自建后台登录口令（≥16 位、含大小写+数字） | secret |
   | `SESSION_SECRET` | `python3 -c "import secrets;print(secrets.token_urlsafe(32))"` 输出 | secret |
   | `ADMIN_TOKEN` | 运营工具（留言/报表）访问令牌（随机长串） | secret |
   | `PAGES_DEPLOY_HOOK` | Pages 部署钩子 URL（发布后自动重建；可选） | secret |
   | `CLOUDFLARE_ACCOUNT_ID` | `b4f68b37b18c0891a0df46f3bf4d07f1` | 明文 |
   | `D1_DB_NAME` | `tackix-content` | 明文 |
   | `D1_DATABASE_ID` | 步骤 A 得到的 database_id | 明文 |
   | `CLOUDFLARE_API_TOKEN` | 有 `d1:*` 权限的 token（构建期拉内容用；可选，缺省回退快照） | secret |

4. **Settings → Functions → Compatibility flags** → 勾选 **`nodejs_compat`**（D1/R2 客户端运行时需要）。
   - 无需再绑 `SESSION` KV：后台会话使用内存驱动（`astro.config.mjs` 已设 `session: { driver: 'memory' }`，仅用于 Astro 会话占位，真正的鉴权靠 HMAC cookie）。
5. 返回部署页 **Save and Deploy**。

---

## 验证

- 部署完成后访问 `https://tackix.pages.dev` → 应看到含示例文章「Hello Tackix」的站点。
- 访问 `https://tackix.pages.dev/admin` → 输入 `ADMIN_PASSWORD` 登录 → 可编辑文章/场景/单例并「保存并发布」。
- 若 `/admin` 登录失败：确认 `ADMIN_PASSWORD` 与 `SESSION_SECRET` 在 Production 环境已正确填写且重新部署生效。
- 媒体上传：后台富文本里传图 → 写进 R2 `uploads/`，前端从 R2 读取。

---

## 注意事项

- `.env.example` 只是模板，Cloudflare **必须单独填真实环境变量**（构建时读真实值，不读 `.env.example`）。
- 公开站点（文章列表/详情）上线**不依赖** 任何 secret；只有 `/admin` 后台与 `/api/*` 写接口需要口令/令牌。可先部署看站点，后台后补也行。
- `public/robots.txt` 已屏蔽 `/admin` 被搜索引擎收录；`public/_headers` 已对 `/admin`、`/api` 设 `noindex`/`no-store`。
- 构建期内容来源优先级：D1（生产真源）→ 已提交快照 `src/generated/content.json` → 遗留 YAML。无 `CLOUDFLARE_API_TOKEN` 时自动回退快照，构建永不中断。
- 改了环境变量后需 **Redeploy** 让 Functions 加载新值（Production 和 Preview 都要）。
