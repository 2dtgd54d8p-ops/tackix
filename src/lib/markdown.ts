import { marked } from 'marked';

/**
 * 把 Keystatic 的 mdx.inline 字段（序列化后的 Markdown 字符串）渲染成 HTML。
 * Keystatic 0.6.9 的 mdx.inline 读取结果有两种形态，这里都做兼容：
 *  - 字符串（最常见）：直接是 Markdown 文本；
 *  - 对象 { content }（部分 reader 路径）：取 .content。
 */
export async function renderMarkdown(md: unknown): Promise<string> {
  if (!md) return '';
  let text = '';
  if (typeof md === 'string') text = md;
  else if (md && typeof (md as { content?: unknown }).content === 'string')
    text = (md as { content: string }).content;
  if (!text.trim()) return '';
  return (await marked.parse(text)) as string;
}

/** 估算英文阅读时长（约 200 词/分钟） */
export function readingMinutes(body: unknown): number {
  if (!body || typeof body !== 'string') return 1;
  const words = (body.match(/[a-zA-Z0-9]+/g) || []).length;
  return Math.max(1, Math.ceil(words / 200));
}

/**
 * Keystatic 图片字段（fields.image）读取后通常只返回文件名（如 "abc.png"），
 * 完整可访问 URL 需拼接 publicPath（/uploads/）。兼容已带斜杠的完整路径。
 */
export function coverSrc(cover: unknown): string {
  if (!cover || typeof cover !== 'string') return '';
  return cover.startsWith('/') ? cover : `/uploads/${cover}`;
}
