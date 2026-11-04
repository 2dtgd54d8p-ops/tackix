-- 0004: 业务数据表（询盘留言 / 匿名访问统计）
-- 背景：历史上这些表在独立库 tackix-db（169af261…）中，与内容库 tackix-content 分离。
-- 全量 D1 方案要求单一数据库（Pages 只支持一个 DB 绑定），故并入内容库。
-- 代码侧 src/lib/traffic.ts 与 src/pages/api/contact.ts 都有惰性建表，此迁移仅作显式声明 + 幂等保障。

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  path TEXT NOT NULL,
  vuid TEXT NOT NULL,
  ref TEXT NOT NULL DEFAULT '',
  ua TEXT NOT NULL DEFAULT '',
  dev TEXT NOT NULL DEFAULT '',
  br TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_visits_day ON visits(day);
CREATE INDEX IF NOT EXISTS idx_visits_path ON visits(path);
CREATE INDEX IF NOT EXISTS idx_visits_vuid ON visits(vuid);

-- 询盘按创建时间倒序查询
CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions(created_at DESC);
