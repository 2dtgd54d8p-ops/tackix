// Keystatic 后台 middleware：给 /keystatic 后台页面注入多选框横排样式。
// 由 keystatic-ui-enhance.mjs 通过 addMiddleware({ order, entrypoint }) 挂载。
//
// 为什么需要它：/keystatic 后台页由 @keystatic/astro 自行渲染（client:only react），
// 不走 Astro 默认的 head/script 注入流程 —— 实测 injectScript 的脚本不会出现在该页
// HTML 中。故只能在 HTML 层面改写。
//
// 只处理 /keystatic 开头的页面；/api/keystatic 是数据接口，绝不能碰。

const STYLE_ID = 'keystatic-multiselect-columns';
const LAYOUT_STYLE_ID = 'keystatic-layout-enhance';
const MIN_OPTIONS = 6;
// Keystatic 0.6.9 fields.multiselect（标签 / 认证 等）选项列表容器类。无头浏览器实测：
//   .kui-w6jnm    → 整张表单栅格（display:grid; 12 列 62px），【不是】多选框，切勿选中
//   .kui-1g8wrcq  → 真正的选项列表容器；其【直接子元素依次是】：
//                     ① 字段名 <span class="kui:Text">认证</span>
//                     ②… 选项 <label class="kui-3dl0ie">（内部：绝对定位原生 checkbox
//                          + 自定义勾选框 <span> + 文字 <div>，label 本身为 inline-flex/gap:8px）
//   .kui-3dl0ie   → 单个选项 wrapper
// emotion 类名随版本稳定（已锁定 0.6.9 + patch），但为防漂移另有结构兜底。
const OPTION_LIST_CLASS = 'kui-1g8wrcq';

const STYLE_TAG = `
<style id="${STYLE_ID}">
/* Keystatic 0.6.9 多选框（multiselect）横排。
   ✅ 正确做法：容器 flex + wrap；选项（label）保留 inline-flex，使「勾选框 + 文字」同行；
      字段名（容器内首个 span）独占整行。
   ⛔ 早期版本把选项强制 display:inline-block —— 会让选项内部 flex 失效，勾选框与文字
      被拆成上下两行（表现为「复选框在上、文字在下」的错乱）。此处为根因修正。

   ⚠️ 权重：Keystatic UI 由 emotion 运行时注入原子类(.kui-*)，与本规则同权重且注入更靠后
      → 会覆盖本规则。故用 !important / 重复类名压过它。 */
.${OPTION_LIST_CLASS}.${OPTION_LIST_CLASS},
.kui\\:reset.${OPTION_LIST_CLASS}.kui\\:reset.${OPTION_LIST_CLASS},
.keystatic-ms-grid.keystatic-ms-grid {
  display: flex !important;
  flex-direction: row !important;   /* ⚠️ 必须：emotion 原类是 flex-direction:column（默认竖排），不覆盖会一路竖着堆 */
  flex-wrap: wrap !important;
  align-items: flex-start !important;
  column-gap: 22px !important;
  row-gap: 6px !important;
  padding: 2px 0 !important;
}
/* 字段名（容器内首个 span，如「认证」「标签」）：独占整行 */
.${OPTION_LIST_CLASS} > span,
.keystatic-ms-grid > span {
  flex: 0 0 100% !important;
  display: block !important;
  margin-bottom: 4px !important;
}
/* 选项（label）：勾选框与文字同行、垂直居中 */
.${OPTION_LIST_CLASS} > label,
.keystatic-ms-grid > label {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 3px 0 !important;
}
</style>`.trim();

