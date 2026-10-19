// 流量统计公共模块：visits 事件表 + 聚合查询。
//
// 设计要点：
//  - 复用 Cloudflare D1（已绑定为 DB），不引入新存储。
//  - 以匿名访客 ID（vuid cookie，仅用于 UV 去重，不存 IP/PII）为口径。
//  - 表结构用 CREATE TABLE IF NOT EXISTS 惰性建表（首次访问时自动落地到线上 D1），
//    因此无需通过 API Token 预先执行 DDL，也不会因表不存在而报错。
//  - 所有函数对「DB 未绑定」优雅降级（返回 null / false，不抛错）。

/** 建表 DDL：逐条 prepare().run() 执行，兼容线上 D1 绑定（最稳妥的多语句方式） */
const VISITS_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day TEXT NOT NULL,
    path TEXT NOT NULL,
    vuid TEXT NOT NULL,
    ref TEXT NOT NULL DEFAULT '',
    ua TEXT NOT NULL DEFAULT '',
    dev TEXT NOT NULL DEFAULT '',
    br TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_visits_day ON visits(day)',
  'CREATE INDEX IF NOT EXISTS idx_visits_path ON visits(path)',
  'CREATE INDEX IF NOT EXISTS idx_visits_vuid ON visits(vuid)',
];

/** 惰性建表：确保 visits 表 + 索引存在（幂等） */
export async function ensureVisits(env: any): Promise<boolean> {
  const db = env?.DB;
  if (!db) return false;
  try {
    for (const sql of VISITS_DDL) {
      await db.prepare(sql).run();
    }
    return true;
  } catch {
    return false;
  }
}

/** 从 User-Agent 粗略识别设备与浏览器家族（用于分布统计） */
export function parseUa(ua: string): { dev: string; br: string } {
  if (!ua) return { dev: 'unknown', br: 'unknown' };
  const s = ua.toLowerCase();

  if (
    /(bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|baiduspider|yandex|applebot|curl|python-urllib|go-http)/.test(
      s
    )
  ) {
    return { dev: 'bot', br: 'bot' };
  }

  let dev = 'desktop';
  const isTablet = /(ipad|tablet|kindle|playbook|silk|android.*tablet)/.test(s);
  const isMobile = /(mobile|android|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop)/.test(s);
  if (isTablet) dev = 'tablet';
  else if (isMobile) dev = 'mobile';

  let br = 'other';
  if (/edg\//.test(s)) br = 'edge';
  else if (/opr\/|opera/.test(s)) br = 'opera';
  else if (/chrome\//.test(s) && !/chromium/.test(s)) br = 'chrome';
  else if (/chromium\//.test(s)) br = 'chromium';
  else if (/firefox\/|fxios/.test(s)) br = 'firefox';
  else if (/safari\//.test(s) && /version\//.test(s) && !/chrome|chromium|edg|opr/.test(s)) br = 'safari';
  else if (/msie |trident\//.test(s)) br = 'ie';

  return { dev, br };
}

/** 写入一条访问事件；成功返回 true，DB 缺失或失败返回 false */
export async function recordVisit(
  env: any,
  opts: { path: string; ref: string; ua: string; vuid: string }
): Promise<boolean> {
  const db = env?.DB;
  if (!db) return false;
  try {
    await ensureVisits(env);
    const day = new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD
    const { dev, br } = parseUa(opts.ua);
    await db
      .prepare(
        'INSERT INTO visits (day, path, vuid, ref, ua, dev, br, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(day, opts.path, opts.vuid, opts.ref || '', opts.ua || '', dev, br, new Date().toISOString())
      .run();
    return true;
  } catch {
    return false;
  }
}

export interface TrafficSummary {
  totalPv: number;
  totalUv: number;
  todayPv: number;
  todayUv: number;
  today: string;
  trend: Array<{ day: string; c: number; u: number }>;
  topPages: Array<{ path: string; c: number; u: number }>;
  topRef: Array<{ ref: string; c: number }>;
  devDist: Array<{ dev: string; c: number }>;
  brDist: Array<{ br: string; c: number }>;
}

/** 聚合流量概览；DB 未绑定或出错时返回 null（调用方据此优雅降级） */
export async function getTraffic(env: any): Promise<TrafficSummary | null> {
  const db = env?.DB;
  if (!db) return null;
  try {
    await ensureVisits(env);
    const today = new Date().toISOString().slice(0, 10);

    const total = (await db.prepare('SELECT COUNT(*) c, COUNT(DISTINCT vuid) u FROM visits').first()) as any;
    const todayRow = (await db
      .prepare('SELECT COUNT(*) c, COUNT(DISTINCT vuid) u FROM visits WHERE day = ?')
      .bind(today)
      .first()) as any;

    const trend = (
      (await db
        .prepare(
          "SELECT day, COUNT(*) c, COUNT(DISTINCT vuid) u FROM visits WHERE day >= date('now','-29 days') GROUP BY day ORDER BY day"
        )
        .all()) as any
    ).results as any[];

    const topPages = (
      (await db
        .prepare('SELECT path, COUNT(*) c, COUNT(DISTINCT vuid) u FROM visits GROUP BY path ORDER BY c DESC LIMIT 10')
        .all()) as any
    ).results as any[];

    const topRef = (
      (await db
        .prepare(
          "SELECT COALESCE(NULLIF(ref,''),'(direct)') ref, COUNT(*) c FROM visits GROUP BY ref ORDER BY c DESC LIMIT 10"
        )
        .all()) as any
    ).results as any[];

    const devDist = (
      (await db.prepare('SELECT dev, COUNT(*) c FROM visits GROUP BY dev ORDER BY c DESC').all()) as any
    ).results as any[];

    const brDist = (
      (await db.prepare('SELECT br, COUNT(*) c FROM visits GROUP BY br ORDER BY c DESC').all()) as any
    ).results as any[];

    return {
      totalPv: Number(total?.c) || 0,
      totalUv: Number(total?.u) || 0,
      todayPv: Number(todayRow?.c) || 0,
      todayUv: Number(todayRow?.u) || 0,
      today,
      trend: trend.map((d) => ({ day: d.day, c: Number(d.c) || 0, u: Number(d.u) || 0 })),
      topPages: topPages.map((p) => ({ path: p.path, c: Number(p.c) || 0, u: Number(p.u) || 0 })),
      topRef: topRef.map((r) => ({ ref: r.ref, c: Number(r.c) || 0 })),
      devDist: devDist.map((d) => ({ dev: d.dev, c: Number(d.c) || 0 })),
      brDist: brDist.map((b) => ({ br: b.br, c: Number(b.c) || 0 })),
    };
  } catch {
    return null;
  }
}
