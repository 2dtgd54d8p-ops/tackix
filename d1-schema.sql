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

-- ───────────────────────────────────────────────────────────
-- 流量统计表（匿名访问埋点）
-- 由 /api/visit 在首次访问时惰性建表（CREATE TABLE IF NOT EXISTS），
-- 通常无需手动执行本段；此处仅作 schema 记录与本地/控制台建表参考。
--   - vuid：匿名访客 ID（HttpOnly cookie，仅 UV 去重，不存 IP/PII）
--   - dev / br：由 User-Agent 粗略识别的设备 / 浏览器家族
--   - ref：站外来源（站内跳转折叠为 (internal)，空为 (direct)）
-- ───────────────────────────────────────────────────────────
DROP TABLE IF EXISTS visits;

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

CREATE INDEX IF NOT EXISTS idx_visits_day ON visits (day);
CREATE INDEX IF NOT EXISTS idx_visits_path ON visits (path);
CREATE INDEX IF NOT EXISTS idx_visits_vuid ON visits (vuid);