// ===== 后台布局增强：列表 / 表单 / 详情 =====
// 目标（来自无头浏览器实测）：
//  - 列表页标题仅 16px/600，偏弱；列表行 0 内边距、无分隔线、无 hover
//  - 表单输入框 border:0 + 透明背景，几乎不可见
//  - 表单区块标题 6 个并列 21px/700，层级偏平
//  - 表单内容列左对齐(max-width 940)，宽屏右侧大片留白
//  - 主操作按钮(创建/保存)过小，淹没在多个图标按钮中
//  - 侧边栏 12 个链接无 hover/当前页反馈
// emotion 原子类(.kui-*)与本规则同权重且注入更靠后 → 关键规则加 !important。
const LAYOUT_STYLE_TAG = `
<style id="${LAYOUT_STYLE_ID}">
/* 1) 列表页标题：放大强化层级（原 16px/600） */
main h1.kui\\:Heading, main h1 {
  font-size: 24px !important;
  font-weight: 700 !important;
  letter-spacing: -0.01em;
  color: #1f2937 !important;
}

/* 2) 列表 TableView：列头 .kui-te3oxz */
.kui-te3oxz.kui-te3oxz,
.kui\\:reset.kui-te3oxz.kui\\:reset.kui-te3oxz {
  display: flex !important;
  align-items: center;
  padding: 10px 16px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.04em !important;
  color: #6b7280 !important;
  background: #f8fafc !important;
  border-bottom: 2px solid #e5e7eb !important;
}

/* 3) 列表行：内边距 / 分隔线 / hover（TableView-body 直接子元素即数据行） */
.kui\\:TableView-body.kui-di96ld > * {
  cursor: pointer;
  padding: 12px 16px !important;
  border-bottom: 1px solid #f0f1f4 !important;
  transition: background-color .12s ease;
}
.kui\\:TableView-body.kui-di96ld > *:hover {
  background: #f5f8ff !important;
}
.kui\\:TableView-body.kui-di96ld > * > * {
  font-weight: 500 !important;
  color: #111827 !important;
}

/* 4) 表单输入框：可见边框 + 圆角 + 聚焦环（原 border:0 / 透明背景，几乎不可见） */
main input:not([type="file"]):not([type="checkbox"]):not([type="radio"]),
main textarea,
main select {
  border: 1px solid #d6dae1 !important;
  border-radius: 8px !important;
  background: #ffffff !important;
  padding: 8px 12px !important;
  font-size: 14px !important;
  color: #1f2937 !important;
  transition: border-color .12s ease, box-shadow .12s ease;
}
main input:not([type="file"]):not([type="checkbox"]):not([type="radio"]):focus-visible,
main textarea:focus-visible,
main select:focus-visible {
  border-color: #3e63dd !important;
  box-shadow: 0 0 0 3px rgba(62,99,221,.15) !important;
  outline: none !important;
}

/* 5) 表单区块标题（h2）：降噪 + 分隔线，建立层级节奏（原 6 个并列 21px/700） */
main h2 {
  font-size: 18px !important;
  font-weight: 600 !important;
  color: #111827 !important;
  margin: 28px 0 12px !important;
  padding-bottom: 8px !important;
  border-bottom: 1px solid #eef0f4 !important;
}
main h2:first-of-type { margin-top: 4px !important; }

/* 6) 表单内容列居中，宽屏更平衡（原左对齐，右侧大片留白） */
.kui-1kq27bo.kui-1kq27bo { margin-inline: auto !important; }

/* 7) 主操作按钮（创建/保存）：更突出、统一圆角 */
.kui\\:Button.kui\\:Button {
  border-radius: 8px !important;
  font-weight: 600 !important;
  padding: 0 16px !important;
  box-shadow: 0 1px 2px rgba(16,24,40,.12) !important;
  transition: filter .12s ease, box-shadow .12s ease;
}
.kui\\:Button.kui\\:Button:hover {
  filter: brightness(.97);
  box-shadow: 0 2px 6px rgba(16,24,40,.18) !important;
}
.kui\\:ActionButton.kui\\:ActionButton:hover {
  background: rgba(16,24,40,.06) !important;
}

/* 8) 侧边栏导航：hover / 当前页反馈 */
.kui-1i5ysz.kui-1i5ysz {
  border-radius: 8px !important;
  transition: background-color .12s ease;
}
.kui-1i5ysz.kui-1i5ysz:hover { background: rgba(16,24,40,.05) !important; }
a[aria-current="page"].kui-1i5ysz,
.kui-1i5ysz.kui-1i5ysz[aria-current="page"] {
  background: rgba(62,99,221,.10) !important;
  color: #3e63dd !important;
  font-weight: 600 !important;
}

/* 9) 同排字段「输入框」对齐（站点信息 / object 字段等 2 列布局）。
   根因：2 列栅格中，右侧字段若带 description（如「商务邮箱」），会把控件往下推，
        导致与无描述的同行字段（如「首页标语」）输入框顶部错位。
   做法：整张表单栅格默认 align-items:stretch → 同行单元格等高；让字段 wrapper
        (.kui-1ob0gxm) 撑满单元格，再把控件 wrapper(.kui-doh7d8) 用 margin-top:auto
        沉底 → 同行输入框底部对齐（控件等高，故顶部也对齐）。
   窄屏单列时单元格=内容高度、无自由空间，height:100% 与 margin-top:auto 均不生效，无副作用。 */
.kui-1netbjh.kui-1netbjh { align-self: stretch !important; }
.kui-1ob0gxm.kui-1ob0gxm { height: 100% !important; }
/* ⚠️ kui-doh7d8 原 emotion 样式带 flex-grow:1，会把控件撑满整个 wrapper，
   导致没有自由空间可供 margin-top:auto 分配 → 输入框无法下沉对齐。
   故先 flex:0 0 auto 关掉撑满，再 margin-top:auto 把控件沉到同行底部。 */
.kui-doh7d8.kui-doh7d8 {
  flex: 0 0 auto !important;
  margin-top: auto !important;
}
</style>`.trim();

