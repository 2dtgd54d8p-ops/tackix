/**
 * 资源基础路径抽象层（存储后端可切换的预留位）。
 *
 * 默认指向站点根下的 /uploads（Cloudflare Pages 随构建分发的静态资源目录）。
 * 若未来把存储迁到外部对象存储（腾讯 COS / 阿里 OSS / AWS S3 / Cloudflare R2 等），
 * 只需在构建/部署时注入环境变量 PUBLIC_UPLOADS_BASE（例如
 * https://bucket.cos.ap-guangzhou.myqcloud.com/tackix），所有 /uploads/* 引用会自动改写，
 * 无需改动任何页面组件。对外 URL 契约（/uploads/...）保持不变，前端零改动即可切换后端。
 */
export const UPLOADS_BASE: string = (
  (import.meta.env.PUBLIC_UPLOADS_BASE as string | undefined) ?? '/uploads'
).replace(/\/+$/, '');

/** 将资源相对路径解析为可访问 URL；兼容已带 / 的站点绝对路径与 http(s) 外链。 */
export function uploadsUrl(path: string): string {
  if (path.startsWith('/') || /^https?:\/\//.test(path)) return path;
  return `${UPLOADS_BASE}/${path}`;
}
