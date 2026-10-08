-- Cloudflare D1 建表脚本（tackix 联系表单）
--
-- 使用前提：
--   1) 已在 Cloudflare 创建 D1 数据库（例如 tackix-db）
--   2) 已在 Pages 项目 tackix → Settings → Functions → D1 database bindings 里
--      绑定 Variable name = DB
--
-- 执行方式（二选一）：
--   A) 本地：npx wrangler d1 execute tackix-db --file=./d1-schema.sql --remote
--   B) 控制台：进入该 D1 数据库 → Console 标签 → 粘贴执行

DROP TABLE IF EXISTS submissions;

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 便于后台按时间倒序查看
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions (created_at DESC);
