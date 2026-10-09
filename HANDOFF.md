# tackix 项目 · 待办交接文档
> 提取于 2026-10-09，汇总 2026-10-08 遗留项。
> **更新于 2026-10-09 午间**：③ 首页改造已完工并上线，仅剩 ② 邮件通知、④ 安全收尾。
> 用途：跨账号 / 跨机器续接。密钥一律不落明文，只写"在哪个变量名、怎么取"。

## 一、项目基本信息
- 仓库：`2dtgd54d8p-ops/tackix`（默认分支 `main`）
- 线上：`https://tackix.pages.dev`
- 技术栈：Astro + Cloudflare Pages + Keystatic（GitHub 存储）+ D1
- 部署：GitHub Actions 自动构建并 `wrangler pages deploy`（push main 即触发，约 1 分钟生效）
- 推代码方式：用户本机 `git push` 到 `github.com` 被代理 502 拦截，改用 GitHub REST API（PAT）推送；仓库内助手 `.push_tac.py`（已落地仓库根、**已加入 `.gitignore` 不入库**、PAT 改读环境变量 `TACKIX_PAT`，运行前需 `export TACKIX_PAT=<你的 GitHub PAT>`，**不在文件里落明文**）

## 二、已完成（一句话带过）
D1 绑定、联系表单入库、留言后台（ADMIN_TOKEN 保护）、邮件通知代码打通、安全头、KEYSTATIC_SECRET 随机化、GitHub PAT 轮换闭环（旧 `ghp_470d…` 已删，新 `ghp_aSmz…` 接管）。

## 三、遗留待办（重点）

### ① 旧 GitHub App 清理  ✅ 已完成（2026-10-09）
- **结果**：Cloudflare 的 `KEYSTATIC_GITHUB_CLIENT_ID` 已切到新 App `Iv23litB8zAFrfDlYNDT`（`tackix-cms-app`），`KEYSTATIC_GITHUB_CLIENT_SECRET` 已换新 secret；线上 OAuth 跳转 client_id 已验证为新值；新 App 已安装到仓库 `2dtgd54d8p-ops/tackix`，**文章可正常新建/保存**（读写权限实测通过）；旧 App `Iv23livuZEcbeP0HnRk8` 已不在 `/settings/apps` 列表且公开接口查无此 App，确认已清除。站点各端点正常。
- **踩过的坑（供以后参考）**：
  1. App 设置页不能深链 `/settings/apps/<slug>`，必须从 `/settings/apps` 列表点行右侧「编辑」进入。
  2. client secret 在设置页左侧独立菜单 **Credentials**（不在 General 页），且上限 5 个、满了要先删旧的才能生成新的，只显示一次。
  3. **OAuth 登录成功 ≠ App 有仓库读写权限**。切换后曾报 "The GitHub App is unable to commit to the repository…"，需另去 `/apps/tackix-cms-app/installations/new` 把 App 安装到仓库（建议 Only select repositories、Contents=Read and write）才真正可用。
  4. 删除 App 用 `/settings/apps`；`/settings/installations` 是"别人装的 App"列表（含 giscus / Cloudflare / Pages CMS 等第三方，**勿动**），两页用途不同。
  5. Cloudflare 环境变量改完必须重部署（GitHub Actions → Run workflow）才注入运行时。

### ② 邮件通知（留言提交后提醒）  ⬜ 待决策
- **现状**：代码 / Key / 变量均就绪，`/api/contact` 发信返回 `sent:true`，但**用户收不到**。根因 = Apple Hide My Email 中继对 `onboarding@resend.dev`（无自有域名信誉）静默丢弃，非配置问题。
- **三个解法（用户挑一个）**：
  1. 用 `sunboy1127@qq.com` 重新注册 Resend（注册邮箱=QQ，可直发，绕开 Apple 中继）——最省事
  2. 绑自定义域名 + Resend 验证，改 `RESEND_FROM` ——最彻底
  3. 改群机器人 Webhook（代码已就绪，只需在 Cloudflare 填 `NOTIFY_WEBHOOK_URL`）——最稳
- **谁做**：用户定方案；方案 ③ 我可直接配。
- **相关变量**：`RESEND_API_KEY`（已配）、`CONTACT_NOTIFY_TO=2dtgd54d8p@privaterelay.appleid.com`、`NOTIFY_WEBHOOK_URL`（待填）。

