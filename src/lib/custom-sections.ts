/**
 * 自定义内容区块（customSections）类型与归一化。
 *
 * 后台「自定义内容区块」数组（由内容后台写入 D1，构建期经 content.json 读取）
 * 让编辑者自由组合任意结构化区块：标题 / 段落 / 图片 / 提示框 / 引用。
 * 与正文（Markdown）互补，满足「任意自定义内容的填报与发布」。
 *
 * 详情页组件（KnowledgeDetail / SolutionsDetail）调用 normalizeSections 拿到
 * 规整后的数组后，按 type 渲染对应版式。
 */
import { coverSrc } from './markdown';

export type SectionType = 'heading' | 'paragraph' | 'image' | 'callout' | 'quote';
export type CalloutTone = 'info' | 'warn' | 'danger';

export interface CustomSection {
  type: SectionType;
  heading?: string;
  text?: string;
  /** 已解析为可访问 URL 的图片地址（/uploads/xxx 或完整路径） */
  image?: string;
  imageCaption?: string;
  calloutTone: CalloutTone;
}

/** 把后台原始数组转成渲染用的规整结构；非法 / 缺字段时安全降级。 */
export function normalizeSections(raw: unknown): CustomSection[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, any> => !!s && typeof s === 'object')
    .map((s) => {
      // 仅允许 5 种已知类型；后台 select 只会产生这些，但若 YAML 被手改/损坏，
      // 未知类型回落为段落，避免渲染时落到默认分支而静默丢内容。
      const type: SectionType =
        s.type === 'heading' ||
        s.type === 'paragraph' ||
        s.type === 'image' ||
        s.type === 'callout' ||
        s.type === 'quote'
          ? s.type
          : 'paragraph';
      const heading = typeof s.heading === 'string' ? s.heading.trim() : '';
      const text = typeof s.text === 'string' ? s.text.trim() : '';
      // fields.image 读取后为文件名字符串，复用 coverSrc 拼成可访问 URL
      const image = coverSrc(typeof s.image === 'string' ? s.image : (s.image?.url ?? ''));
      const imageCaption =
        typeof s.imageCaption === 'string' ? s.imageCaption.trim() : '';
      const calloutTone: CalloutTone =
        s.calloutTone === 'warn' || s.calloutTone === 'danger' ? s.calloutTone : 'info';
      return { type, heading, text, image, imageCaption, calloutTone };
    });
}
