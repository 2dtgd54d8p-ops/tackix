# Tackix 后台交互评审与优化方案

> 评审对象：`src/pages/admin/` 下 6 个页面 + 相关 API
> 视角：界面交互设计（移动优先 / 反馈一致性 / 无障碍 WCAG 2.2 AA）
> 日期：2026-11-04 · 评审人：鹏城信息AI专家（ui-ux-design）
> 结论先讲：**功能链路已打通、可用；主要问题不在「能不能用」，而在「反馈不一致、导航割裂、缺保护、无障碍薄弱」四类**。下面按严重度给出，每项都落到具体文件与改动建议。

---

## 0. 页面清单与现状定性

| 页面 | 路径 | 鉴权 | 布局外壳 | 定性 |
|---|---|---|---|---|
| 登录 | `/admin/login` | 口令→会话 cookie | 独立深色卡片 | 已加固（可显示口令/长度提示），基本合格 |
| 内容仪表盘 | `/admin` | 会话 | 独立深色顶栏 | 可用，缺检索/筛选/入口 |
| 内容编辑 | `/admin/edit` | 会话 | 独立深色顶栏 | 可用，缺脏保护/字段校验/预览 |
| 版本历史 | `/admin/revisions` | 会话 | 独立深色顶栏 | 可用，缺 diff/「当前版本」标记 |
| 留言管理 | `/admin/messages` | **ADMIN_TOKEN（独立）** | **站点公共 Base 导航** | 孤岛页，双重鉴权 |
| 运营报表 | `/admin/report` | **ADMIN_TOKEN（独立）** | **站点公共 Base 导航** | 孤岛页，双重鉴权（但视觉最完整） |

两个结构性问题先点出来，它们决定了后面一切：

- **两套鉴权 + 页面孤岛**：主后台（login/index/edit/revisions）用会话 cookie；留言/报表用另一把 `ADMIN_TOKEN`，且**没有任何入口链到它们**（`index.astro` 顶栏只有「查看站点 / 发布 / 退出」）。运营要手动敲 URL 才能进，进了还是站点公共导航壳。
- **两套视觉语言**：index/edit/revisions 是「深色顶栏 + 浅色正文」；messages/report 套了站点 `Base` 布局（浅色站点导航）。同一个后台，观感像两个产品。

---

## 1. 核心问题（按严重度排序）

### A（高）· 原生 `confirm()`/`alert()` 与自定义 toast 混用 —— 反馈体系不统一
`index.astro`（删除、发布）、`revisions.astro`（回滚）、`messages.astro`（删除用 `confirm` + `alert`）都在用浏览器原生对话框；而保存/上传又用页面底部的自定义 toast。原生弹窗：① 样式与站点无关 ② 无焦点管理、不可达键盘友好 ③ 阻塞且文字与站点口径不一。

**更糟的是文案误导**：`index.astro` 删除提示写「此操作不可撤销」——但现在已经有了版本历史，删除前会留 `action=delete` 快照，**其实是可回滚的**。这句属于「易混淆操作」，必须改。

**建议**：做一个轻量共享确认层（见 §4.1），全站替换 `confirm`/`alert`；删除文案改为「删除后仍可从版本历史恢复」。

### A（高）· 编辑页无「脏数据保护」
`edit.astro` 里点「← 返回」或顶栏「查看站点」直接离开，**改了半天的内容静默丢弃**，没有任何提示。表单字段越多风险越大（`site` 单例 15 个字段）。

**建议**：维护一个 dirty 标记（任何输入变化置位），`beforeunload` + 拦截站内「返回」跳转时弹确认（见 §4.2）。

### A（高）· 「保存 ≠ 上线」在界面上不成立
保存只弹 toast「已保存」，用户很容易以为改完就生效。实际必须回仪表盘点「发布」。这是最容易产生「改了怎么没变」客服问题的点。

**建议**：保存成功后，编辑页顶部出现常驻「有未发布的更改 · [立即发布]」提示条，点发布走 `api/content/publish` 后变绿（见 §4.3）。

### B（中）· 仪表盘无检索 / 筛选 / 排序
`index.astro` 用全量 `list?kind=` 拉取后直接渲染，无搜索框、无「草稿/已发布」筛选、无排序。24 条尚可，涨到 50+ 就会难找。

**建议**：加一个顶栏过滤条（关键词 + 状态筛选），前端过滤即可，不必改接口（见 §4.4）。

### B（中）· 留言/报表是「孤岛」且与主后台割裂
- 无入口：仪表盘应加「留言」「报表」入口（共用同一会话，去掉 ADMIN_TOKEN 二次登录）。
- 布局壳不一致：应统一进主后台的深色顶栏，而非站点公共导航。

