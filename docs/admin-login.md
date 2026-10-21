# 免代理后台登录（A-根治方案）

## 背景与问题

本站在 Cloudflare Pages 上用 Keystatic（GitHub 模式）做内容后台，挂载于 `/keystatic`。

Keystatic 默认登录方式是 **GitHub OAuth**：点击「Log in with GitHub」后浏览器要跳
`github.com` 完成授权，再带着 OAuth token 回来。但在公司代理环境下，`github.com`
被封锁（git 的 CONNECT 隧道返回 502，浏览器直连亦不通），导致**无法登录后台**。

## 方案概述

用「**口令 → 服务端 PAT cookie**」替代 OAuth，浏览器全程不接触 `github.com`：

1. 访客打开 `/admin-login`，输入管理口令。
2. 浏览器 `POST /api/admin-login`（口令做长度安全比较）。
3. 服务端校验通过后，把**服务端持有的 GitHub PAT** 原样写进浏览器 cookie
   `keystatic-gh-access-token`（Path=/，SameSite=Lax，Max-Age=400 天，非 httpOnly）。
4. 前端整页跳 `/keystatic`；此时 cookie 已存在，Keystatic 后台 JS 直接读它作为 Bearer
   调 `/api/keystatic/*`，worker 再以服务端身份拿该 PAT 访问 `api.github.com`。
5. 登出走 `/api/keystatic/github/logout`（已改为清 cookie 后回 `/admin-login`）。

> PAT 与 OAuth access_token 都只是 Bearer 令牌，因此把 PAT 写进 Keystatic 约定的
> cookie 即可零 OAuth、零 github.com 接触地登录，编辑器/存储/构建完全不动。

## 所需环境变量（Cloudflare Pages → Settings → Environment variables）

均为 **secret**，不要写进仓库或前端：

| 变量 | 作用 | 备注 |
| --- | --- | --- |
| `KEYSTATIC_ADMIN_PASSWORD` | 后台登录口令 | 建议 ≥16 位、含大小写+数字；与 `/api/admin-login` 做长度安全比较 |
| `KEYSTATIC_PAT` | 服务端持有的 GitHub PAT | 需对仓库有 Contents **读+写回**权限（编辑后台要回写内容）；建议与 `KEYSTATIC_GITHUB_TOKEN` 用独立 PAT 便于单独轮换 |
| `KEYSTATIC_GITHUB_TOKEN` | 构建期/运行时读取 GitHub 内容 | 仍需要（只读 Contents 即可） |
| `KEYSTATIC_SECRET` | Keystatic 会话加密随机串 | ≥32 字符 |
| `KEYSTATIC_GITHUB_CLIENT_ID/SECRET` | GitHub App OAuth（备用） | 口令体系下不使用，但集成要求填写 |

## 边缘加固（防绕过）

`src/middleware.ts` 看守 `/keystatic` 与 `/keystatic/*`：请求若无
`keystatic-gh-access-token` cookie，**一律 302 到 `/admin-login`**。这样即使有人手输
或书签 `/keystatic`，也不会落到 Keystatic 原生 OAuth 死胡同。已登录用户带 cookie 则正常
放行；`/api/keystatic/*` 与登出端点不受影响。

入口接线：页脚「后台管理 / Admin」链接指向 `/admin-login`（非 `/keystatic`），见
`src/layouts/Base.astro`。

## 日常操作

- **登录**：点页脚「后台管理」→ 输口令 → 进入。
- **会话失效 / cookie 过期**（400 天后）：直接重访 `/admin-login` 重新登录即可，无需运维介入。
- **登出**：后台内登出 → 清 cookie → 回 `/admin-login`。

## 轮换流程

1. 在 GitHub 作废旧 PAT，新建具备仓库读写权限的 Fine-grained PAT。
2. 在 Cloudflare Pages 控制台把 `KEYSTATIC_PAT`（及可选的 `KEYSTATIC_GITHUB_TOKEN`）
   更新为新值 → 触发一次重新部署（变量变更需重新构建生效）。
3. 通知在岗编辑：下次登录后旧的 400 天 cookie 失效，重新访问 `/admin-login` 登录即可。

## 安全口径与待办

- 口令比对走长度安全比较（弱防护），主要依赖**强口令 + 不公开**。如需防暴力，后续可加
  Cloudflare 速率限制 / Turnstile。
- `keystatic-gh-access-token` 为**非 httpOnly**（Keystatic 要求 JS 可读），故 PAT 暴露于
  XSS 面。当前内测期可接受；**上线（GA）前建议**：收紧 Content-Security-Policy、评估改回
  OAuth，或迁移到 httpOnly cookie + worker 内部换取短期令牌的方案。
- 所有密钥均为 Cloudflare secret_text，不进仓库、不回显前端。
