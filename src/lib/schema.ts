/**
 * 结构化数据（schema.org JSON-LD）辅助模块
 * ---------------------------------------------------------------
 * 集中产出本站需要的语义节点，避免在前端页面里散落拼装：
 *   - organizationSchema：组织信息（公司名/邮箱/电话/地址），含 ContactPoint，
 *     用于首页 / 关于 / 联系页，强化 E-E-A-T 与「公司实体」识别。
 *   - howToSchema：把场景方案的「选型逻辑要点」映射为 HowTo + HowToStep，
 *     用于场景详情页，争取富媒体结果（步骤列表）。
 *   - inLanguage：双语站每篇内容都要带语种，供 Google / AI 检索体正确取用版本。
 *
 * 所有函数均为纯函数，调用方自行用 JSON.stringify 注入 <script type="application/ld+json">。
 */
import { pickB, type Locale } from './i18n';

/** BCP-47 语种标签：英文页用 en，其余（含 zh-CN）用 zh-CN */
export function inLanguage(locale: Locale): string {
  return locale === 'en' ? 'en' : 'zh-CN';
}

/** 站点联系信息子集（取自 loadSiteData().site，已按当前语种取好单语字符串） */
export interface SiteContact {
  title: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  description?: string;
}

/**
 * 组织实体 Schema。返回可 JSON 序列化的对象（不含 @context，
 * 由调用方与 @context 合并或独立成块都行）。
 * base 建议传 `Astro.site ?? Astro.url`，用于补全 logo / 主页绝对地址。
 */
export function organizationSchema(locale: Locale, site: SiteContact, base: URL) {
  const root = new URL('/', base).href.replace(/\/$/, '');
  const org: Record<string, unknown> = {
    '@type': 'Organization',
    name: (site.company || site.title).trim(),
    url: root,
    logo: new URL('/favicon.svg', base).href,
  };
  if (site.description) org.description = site.description;

  const cp: Record<string, unknown> = {
    '@type': 'ContactPoint',
    contactType: 'sales',
    areaServed: 'Worldwide',
    availableLanguage: ['zh-CN', 'en'],
  };
  let hasContact = false;
  if (site.email) {
    cp.email = site.email;
    hasContact = true;
  }
  if (site.phone) {
    cp.telephone = site.phone;
    hasContact = true;
  }
  if (hasContact) org.contactPoint = cp;

  if (site.address) {
    org.address = { '@type': 'PostalAddress', streetAddress: site.address };
  }
  return org;
}

/**
 * 把一组双语要点映射为 HowTo 步骤。points 需为 `{ zh?, en? }` 形态
 * （如场景方案的 selectionLogic[i].point）。无有效步骤返回 null，
 * 调用方据此决定是否注入 script。
 */
export function howToSchema(
  locale: Locale,
  name: string,
  points: Array<{ zh?: string; en?: string } | undefined | null>
) {
  if (!points || !points.length) return null;
  const steps = points
    .map((p) => (p ? pickB(locale, p as any) : ''))
    .filter((text): text is string => !!text && text.trim().length > 0)
    .map((text, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      text: text.trim(),
    }));
  if (!steps.length) return null;
  return {
    '@type': 'HowTo',
    name,
    inLanguage: inLanguage(locale),
    step: steps,
  };
}

/**
 * 知识库文章的「结构化步骤」→ HowTo。steps 为 knowledge 集合的 steps 字段，
 * 每个元素结构：{ title?: Bilingual, text?: Bilingual, pitfall?: boolean }。
 *
 * 设计要点（与场景页 howToSchema 区分）：
 *   - 只取 pitfall=false 的条目作为 HowToStep（带编号），pitfall=true 的「避坑要点」
 *     在页面以警示样式单独成段，但不进入 HowTo，避免把「不要做」混进「步骤」。
 *   - 每步优先用 title 作 HowToStep.name，text 作正文；两者都空则跳过该步。
 *   - 无任何有效步骤返回 null，调用方据此决定是否注入 script。
 */
export interface KnowledgeStep {
  title?: { zh?: string; en?: string } | null;
  text?: { zh?: string; en?: string } | null;
  pitfall?: boolean;
}

export function howToFromSteps(
  locale: Locale,
  name: string,
  steps: Array<KnowledgeStep | undefined | null> | undefined | null
) {
  if (!steps || !steps.length) return null;
  const proc = steps
    .filter((s) => s && !s.pitfall)
    .map((s) => ({
      title: pickB(locale, (s as KnowledgeStep).title as any),
      text: pickB(locale, (s as KnowledgeStep).text as any),
    }))
    .filter((s) => (s.title && s.title.trim()) || (s.text && s.text.trim()))
    .map((s, i) => ({
      '@type': 'HowToStep' as const,
      position: i + 1,
      ...(s.title && s.title.trim() ? { name: s.title.trim() } : {}),
      // schema.org 的 HowToStep.text 为必填；title 已单独作 name 时，text 仍保留完整描述
      text: (s.text && s.text.trim()) || (s.title && s.title.trim()) || '',
    }));
  if (!proc.length) return null;
  return {
    '@type': 'HowTo' as const,
    name,
    inLanguage: inLanguage(locale),
    step: proc,
  };
}
