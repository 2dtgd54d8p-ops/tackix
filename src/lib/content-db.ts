/**
 * D1 内容读写封装。所有后台 API 与构建期脚本共用同一张 content_entries 表。
 * 仅依赖 D1 绑定（any 类型，避免强耦合 workers-types）。
 */
export interface Row {
  id: string;
  kind: 'knowledge' | 'scenario' | 'singleton';
  collection: string;
  slug: string;
  data: any;
  title_zh: string | null;
  title_en: string | null;
  published: number;
  featured: number;
  updated_at: number;
}

export async function listRows(db: any, kind?: string): Promise<any[]> {
  const sql =
    kind && kind !== 'all'
      ? 'SELECT id,kind,collection,slug,title_zh,title_en,published,featured,updated_at FROM content_entries WHERE kind=? ORDER BY updated_at DESC'
      : 'SELECT id,kind,collection,slug,title_zh,title_en,published,featured,updated_at FROM content_entries ORDER BY updated_at DESC';
  const stmt = kind && kind !== 'all' ? db.prepare(sql).bind(kind) : db.prepare(sql);
  const res = await stmt.all();
  return (res as any)?.results ?? [];
}

export async function readRow(db: any, id: string): Promise<Row | null> {
  return (await db.prepare('SELECT * FROM content_entries WHERE id=?').bind(id).first()) as Row | null;
}

export async function upsertRow(
  db: any,
  r: {
    id: string;
    kind: Row['kind'];
    collection: string;
    slug: string;
    data: any;
    title_zh?: string | null;
    title_en?: string | null;
    published?: boolean;
    featured?: boolean;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO content_entries
       (id, kind, collection, slug, data, title_zh, title_en, published, featured, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      r.id,
      r.kind,
      r.collection,
      r.slug,
      JSON.stringify(r.data ?? {}),
      r.title_zh ?? null,
      r.title_en ?? null,
      r.published ? 1 : 0,
      r.featured ? 1 : 0,
      Date.now()
    )
    .run();
}

/**
 * 追加一条内容修订快照（全量 D1 的版本回滚基础）。
 * 表未建（0003 迁移未应用）时静默降级，不阻断保存主流程。
 */
export async function addRevision(
  db: any,
  r: { id: string; collection: string; slug: string; data: any; action?: string }
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO content_revisions (entry_id, collection, slug, data, action, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        r.id,
        r.collection,
        r.slug,
        JSON.stringify(r.data ?? {}),
        r.action ?? 'save',
        Date.now()
      )
      .run();
  } catch (e: any) {
    // 未应用 0003_revisions.sql 时不阻断保存
    console.warn('[content-db] 写修订失败（可能未应用 0003_revisions.sql）:', e?.message || e);
  }
}

export async function deleteRow(db: any, id: string): Promise<void> {
  await db.prepare('DELETE FROM content_entries WHERE id=?').bind(id).run();
}

/** 某条内容的修订历史（新→旧），不含完整 data（列表用）。 */
export async function listRevisions(db: any, entryId: string, limit = 30): Promise<any[]> {
  try {
    const res = await db
      .prepare(
        `SELECT id, entry_id, collection, slug, action, created_at, length(data) AS bytes
         FROM content_revisions WHERE entry_id=? ORDER BY created_at DESC LIMIT ?`
      )
      .bind(entryId, Math.min(Math.max(limit, 1), 100))
      .all();
    return (res as any)?.results ?? [];
  } catch {
    // 未应用 0003_revisions.sql 时返回空，UI 显示"暂无历史"
    return [];
  }
}

/** 读取单个修订快照（含完整 data）。 */
export async function readRevision(db: any, revisionId: number): Promise<any | null> {
  try {
    const row = await db
      .prepare('SELECT * FROM content_revisions WHERE id=?')
      .bind(revisionId)
      .first();
    if (!row) return null;
    let data = row.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { data = {}; }
    }
    return { ...row, data };
  } catch {
    return null;
  }
}

/** 某条内容的修订总数（UI 上显示角标）。 */
export async function countRevisions(db: any, entryId: string): Promise<number> {
  try {
    const r: any = await db
      .prepare('SELECT COUNT(*) AS n FROM content_revisions WHERE entry_id=?')
      .bind(entryId)
      .first();
    return Number(r?.n ?? 0);
  } catch {
    return 0;
  }
}

/** collection 名 → kind（单例走 singleton）。 */
export function kindOfCollection(collection: string): Row['kind'] {
  if (collection === 'knowledge') return 'knowledge';
  if (collection === 'scenarios') return 'scenario';
  return 'singleton';
}

/** 从 data 取双语标题（用于反规范化列）。 */
export function titlesFromData(data: any): { zh: string | null; en: string | null } {
  const name = data?.name;
  if (name && typeof name === 'object') {
    return { zh: name.zh ?? null, en: name.en ?? null };
  }
  const t = data?.title;
  if (typeof t === 'string') return { zh: t, en: t };
  return { zh: null, en: null };
}
