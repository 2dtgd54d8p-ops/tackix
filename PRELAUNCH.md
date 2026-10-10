# 预上线 / 正式上线 切换指南

站点目前处于**预上线**状态：可访问、可演示，但**不被搜索引擎与 AI 检索体收录**，询盘通道关闭。
本文档说明如何一键切换，以及上线前该补齐什么。

---

## 一、当前状态怎么组成的

闸门共四层，**缺一层就可能漏收录**：

| 层 | 文件 | 控制什么 | 受什么控制 |
|---|---|---|---|
| meta robots | `src/lib/prelaunch.ts` | 页面 `<meta robots>` | `PUBLIC_PRELAUNCH` 环境变量 |
| robots.txt | `public/robots.txt` | 爬虫是否抓取 | 提交进仓库的文件内容 |
| 响应头 | `public/_headers` | `X-Robots-Tag` | 提交进仓库的文件内容 |
| 询盘接口 | `src/pages/api/contact.ts` | 是否写库/发信 | `CONTACT_OPEN` 环境变量 |

> ⚠️ **关键**：robots.txt 与 _headers 是**静态文件，不受环境变量控制**。
> 只设环境变量而不改这两个文件，Google 会因 `Disallow: /` 根本抓不到页面，
> 也就读不到页面里的 `index, follow` —— 结果仍然不会被收录。
> 这也是下面要用脚本的原因。

---

## 二、正式上线（两步）

### 第1 步：切静态文件

```bash
node scripts/launch.js
```

它会做两件事：
- `public/robots.txt` → 改为 `Allow: /` + 恢复 GPTBot/PerplexityBot/Google-Extended 放行 + 提交 Sitemap
- `public/_headers` → 注释掉全站 `X-Robots-Tag`（`/keystatic`、`/admin`、`/api` 的 noindex **保留**）

### 第 2 步：设环境变量

Cloudflare Pages → **Settings → Environment variables**

| 变量 | 值 |
|---|---|
| `PUBLIC_PRELAUNCH` | `0` |
| `CONTACT_OPEN` | `1` |

保存后 GitHub Actions 自动重新构建部署（约 1–2 分钟）。

---

## 三、切回预上线（反悔）

```bash
node scripts/launch.js --revert
```

并把环境变量改回：

| 变量 | 值 |
|---|---|
| `PUBLIC_PRELAUNCH` | 设为 `1`，或直接删除该变量 |
| `CONTACT_OPEN` | 设为 `0`，或删除 |

脚本是**幂等**的，可反复执行；处于目标状态时会提示「跳过」。
即便有人手工把 `X-Robots-Tag` 那行注释成了 `#   X-Robots-Tag`（多个空格），
`--revert` 也能正确识别并恢复。

---

## 四、验证是否切换成功

```bash
# 看 robots.txt 与 _headers 的当前状态
/Users/elowa/.workbuddy/binaries/python/versions/3.13.12/bin/python3 scripts/check-headers.py
```

期望输出：
- 预上线：`ON (生效中)` + robots.txt 首行为 `Disallow: /`
- 正式上线：`OFF (已注释)` + robots.txt 首行为 `Allow: /`

线上验证（部署完成后）：

```bash
curl -s https://tackix.pages.dev/ | grep -o '<meta name="robots"[^>]*>'
curl -sI https://tackix.pages.dev/ | grep -i x-robots-tag
curl -s https://tackix.pages.dev/robots.txt | grep -v '^#' | grep -v '^$'
```

---

## 五、上线前建议补齐的内容

技术就绪了，但**商业就绪还差这些**。过早开放收录会让买家看到「半成品」站点，
反而降低信任、影响后续排名：

| 优先级 | 项目 | 现状 |
|---|---|---|
| P0 | 产品图 | `public/uploads/` 为空，10 款产品全是纯文字卡 |
| P0 | TDS / SDS PDF | 技术采购的决策依据，缺了这个询盘转化会很低 |
| P0 | WhatsApp 号码 | 后台「站点信息」配置后，悬浮按钮才会出现 |
| P1 | 越泰语内容 | 东南亚主力买家语言（目前仅 zh-CN / en） |
| P1 | Search Console | 提交 sitemap，让 hreflang 真正生效 |
| P2 | 邮件通知确认 | Resend 已通，需确认收到真实询盘邮件 |

---

## 六、常见问题

**Q：预上线期间提交询盘表单会怎样？**
返回「本站尚未正式发布」，**不写数据库、不发邮件**。避免演示数据污染真实线索。

**Q：现在站点还能访问吗？**
能。顶部有「预览版 · 尚未正式发布」提示条，方便给客户演示。

**Q：预上线期间会被 Google 收录吗？**
不会。四层防护 + robots.txt 层拦截，爬虫拿不到页面。

**Q：上线后需要等多久见效？**
Google 重新抓取通常几天到几周。提交 Search Console 后可用 URL 检查工具催收。