**建议**：P1 阶段把这两页纳入会话鉴权 + 深色后台壳 + 仪表盘加入口（改动集中在 middleware 的 `isOpTool` 分支与两个页面的 `Base` 替换）。

### B（中）· 版本历史对运营不友好
- 快照预览是**裸 JSON**，运营/编辑读不懂，无法判断「哪个版本是对的」。
- 没有「当前版本」高亮（只有首行小字「最新一次」）。
- 没有 diff（哪怕只对比标题/一句话摘要），回滚前只能盲选。

**建议**：① 列表首行加「当前」徽标 ② 预览改为「关键字段摘要 + 可展开 JSON」③ P2 加与当前内容的浅 diff（标题/摘要级）。

### C（低）· 无障碍与键盘（WCAG 2.2 AA 差距清单）
| 项 | 现状 | 缺口 |
|---|---|---|
| 焦点可见 | 自定义按钮无 `:focus-visible` 样式 | 键盘 Tab 焦点不可见 |
| toast | 无 `role=status` / `aria-live` | 屏幕阅读器收不到保存结果 |
| 确认弹窗 | 原生 `confirm` | 无焦点陷阱（替换后解决） |
| 对比度 | `.badge` 文字色偏浅（如 `#854d0e` on `#fef9c3` ≈ 4.5 临界） | 建议统一加深一级 |
| 表单 | 无 `<label for>` 绑定动态字段、无字段级错误 | 读屏/键盘用户定位困难 |

**建议**：见 §5 无障碍清单，逐项落地。

### C（低）· 表单体验细节
- 无「移除图片」按钮（`edit.astro` image 字段只能改 URL 或覆盖上传）。
- 无 `Cmd/Ctrl+S` 快捷保存。
- 无 Markdown 预览（长文正文是 textarea，改完看不到渲染效果）。
- 保存按钮在顶栏 sticky 可用，但缺少「保存中」禁用态（快速连点可能重复提交）。

---

## 2. 页面级走查表

| 页面 | 现有交互 | 问题 | 建议 |
|---|---|---|---|
| `/admin/login` | 口令 + 提交，可显示口令、401 报长度 | 无「记住我」概念（其实 cookie 400 天，无需）；错误仅靠文字 | 达标，暂不动 |
| `/admin` | 两列表 + 单例网格 + 发布/退出 | 删除「不可撤销」误导；无检索/筛选；无留言/报表入口 | 改文案、加过滤条、加入口、统一确认层 |
| `/admin/edit` | schema 递归表单 + 保存 + 版本历史入口 | 脏保护缺；「保存≠上线」不透明；图片无移除；无 Cmd+S；无字段级校验 | §4.2/4.3 + 图片移除 + 快捷键 + 校验反馈 |
| `/admin/revisions` | 列表 + JSON 预览 + 回滚 | 无当前版本标记、无 diff、JSON 门槛高 | 加「当前」徽标、字段摘要预览、diff(P2) |
| `/admin/messages` | ADMIN_TOKEN 门 + 留言卡片 + 删除 | 独立鉴权、站点壳、confirm/alert | 纳入会话 + 深色壳 + 统一确认层 |
| `/admin/report` | ADMIN_TOKEN 门 + KPI/图表 | 独立鉴权、站点壳、孤岛 | 纳入会话 + 深色壳 + 仪表盘入口 |

---

## 3. 设计基线（把两套视觉统一到一套 token）

主后台以现有深色顶栏（`#0f172a`）+ 浅色正文（`#f1f5f9`）为基准，收敛 messages/report 进来。建议 token（沿用现有风格，只做统一）：

| 用途 | 值 |
|---|---|
| 顶栏/深色面 | `#0f172a`，次级 `#1e293b`，描边 `#334155` |
| 正文背景 | `#f1f5f9`；卡片 `#ffffff`；描边 `#e2e8f0` |
| 主色（动作） | `#2563eb`（hover `#1d4ed8`） |
| 成功 / 危险 | `#dcfce7/#166534` · `#fee2e2/#991b1b` |
| 警示 / 未发布 | `#fef9c3/#854d0e` |
| 字号刻度 | 12/13/15/18/24（正文 13-14，标题 15-18，KPI 24+） |
| 间距 | 4/8/12/16/24（8px 倍数） |
| 圆角 | 8 / 10 / 12 / 14 |
| 动效 | `transform`/`opacity`，150-200ms；按钮 hover 1.02x、active 0.98x |

> 报告页 `report.astro` 已是一套较完整 token（`--accent/--surface/--border` 等），可视作视觉上限；其他后台页向它靠齐即可。

---

## 4. 高价值改动代码示例

### 4.1 统一确认层（替换 `confirm`/`alert`）
一个 20 行的 `<dialog>` 即可，全站复用，带焦点陷阱与 Esc 关闭：