### ③ 首页风格改造  ✅ 已完成（2026-10-09 午间）
- **结果**：从旧纯文字列表重做为「Hero 主视觉（浅蓝满屏出血）+ 分类筛选 + 置顶大卡 + 封面卡片网格（自适应三列）」；容器加宽至 1080px；分类/标签接入后台 singleton（`site/categories.yaml`、`site/tags.yaml`）可增删改；详情页英文标识 bug 修复（分类/标签中文映射）；`/posts` 列表页现代化；站名/描述/页脚统一读后台 `site` singleton；后台 UI 全中文 + 品牌位「Tackix」新标签页回首页；页脚 `Powered by Tackix`。**已 live（https://tackix.pages.dev）**。
- **新增公共模块**：`src/lib/site-data.ts`（`loadSiteData` / `categoryLabel` / `tagLabel` / `buildFilterOptions`），四页共用。
- **卡点已消**：设计方向已定（浅蓝 Hero + 卡片网格 + 满屏出血），无需再等。
- 后续若还想微调视觉（配色 / 暗色模式 / 更多板块），仍走 `Base.astro` 全局变量 + `index.astro` 结构，无第三方框架。

### ④ 可选安全收尾  ⬜ 未排期
- `main` 分支保护（当前任意 push 即自动部署，含 secret）。
- npm 依赖漏洞审计：共 10 个（2 moderate / 7 high / 1 critical），属依赖树既有问题，非本次引入。
- （旧 GitHub App 清理已并入 ①）

## 四、关键账号 / ID 速查（不写密钥）
- GitHub 仓库所有者：`2dtgd54d8p-ops`
- Cloudflare 项目：`tackix`；D1 数据库 `tackix-db`（绑定变量名 `DB`）
- Keystatic 旧 App：`Iv23livuZEcbeP0HnRk8`（待删）/ 新 App `tackix-cms-app`：`Iv23litB8zAFrfDlYNDT`
- Cloudflare 环境变量名清单：`ADMIN_TOKEN`、`CONTACT_NOTIFY_TO`、`KEYSTATIC_GITHUB_CLIENT_ID`、`KEYSTATIC_GITHUB_CLIENT_SECRET`、`KEYSTATIC_SECRET`、`PUBLIC_GITHUB_OWNER`、`PUBLIC_GITHUB_REPO`、`PUBLIC_KEYSTATIC_GITHUB_APP_ID`、`PUBLIC_SITE_URL`、`RESEND_API_KEY`
- Resend：注册邮箱为 Apple 隐藏地址 `2dtgd54d8p@privaterelay.appleid.com`

## 五、换账号 / 换机器怎么续接（傻瓜式）
1. 保留（或拷走）整个工作区文件夹 `2026-10-03-22-46-17`（代码 + 本文件 + `.workbuddy/memory` 笔记都在）。
2. **情况 A：只是换 WorkBuddy 登录账号，GitHub / Cloudflare 仍用原来的**
   → 凭证完全不用动。新 WB 账号打开同一文件夹，让我读本文件即可从上表接着干。聊天记录不随 WB 账号迁移，本文件即桥梁。
3. **情况 B：连 GitHub / Cloudflare 也要换账号**
   → 需在对应平台把仓库 / CF Pages 项目移交或加协作者；新账号下重配全部环境变量（见第四节清单）+ 新 PAT（`.push_tac.py` 里的 `TOKEN` 也要换成新账号的）；Keystatic 的 GitHub App 若随旧账号走，需在新账号重建 App 并重填 `KEYSTATIC_GITHUB_CLIENT_ID/SECRET`。
4. 注意：本对话聊天记录不随 WorkBuddy 账号迁移，本文件即替代物；密钥一律不落明文。

## 六、本地 git 状态提示（接手时先看一眼）
- 本机 `.git` 当前与远端 `origin/main` **分叉**：本地旧 commit `717d9f4` 已失效，远端为 API 推送的 `e8c86c90` + `768575cd`（宽度修复那次）。
- 若 `github.com` 网络恢复，先对齐再动手：`git fetch origin && git reset --hard origin/main`。
- 本环境 `git push` 到 `github.com` 常被代理 502 挡死；改代码后用仓库内 `.push_tac.py`（走 `api.github.com`，PAT 读环境变量 `TACKIX_PAT`）推送，触发 CF 重建。注意它串行推多个文件，并行会 409（第二个抓到旧 base sha），失败就重试该文件。`.push_tac.py` 已加入 `.gitignore` 不入库，密钥不落明文。
