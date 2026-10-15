// @ts-check
/**
 * 多语言（i18n）基础设施
 * ---------------------------------------------------------------
 * 站点采用「中文默认（无前缀 /）+ 英文 /en 前缀」的双语结构：
 *   - defaultLocale: 'zh-CN'，路由无前缀（首页 = / ）
 *   - 英文位于 /en/ 下（首页 = /en/ ）
 * 切换方式为顶部语言按钮 + localStorage 记忆（见 Base.astro）。
 *
 * 数据层（site-data.ts）中所有展示文案均为 Bilingual 对象 { zh, en }，
 * 页面按当前 locale 用 pickB() 取值；后台留空则回落默认值。
 */

export type Locale = 'zh-CN' | 'en';
export const LOCALES: Locale[] = ['zh-CN', 'en'];
export const DEFAULT_LOCALE: Locale = 'zh-CN';

/** 双语字段标准形态 */
export type Bilingual = { zh: string; en: string };

/** 从 Astro 上下文取当前语种（默认中文） */
export function getLocale(astro: { currentLocale?: string | undefined }): Locale {
  return astro.currentLocale === 'en' ? 'en' : DEFAULT_LOCALE;
}

/** 语种对应的 URL 前缀：中文为 ''，英文为 '/en' */
export function localePrefix(locale: Locale): string {
  return locale === 'en' ? '/en' : '';
}

/** 站点的 BCP-47 语言码（用于 og:locale） */
export function ogLocale(locale: Locale): string {
  return locale === 'en' ? 'en_US' : 'zh_CN';
}

/**
 * 取双语字段中当前语种的值；当前语种为空时回落到另一语种，再回落到空串。
 * 用法：pickB(locale, item.title)
 */
export function pickB(locale: Locale, v?: Bilingual | null | undefined): string {
  if (!v) return '';
  const primary = locale === 'en' ? v.en : v.zh;
  if (primary && primary.trim()) return primary.trim();
  const fallback = locale === 'en' ? v.zh : v.en;
  return (fallback ?? '').trim();
}

/** 纯字符串回退（兼容部分字段本就是单语，如邮箱/电话） */
export function pickStr(def: string, v?: string | null): string {
  return v && v.trim() ? v : def;
}

/** 取双语字段的另一语种值（用于「阅读英文/中文」互链场景，可选） */
export function otherLocale(locale: Locale): Locale {
  return locale === 'en' ? 'zh-CN' : 'en';
}
