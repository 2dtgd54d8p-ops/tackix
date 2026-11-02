-- 0002_domain.sql · 选型领域基座（工业胶粘剂/密封剂选型结构化数据层）
-- 与 0001_init.sql 的 content_entries（长文内容）并存：
--   content_entries = 文章/单例长文；本文件 = 结构化选型数据。
-- 幂等：全部 IF NOT EXISTS / INSERT OR IGNORE，可重复执行。

-- ── 1) 产品主数据（胶粘剂 / 密封剂） ─────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  brand         TEXT,
  name_zh       TEXT NOT NULL,
  name_en       TEXT,
  category      TEXT NOT NULL,          -- structural / non-structural / sealant / adhesive
  chemistry     TEXT,                   -- epoxy / pu / acrylic / silicone / cyanoacrylate / ms-polymer
  cure_type     TEXT,                   -- 1-part / 2-part / UV / moisture
  color         TEXT,
  viscosity     REAL,                   -- mPa·s
  tensile_str   REAL,                   -- MPa
  elongation    REAL,                   -- %
  temp_min      REAL,                   -- °C
  temp_max      REAL,                   -- °C
  shore         TEXT,                   -- 硬度（如 D80 / A50）
  mix_ratio     TEXT,                   -- 如 1:1
  pot_life_min  INTEGER,                -- 可操作时间（分钟）
  cure_time_min INTEGER,                -- 初固时间（分钟）
  shelf_life    TEXT,                   -- 保质期
  features      TEXT,                   -- JSON 数组，如 ["high-strength","metal"]
  attrs         TEXT,                   -- JSON 扩展技术参数（灵活列）
  published     INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_category  ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_chemistry ON products(chemistry);
CREATE INDEX IF NOT EXISTS idx_products_published ON products(published);

-- ── 2) 基材库 ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS substrates (
  id             TEXT PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE,
  name_zh        TEXT NOT NULL,
  name_en        TEXT,
  category       TEXT,                  -- metal / plastic / wood / glass / ceramic / concrete / composite / rubber
  surface_energy TEXT,                  -- high / low 表面能
  notes          TEXT
);

-- ── 3) 应用场景 / 工况 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS applications (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name_zh     TEXT NOT NULL,
  name_en     TEXT,
  environment TEXT,                     -- indoor / outdoor / underwater / high-temp / chemical
  load_type   TEXT,                     -- static / dynamic / shock
  certs       TEXT                      -- JSON 数组：所需认证（UL/FDA/ROHS…）
);

-- ── 4) 兼容矩阵（选型核心）：基材 × 产品 → 适配度 ─────────────────
CREATE TABLE IF NOT EXISTS compatibility (
  id           TEXT PRIMARY KEY,
  product_id   TEXT NOT NULL REFERENCES products(id),
  substrate_id TEXT NOT NULL REFERENCES substrates(id),
  suitability  INTEGER NOT NULL,        -- 1=差 2=一般 3=好 4=优
  primer_req   INTEGER NOT NULL DEFAULT 0,  -- 是否需要底涂
  surface_prep TEXT,                    -- 表面处理建议
  note         TEXT,
  UNIQUE(product_id, substrate_id)
);
CREATE INDEX IF NOT EXISTS idx_comp_product   ON compatibility(product_id);
CREATE INDEX IF NOT EXISTS idx_comp_substrate ON compatibility(substrate_id);
CREATE INDEX IF NOT EXISTS idx_comp_suit      ON compatibility(suitability);

-- ── 5) 产品 × 应用场景（多对多） ────────────────────────────────
CREATE TABLE IF NOT EXISTS product_applications (
  product_id     TEXT NOT NULL REFERENCES products(id),
  application_id TEXT NOT NULL REFERENCES applications(id),
  PRIMARY KEY (product_id, application_id)
);

-- ── 6) 文档索引（TDS/SDS 实体存 R2） ────────────────────────────
CREATE TABLE IF NOT EXISTS product_docs (
  id         TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  doc_type   TEXT NOT NULL,             -- tds / sds
  lang       TEXT NOT NULL DEFAULT 'zh',
  r2_key     TEXT NOT NULL,             -- R2 object key
  url        TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_docs_product ON product_docs(product_id);

-- ── 7) 供应商 / 货源 ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  region     TEXT,
  contact    TEXT,
  product_id TEXT REFERENCES products(id),
  moq        TEXT,
  lead_time  TEXT,
  price_ref  TEXT,
  updated_at INTEGER NOT NULL
);

-- ── 8) 选型规则（可选规则引擎，先留表不启用） ────────────────────
CREATE TABLE IF NOT EXISTS selection_rules (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  conditions TEXT NOT NULL,             -- JSON 命中条件
  boost      TEXT NOT NULL,             -- JSON 加权/过滤
  priority   INTEGER DEFAULT 0,
  enabled    INTEGER DEFAULT 1
);

-- ── 9) 标准基材种子（可编辑；INSERT OR IGNORE 幂等） ─────────────
INSERT OR IGNORE INTO substrates (id, slug, name_zh, name_en, category, surface_energy) VALUES
  ('SUB-ALU',      'aluminum',        '铝',      'Aluminum',                'metal',     'high'),
  ('SUB-STEEL',    'steel',           '钢',      'Steel',                   'metal',     'high'),
  ('SUB-SS',       'stainless-steel', '不锈钢',  'Stainless Steel',         'metal',     'high'),
  ('SUB-ABS',      'abs',             'ABS',     'ABS',                     'plastic',   'low'),
  ('SUB-PP',       'pp',              '聚丙烯',  'Polypropylene (PP)',      'plastic',   'low'),
  ('SUB-PE',       'pe',              '聚乙烯',  'Polyethylene (PE)',       'plastic',   'low'),
  ('SUB-PVC',      'pvc',             '聚氯乙烯','PVC',                     'plastic',   'low'),
  ('SUB-PC',       'pc',              '聚碳酸酯','Polycarbonate (PC)',      'plastic',   'low'),
  ('SUB-WOOD',     'wood',            '木材',    'Wood',                    'wood',      'low'),
  ('SUB-GLASS',    'glass',           '玻璃',    'Glass',                   'glass',     'high'),
  ('SUB-CERAMIC',  'ceramic',         '陶瓷',    'Ceramic',                 'ceramic',   'high'),
  ('SUB-CONCRETE', 'concrete',        '混凝土',  'Concrete',                'concrete',  'high'),
  ('SUB-COMPOSITE','composite',       '复合材料','Composite (FRP/CFRP)',    'composite', 'low'),
  ('SUB-RUBBER',   'rubber',          '橡胶',    'Rubber',                  'rubber',    'low');

-- ── 10) 标准应用场景种子（可编辑） ───────────────────────────────
INSERT OR IGNORE INTO applications (id, slug, name_zh, name_en, environment, load_type) VALUES
  ('APP-AUTO',     'automotive',        '汽车',        'Automotive',          'outdoor',   'dynamic'),
  ('APP-CONSTR',   'construction',      '建筑',        'Construction',        'outdoor',   'static'),
  ('APP-ELEC',     'electronics',       '电子',        'Electronics',         'indoor',    'static'),
  ('APP-MARINE',   'marine',            '船舶/海洋',   'Marine',              'underwater','static'),
  ('APP-AERO',     'aerospace',         '航空',        'Aerospace',           'high-temp', 'dynamic'),
  ('APP-INDUSTRY', 'industrial-assembly','工业装配',   'Industrial Assembly', 'indoor',    'dynamic'),
  ('APP-DIY',      'diy',               '家装/DIY',    'DIY / Home',          'indoor',    'static');
