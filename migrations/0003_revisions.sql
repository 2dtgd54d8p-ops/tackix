-- 0003_revisions.sql · 内容修订历史（全量 D1 的版本回滚基础）
-- 每次保存 / 删除向 content_revisions 追加一条快照；配合回滚接口可恢复历史版本。
-- 幂等：IF NOT EXISTS。
CREATE TABLE IF NOT EXISTS content_revisions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id   TEXT NOT NULL,                 -- 对应 content_entries.id
  collection TEXT NOT NULL,
  slug       TEXT NOT NULL,
  data       TEXT NOT NULL,                 -- 该次保存的完整 data 快照（JSON）
  action     TEXT NOT NULL DEFAULT 'save',  -- save / delete
  created_at INTEGER NOT NULL               -- Unix 毫秒
);
CREATE INDEX IF NOT EXISTS idx_rev_entry ON content_revisions(entry_id, created_at DESC);
