-- Tackix content backend: Cloudflare D1 (SQLite)
-- 全站可编辑内容（文章 + 单例配置）的唯一真源，彻底取代 Keystatic/GitHub。
-- 复杂字段（双语对象、数组、MDX 正文）统一序列化为 data 列的 JSON 字符串。
-- 构建期由 scripts/fetch-content.mjs 读取本表 → 生成 src/generated/content.json 供 Astro 静态构建。
-- 后台编辑由 src/pages/api/content/* 实时读写本表。

CREATE TABLE IF NOT EXISTS content_entries (
  id          TEXT PRIMARY KEY,            -- knowledge/<slug> | scenarios/<slug> | singleton/<key>
  kind        TEXT NOT NULL,               -- 'knowledge' | 'scenario' | 'singleton'
  collection  TEXT NOT NULL,               -- 'knowledge' | 'scenarios' | 'home' | 'ui' | 'contact' | 'pages' | 'detail' | 'about' | 'site' | 'categories' | 'tags'
  slug        TEXT NOT NULL,               -- 集合项 URL slug；单例则为单例 key 自身
  data        TEXT NOT NULL,               -- 完整 schema 对象（与 Keystatic YAML 同构）的 JSON 字符串
  title_zh    TEXT,                        -- 反规范化：列表展示用（中文标题）
  title_en    TEXT,                        -- 反规范化：列表展示用（英文标题）
  published   INTEGER NOT NULL DEFAULT 1,  -- 0/1：草稿下架
  featured    INTEGER NOT NULL DEFAULT 0,  -- 0/1：首页/场景卡置顶
  updated_at  INTEGER NOT NULL             -- Unix 毫秒，便于排序与对账
);

CREATE INDEX IF NOT EXISTS idx_entries_kind       ON content_entries(kind);
CREATE INDEX IF NOT EXISTS idx_entries_collection ON content_entries(collection);
CREATE INDEX IF NOT EXISTS idx_entries_published  ON content_entries(published);
CREATE INDEX IF NOT EXISTS idx_entries_updated    ON content_entries(updated_at DESC);
