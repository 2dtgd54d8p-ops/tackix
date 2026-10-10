/**
 * 多语言内容层（T12）
 * ---------------------------------------------------------------
 * 背景：T10 只做了「客户端外壳本地化」（nav/按钮等 UI 文案），
 *       但页面标题、描述、正文等**内容**仍是纯中文，且没有真实
 *       /en 路由 —— 对 SEO 与海外买家是硬伤。
 *
 * 方案：静态站 + 内容集合的轻量做法 —— 不引入 i18n 框架，而是在
 *      内容集合中为每个字段增加 `en` 平行字段（可选），
 *      页面通过 ? 路由前缀（/en/...）选择渲染哪套文案。
 *
 * 为控制复杂度与维护成本，当前策略：
 *   ① **核心 SEO 面**（标题/描述/正文/FAQ）提供 en 全量翻译 —— 这决定
 *      英文页能否被 Google 与 AI 抓取，是海外流量的入口；
 *   ② vi / th 作为**语种入口页**（locale landing）先上线，正文回退到 en，
 *      后续按市场优先级逐页补译 —— 避免大面积低质机翻损害 SEO；
 *   ③ 所有译文可通过 YAML 独立维护，翻译到位即自动生效。
 *
 * 术语约定：产品型号（TAC-8800 / ABRO-8800）、化学体系缩写（UV、RoHS、
 *   TDS/SDS）、单位（mm / ℃ / mPa·s）**不翻译**，保持行业通用写法。
 */

export interface ProductTranslation {
  /** 产品名称（en） */
  name?: string;
  /** 一句话简介（en） */
  excerpt?: string;
  /** 产品描述正文（en，Markdown） */
  body?: string;
}

export interface PostTranslation {
  title?: string;
  excerpt?: string;
  body?: string;
  /** FAQ 译文，与源数组同序；长度不一致时按索引安全取值 */
  faq?: { question: string; answer: string }[];
}

export interface CaseTranslation {
  title?: string;
  excerpt?: string;
  challenge?: string;
  solution?: string;
  result?: string;
  body?: string;
}

/** 语种元信息（hreflang 用 BCP-47） */
export const LOCALE_META = {
  'zh-CN': { htmlLang: 'zh-CN', hreflang: 'zh-CN', label: '中文', ogLocale: 'zh_CN' },
  en: { htmlLang: 'en', hreflang: 'en', label: 'English', ogLocale: 'en_US' },
  vi: { htmlLang: 'vi', hreflang: 'vi', label: 'Tiếng Việt', ogLocale: 'vi_VN' },
  th: { htmlLang: 'th', hreflang: 'th', label: 'ไทย', ogLocale: 'th_TH' },
} as const;

export type LocaleCode = keyof typeof LOCALE_META;

/** 当前已具备**完整内容**的语种（其余语种渲染 en 作为回退） */
export const FULLY_TRANSLATED: LocaleCode[] = ['zh-CN', 'en'];

/** 参与 hreflang 输出的语种（避免声明无对应页面的语种造成软 404） */
export const HREFLANG_LOCALES: LocaleCode[] = ['zh-CN', 'en'];

/** 判断是否需要为该语种输出 hreflang：仅当目标页真实存在 */
export function resolveContentLocale(requested: string): LocaleCode {
  return (FULLY_TRANSLATED as string[]).includes(requested) ? (requested as LocaleCode) : 'en';
}

/**
 * 取翻译字段，缺失时回退中文原文。
 * @param zh  中文原文（必填，保证任何情况下都有内容，不出现空页）
 * @param t   译文（可选）
 */
export function pick<T>(zh: string | undefined, t: string | undefined): string {
  return (t && t.trim() ? t : zh ?? '') as string;
}

/** 取翻译字段数组 */
export function pickArray<T>(zh: T[] | undefined, t: T[] | undefined): T[] {
  return (t && t.length ? t : zh ?? []) as T[];
}