```js
// 全局挂一个 confirmDialog(text, {danger}) => Promise<boolean>
async function confirmDialog(message, { danger = false } = {}) {
  const d = document.createElement('dialog');
  d.innerHTML = `
    <form method="dialog" class="cdlg">
      <p>${message}</p>
      <menu>
        <button value="cancel" class="cdlg-c">取消</button>
        <button value="ok" class="cdlg-ok${danger ? ' danger' : ''}">确认</button>
      </menu>
    </form>`;
  document.body.appendChild(d);
  d.showModal();
  return new Promise((resolve) => {
    d.addEventListener('close', () => {
      resolve(d.returnValue === 'ok');
      d.remove();
    }, { once: true });
  });
}
// 用法（index.astro 删除）：
if (!(await confirmDialog(`删除「${name}」？删除后仍可从版本历史恢复。`, { danger: true }))) return;
```
要点：`<dialog>.showModal()` 自带焦点陷阱与 `Esc` 取消；样式复用现有按钮 token。

### 4.2 编辑页脏数据保护（`edit.astro`）
```js
let dirty = false;
const markDirty = () => { dirty = true; };
// 所有 input/textarea/checkbox 的 oninput/onchange 里调用 markDirty()
// 保存成功后 dirty = false

window.addEventListener('beforeunload', (e) => {
  if (dirty) { e.preventDefault(); e.returnValue = ''; }
});
// 「← 返回」链接：改成按钮，点击时
backBtn.onclick = async (e) => {
  if (dirty && !(await confirmDialog('有未保存的更改，确定离开？'))) { e.preventDefault(); return; }
  location.href = '/admin';
};
```

### 4.3 「未发布更改」提示条（`edit.astro` 保存成功后）
```js
// 保存成功回调里：
toast('已保存');
showPendingBar();   // 顶部出现黄色条：「已保存，尚未发布。 [立即发布] [查看版本历史]」

async function publishNow() {
  const r = await fetch('/api/content/publish', { method: 'POST' }).then(x => x.json());
  if (r.ok) { toast(r.message); /* 提示条变绿「已发布」 */ }
}
```

### 4.4 仪表盘检索/筛选（`index.astro`，前端过滤即可）
```html
<div class="filterbar">
  <input id="q" placeholder="搜索标题 / slug" />
  <select id="state"><option value="all">全部</option><option value="pub">已发布</option><option value="draft">草稿</option></select>
</div>
```
```js
// renderList 内，拉全量后按 q/state 过滤再渲染；输入用 150ms 防抖
```

---

## 5. 无障碍检查清单（WCAG 2.2 AA）

- [ ] 所有自定义按钮补 `:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }`
- [ ] toast 元素加 `role="status" aria-live="polite"`（`index/edit/revisions` 三页）
- [ ] 确认/删除/回滚全部走 `<dialog>`，替换原生 `confirm`（§4.1）
- [ ] 表单输入补 `aria-label`/`<label for>`（动态字段用 label 包裹或 `aria-label`）
- [ ] 徽标文字对比度：`#854d0e`→`#713f12` 等深一档，正文 ≥ 4.5:1
- [ ] 错误提示不只靠颜色：失败 toast 同时给图标/前缀（如「✗ 保存失败」）
- [ ] 图片字段的预览 `<img>` 补空 `alt`（已 `alt=""`，装饰性，正确）
- [ ] 键盘：编辑表单可 Tab 顺序遍历、保存可用 `Cmd/Ctrl+S`（P2）

---

## 6. 落地顺序（不破坏现有可用性，最小化变更）

| 批次 | 内容 | 涉及文件 | 风险 |
|---|---|---|---|
| P0（半天） | ① 删除/回滚/发布统一确认层 + 改「不可撤销」文案 ② 编辑页脏保护 ③ 保存后「未发布」提示条 + 发布入口 | index/revisions/edit.astro | 低（纯前端交互） |
| P1（1-2 天） | ④ 仪表盘过滤条 ⑤ 留言/报表纳入会话鉴权 + 深色后台壳 + 仪表盘入口 ⑥ toast aria-live + 焦点可见 | index/messages/report/middleware | 中（动鉴权，需回归） |
| P2（增强） | ⑦ 版本历史字段摘要预览 + diff ⑧ 表单字段级校验 + Markdown 预览 + Cmd+S + 图片移除 | edit/revisions.astro | 中 |

> 建议先做 P0——它零风险、立即消除「误删恐慌」和「改了以为上线」两个最高频困惑；P1 里动鉴权那步（⑤）需要一次真机回归（可复用 `npm run smoke -- --cookie`）。

---

## 附：本评审未改动任何代码
本文是**评审 + 方案**，未改文件。如需我按 P0/P1/P2 落地，请说「直接干」并指明批次（如「P0」）。
