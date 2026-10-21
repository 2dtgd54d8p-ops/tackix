/**
 * Cloudflare 运行时绑定 / 环境变量统一入口。
 * 后台 API（Pages Functions / Astro SSR）通过 locals.runtime.env 访问绑定。
 * 把类型与取值逻辑集中在此，避免各 API 路由重复判断。
 */
import type { AstroGlobal } from 'astro';

// Cloudflare 专属类型用 any 兜底，避免强依赖 @cloudflare/workers-types 造成的类型报错。
export interface Env {
  DB: any; // D1Database
  MEDIA: any; // R2Bucket
  ASSETS: any; // Fetcher（访问静态资源，用于媒体回退）
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
  PAGES_DEPLOY_HOOK: string;
  SITE_URL: string;
  [key: string]: any;
}

/** 从 Astro API route 的 context.locals 或 Astro.locals 取出 env。 */
export function getEnv(locals: any): Env {
  return (
    locals?.runtime?.env ??
    locals?.env ??
    (typeof process !== 'undefined' ? (process.env as any) : undefined) ??
    ({} as Env)
  );
}

/** 便捷封装：从 Astro 全局取 env。 */
export function envFromAstro(Astro: AstroGlobal): Env {
  return getEnv((Astro as any).locals);
}

export const ADMIN_COOKIE = 'tackix_session';
export const SESSION_MAX_AGE = 34560000; // 400 天