const FALLBACK_SCRIPT = `
<script id="keystatic-ms-fallback">
(function () {
  if (window.__keystaticMsInit) return;
  window.__keystaticMsInit = true;
  var MIN = ${MIN_OPTIONS};
  function mark() {
    // 判据：容器「直接子元素」中含 checkbox 的 <label> 数量 ≥ MIN → 多选/复选组。
    // 这样能跳过容器里混入的字段名 <span>（非 label），也不会误伤整张表单栅格
    // （其直接子元素是 div 字段组，不含 label）。
    document.querySelectorAll('div, ul, fieldset').forEach(function (el) {
      if (el.classList.contains('keystatic-ms-grid')) return;
      var kids = Array.prototype.slice.call(el.children);
      var optCount = 0;
      for (var i = 0; i < kids.length; i++) {
        var k = kids[i];
        if (k.tagName === 'LABEL' && k.querySelector && k.querySelector('input[type=checkbox]')) optCount++;
      }
      if (optCount >= MIN) el.classList.add('keystatic-ms-grid');
    });
  }
  mark();
  // ⚠️ /keystatic 后台页解析期可能尚无 <body>，此时 document.body 为 null →
  //    observe(null) 会抛 TypeError。回退到 documentElement（始终存在），并加 null 守卫。
  var _moTarget = document.body || document.documentElement;
  if (_moTarget) new MutationObserver(mark).observe(_moTarget, { childList: true, subtree: true });
})();
</script>`.trim();

export async function onRequest(context, next) {
  const path = context.url.pathname;
  // 只处理后台页面；/api/keystatic 是数据接口，绝不能碰
  if (!path.startsWith('/keystatic')) return next();

  const response = await next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const html = await response.text();
  if (html.includes(STYLE_ID) || html.includes(LAYOUT_STYLE_ID)) return response;

  const inject = STYLE_TAG + LAYOUT_STYLE_TAG + FALLBACK_SCRIPT;

  // ⚠️ /keystatic 后台页由 @keystatic/astro 渲染，**既无 <head> 也无 <body> 标签**
  //   （实测：整页以 <script>…</script><astro-island…> 开头）。
  //   故不能依赖 </head> 或 <body>，改为在首个 <script 之前注入——
  //   该页首个标签必是 bootstrap <script>，插在它前面等价于页首，样式仍会生效。
  let patched;
  if (html.includes('</head>')) {
    patched = html.replace('</head>', inject + '</head>');
  } else if (/<body[^>]*>/i.test(html)) {
    patched = html.replace(/<body[^>]*>/i, (m) => m + inject);
  } else if (html.includes('<script')) {
    patched = html.replace('<script', inject + '<script');
  } else {
    patched = inject + html;
  }

  return new Response(patched, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}