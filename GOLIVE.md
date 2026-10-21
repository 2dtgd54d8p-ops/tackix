# 正式上线检查清单（Go-Live Checklist）

> 适用对象：Tackix 静态站（Astro + Cloudflare Pages）。当前处于「预上线」状态：
> 站点可访问、但 `robots.txt` 全站 `Disallow` + `_headers` 全站 `X-Robots-Tag: noindex`，
> 且 `/api/contact` 询盘闸门关闭（返回 `{prelaunch:true}`）。本清单用于**安全、可逆**地切换到正式上线。
>
> 核心工具：`scripts/launch.js`（一键翻转预上线↔正式，同时切换三处：robots.txt / _headers / API 闸门）。
> 反悔：`node scripts/launch.js --revert` 即可退回预上线。详见 `PRELAUNCH.md`。

---

## 一、上线前内容准备（不依赖部署）

| # | 事项 | 操作位置 | 状态 | 备注 |
|---|------|----------|------|------|
| 1 | 回填商务联系方式 | `/admin` 后台 →「站点信息」 | [ ] | email / company / phone / address / hours / whatsapp / whatsappPrefill 全部填真实值；留空字段前台会自动隐藏 |
| 2 | 替换 TDS/SDS 占位 PDF | `public/uploads/tackix-tds-<slug>.pdf` / `tackix-sds-<slug>.pdf` | [ ] | 当前为英文占位模板（标注 DRAFT/PLACEHOLDER）；用真实文档**同名覆盖**即可，无需改 YAML |
| 3 | 复核产品参数与文案 | `src/content/products/*.yaml` | [ ] | 型号、基材、耐温、认证、描述（中英文）准确无误 |
| 4 | 复核文章/案例内容 | `src/content/posts/*`、`src/content/cases/*` | [ ] | FAQ Schema 完整、内链锚文本为描述性（禁「点击这里」） |
| 5 | 确认多语言入口 | 页脚语言切换、hreflang 互指 | [ ] | 中英文产品/文章/案例页 `alternates` 正确 |
| 6 | 复核新增「内容单例」 | `/admin` 后台 → `home`/`ui`/`contact`/`pages`/`detail` 5 个 singleton | [ ] | 首页 Hero/How-we-help、导航/页脚/搜索占位符、列表页标题、详情页区块标题、联系页标题等**后台可编辑**；上线前逐条核对中英文文案（留空则回退代码默认值） |

## 二、一键切换预上线 → 正式

| # | 事项 | 命令 / 位置 | 状态 | 备注 |
|---|------|-------------|------|------|
| 6 | 执行切换脚本 | `node scripts/launch.js` | [ ] | 同时翻转 `robots.txt`（Disallow→放行+Sitemap）、`_headers`（取消全站 noindex）、`/api/contact` 闸门 |
| 7 | 保留后台/接口 noindex | 检查 `_headers` | [ ] | `/admin`、`/api` 仍需 `noindex`，不能被一并放开 |
| 8 | 提交并推送切换结果 | `git add -A && git commit && git push` | [ ] | launch.js 改的是静态文件，必须随部署生效 |
| 9 | 等待 CI 部署完成 | Cloudflare Pages 部署日志 | [ ] | 推送后约 1–2 分钟部署完成 |

## 三、上线后核验（抓取与收录）

| # | 事项 | 方法 | 状态 | 备注 |
|---|------|------|------|------|
| 10 | robots.txt 已放行 | 访问 `https://<站点>/robots.txt` | [ ] | 应为 `Allow: /` + `Sitemap: ...`；不再有全站 `Disallow` |
| 11 | 全站无 noindex | `curl -I https://<站点>/` 看 `x-robots-tag` | [ ] | 仅 `/admin`、`/api` 保留 noindex |
| 12 | Sitemap 提交 | Search Console / Bing Webmaster | [ ] | 提交 `sitemap.xml`；确认 GPTBot/PerplexityBot/Google-Extended 被放行（见 `robots.txt`） |
| 13 | AI 可读文档 | 抽查 `llms.txt` 与各页 `.md` 直出 | [ ] | 根目录 `llms.txt` 覆盖 10–15 个核心页；每页独立 title/description |
| 14 | 结构化数据 | 富结果测试工具 | [ ] | 抽查 Product / Article / FAQPage JSON-LD 无误 |

## 四、全站回归测试（中英文）

| # | 事项 | 方法 | 状态 | 备注 |
|---|------|------|------|------|
| 15 | 54 页可访问、无死链 | `python3 scripts/audit-links.py`（构建后查 `dist/`） | [ ] | 中英文产品/文章/案例/选型/搜索/404 均正常 |
| 16 | 产品页 TDS/SDS 可下载 | 打开任一产品页点「技术文档 / Technical Documents」 | [ ] | 链接指向 `/uploads/tackix-*.pdf`，PDF 可打开 |
| 17 | 联系页表单（正式期）提交成功 | 填表提交，应收到成功提示且后端收到询盘 | [ ] | 正式期 `/api/contact` 不再返回 `{prelaunch:true}` |
| 18 | 选型工具 / 搜索 / 404 | 逐项点测 | [ ] | 选型工具按 基材+环境+位移 推荐；搜索可用；自定义 404 友好 |

## 五、上线后监控

| # | 事项 | 方法 | 状态 | 备注 |
|---|------|------|------|------|
| 19 | 部署与可用性 | Cloudflare Pages / 站点 uptime | [ ] | 关注部署状态与 5xx |
| 20 | 询盘与流量 | 联系页表单、WhatsApp、邮件 | [ ] | 上线首周重点盯询盘转化与 404 来源 |
| 21 | 收录进度 | Search Console 覆盖率 | [ ] | 观察页面被收录与排名变化，必要时调 `llms.txt` |

---

### 回滚预案
若上线后发现严重问题：`node scripts/launch.js --revert` 立即退回预上线（停止收录 + 关闭询盘），
再修代码、重新推送部署。切换脚本本身只改静态文件，回滚安全、秒级生效。
