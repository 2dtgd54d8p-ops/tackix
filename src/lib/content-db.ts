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

export async function deleteRow(db: any, id: string): Promise<void> {
  await db.prepare('DELETE FROM content_entries WHERE id=?').bind(id).run();
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
