/**
 * 多语言 i18n 脚手架（T10）
 * ---------------------------------------------------------------
 * 目标：先「本地化站点外壳」（顶栏导航、搜索框、外观面板、页脚、悬浮按钮等
 *       UI 文案），为后续真实多语言内容页（/en、/vi、/th 路由）打好基础。
 *
 * 设计要点：
 * 1. 默认语言 zh-CN，当前静态站尚未生成 /en /vi /th 内容路由，因此语言
 *    切换器采用「客户端外壳替换」策略：把偏好存进 localStorage，刷新时
 *    用字典替换 [data-i18n] 元素的文案，并改写 <html lang>。
 * 2. 内容页（文章/产品/案例正文）的多语言版本待补；届时再走 Astro i18n
 *    路由（astro.config 已声明 locales，prefixDefaultLocale:false），
 *    由页面级 getStaticPaths 产出对应语种 slug 并接入 SEO alternates。
 * 3. UI_STRINGS 以 zh-CN 为基准键（DOM 中直接渲染中文），仅导出非默认语言
 *    字典给客户端做替换，减少内嵌体积。
 */

export interface LocaleDef {
  /** 内部 locale 键，与 astro.config i18n.locales 对齐 */
  code: string;
  /** 展示名（原生语言自名，如 中文 / English / Tiếng Việt / ไทย） */
  label: string;
  /** 写入 <html lang> 的值（zh-CN 用完整 BCP-47，其余用短码） */
  htmlLang: string;
}

export const LOCALES: LocaleDef[] = [
  { code: 'zh-CN', label: '中文', htmlLang: 'zh-CN' },
  { code: 'en', label: 'English', htmlLang: 'en' },
  { code: 'vi', label: 'Tiếng Việt', htmlLang: 'vi' },
  { code: 'th', label: 'ไทย', htmlLang: 'th' },
];

export const DEFAULT_LOCALE = 'zh-CN';

/** 仅非默认（zh-CN）语言的 UI 字典，供客户端 [data-i18n] 替换 */
export const UI_STRINGS_NONDEFAULT: Record<string, Record<string, string>> = {
  en: {
    'nav.home': 'Home',
    'nav.products': 'Products',
    'nav.selector': 'Selector',
    'nav.cases': 'Cases',
    'nav.posts': 'Articles',
    'nav.contact': 'Contact',
    'search.placeholder': 'Search…',
    'appearance.title': 'Appearance',
    'appearance.mode': 'Theme',
    'appearance.auto': 'Auto',
    'appearance.light': 'Light',
    'appearance.dark': 'Dark',
    'appearance.accent': 'Accent',
    'footer.admin': 'Admin',
    'float.contact': 'Contact us',
  },
  vi: {
    'nav.home': 'Trang chủ',
    'nav.products': 'Sản phẩm',
    'nav.selector': 'Bộ chọn',
    'nav.cases': 'Dự án',
    'nav.posts': 'Bài viết',
    'nav.contact': 'Liên hệ',
    'search.placeholder': 'Tìm kiếm…',
    'appearance.title': 'Giao diện',
    'appearance.mode': 'Sáng / Tối',
    'appearance.auto': 'Tự động',
    'appearance.light': 'Sáng',
    'appearance.dark': 'Tối',
    'appearance.accent': 'Màu nhấn',
    'footer.admin': 'Quản trị',
    'float.contact': 'Liên hệ',
  },
  th: {
    'nav.home': 'หน้าแรก',
    'nav.products': 'ผลิตภัณฑ์',
    'nav.selector': 'เลือกผลิตภัณฑ์',
    'nav.cases': 'กรณีศึกษา',
    'nav.posts': 'บทความ',
    'nav.contact': 'ติดต่อ',
    'search.placeholder': 'ค้นหา…',
    'appearance.title': 'รูปแบบ',
    'appearance.mode': 'ธีม',
    'appearance.auto': 'อัตโนมัติ',
    'appearance.light': 'สว่าง',
    'appearance.dark': 'มืด',
    'appearance.accent': 'สีเน้น',
    'footer.admin': 'ผู้ดูแล',
    'float.contact': 'ติดต่อเรา',
  },
};

/** 服务端取 UI 文案（当前静态站只渲染 zh-CN；供未来页面级调用） */
export function t(code: string, key: string): string {
  if (code === DEFAULT_LOCALE) return key; // zh-CN 基准即 key 本身
  return UI_STRINGS_NONDEFAULT[code]?.[key] ?? key;
}

/**
 * 从路径解析 locale（为未来 /en /vi /th 内容路由预留）。
 * 静态站当前所有页面都在默认 locale 下，返回 DEFAULT_LOCALE。
 */
export function getLocaleFromPath(pathname: string): string {
  const seg = pathname.split('/').filter(Boolean)[0];
  if (seg && LOCALES.some((l) => l.code === seg)) return seg;
  return DEFAULT_LOCALE;
}

/** 客户端内嵌 JSON（挂在 window.__I18N__），供 [data-i18n] 替换脚本使用 */
export const I18N_EMBED_JSON = JSON.stringify(UI_STRINGS_NONDEFAULT);
