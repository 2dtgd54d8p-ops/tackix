# 安全态势与依赖漏洞处置（2026-11-04）

> 本文记录 `npm audit` 报出的依赖漏洞、**逐条判断能不能修**、以及为什么某些"critical"暂时不动。
> 目的：避免下次看到红字就盲目 `npm audit fix --force`，把部署链路炸掉。

## 一句话结论

真正会进生产运行的只有 **Astro 的 SSR 代码**（打进 `dist/_worker.js`）；其余报红的基本都是
**构建期工具**（wrangler / miniflare / esbuild / sharp），只在本机与 CI 跑，不随产物发布。
因此优先级不是看"严重度标签"，而是看**是否随产物发布 + 是否被用户输入触达**。

## 一、当前状态

| 指标 | 值 |
|---|---|
| Astro | 5.18.2（5.x 已是最新，官方未回补安全补丁） |
| @astrojs/cloudflare | 12.6.13（peer: `astro ^5.7.0`） |
| `npm audit --omit=dev` | 修复前 11 项 → 修复后 9 项 |

## 二、已修复

| 包 | 变更 | 说明 |
|---|---|---|
| `vite` | 6.4.3 → 6.4.5 | 补丁级，`npm audit fix` 自动完成 |
| `undici` | 8.11.2 → 8.12.3 | 补丁级，修复解压缩链资源耗尽 / WebSocket 长度溢出 |
| `define:vars` XSS 向量 | 移除 | 见下节，直接消除了 critical 公告里**唯一命中本项目的攻击面** |

改完 `npm run build` 通过（50 页），产物核对无回归。

## 三、`define:vars` 缓解（对应 GHSA-j687-52p2-xcff）

全站只有一处使用 `define:vars`：`src/components/pages/KnowledgeDetail.astro`，原本把内容 slug
内联进内联脚本。该公告正是"内联序列化不完整导致 XSS"，一旦 slug 里出现 script 闭合序列即可注入。

**已改为** `<span id="view-slug" data-slug={slug} hidden>` + 脚本 `getAttribute('data-slug')` 读取。
属性值由 Astro 正常转义，不再进入 JS 源码，向量消除。功能（阅读历史记录）保持不变。

## 四、逐条评估：Astro advisory 在本项目的适用性

| 公告 | 本项目是否受影响 | 依据 |
|---|---|---|
| XSS in `define:vars` | **曾受影响，已消除** | 见上节 |
| XSS via unescaped spread attribute names | 否 | 无"属性名来自用户输入"的 spread |
| XSS via `transition:*` on hydrated islands | 否 | 全站未使用 view transitions |
| Reflected XSS via View Transition animation props | 否 | 同上 |
| Reflected XSS via unescaped slot name | 否 | 无动态 `<slot name={...}>` |
| Server island encrypted params replay | 否 | 未使用 server islands（`server:defer`） |
| Host header SSRF in prerendered error page fetch | 否 | 404 为预渲染静态页 |
| RCE via AVIF image optimization | 否 | 未启用远程图片优化 / AVIF 转换 |
| Authorization bypass via base path stripping | 否 | `astro.config.mjs` 未设置 `base` |

结论：其余 8 条均不适用于本站当前用法。**风险敞口实际集中在已消除的那一条上。**

## 五、不修的 9 项：为什么

剩余报红全部挂在下面这条依赖链上：

```
@astrojs/cloudflare@12  (peer: astro ^5.7.0)
  └─ wrangler@3 (内嵌) ─ miniflare ─ { undici, ws, @fastify/busboy, esbuild }
astro@5 ─ { sharp, zod, zod-to-ts }
```

`npm audit fix` 给出的唯一解是 **astro@7.4.1 + @astrojs/cloudflare@14**。这条路意味着：

1. `@astrojs/cloudflare` v13+ 已转向 **Workers**，不再是 Pages 模式 → 部署目标要从 Pages 项目
   换成 Workers，`wrangler pages deploy`、Pages 环境变量、D1/KV 绑定方式全部要重做；
2. Astro 5 → 7 跨两个大版本，`content-reader`、i18n 路由、集成 API 都需回归；
3. 与本项目"锁 v12 保 Pages"的既有约束直接冲突。

**结论：这是独立的架构迁移项目，不属于安全收尾范围。** 已确认的替代缓解：
- 上述 8 条 advisory 不适用
- 构建期依赖只在 CI/本机运行，不随 `dist/` 发布，攻击者无法从线上触达
- 唯一的运行时代码（SSR API）均需登录鉴权

## 六、什么时候必须重做这条链

出现以下任一情况时，应启动 Astro 7 + Workers 迁移：
- 需要在 SSR 里开始渲染**用户可控内容**（评论区、用户上传页等）
- 需要启用远程图片优化 / AVIF 转换
- 官方对 5.x 停止一切支持，且出现**适用于本站用法**的新 advisory

## 七、日常检查

```bash
npm audit --omit=dev          # 只看生产依赖
npm audit fix                 # 只接受 semver 内的补丁/次版本修复
npm run build                 # 改完必须构建通过再提交
```

禁止直接用 `npm audit fix --force`——它会静默把 astro 拽到 7.x 并破坏 Pages 部署。
