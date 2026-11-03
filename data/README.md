# 数据导入（选型数据基座）

本目录是 `scripts/import-products.mjs` 的输入模板。

## 填什么
1. `products.sample.csv` → 复制为 `products.csv`，填产品主数据（一行一个产品）
2. `compatibility.sample.csv` → 复制为 `compatibility.csv`，填「基材 × 产品」适配度

```bash
cp data/products.sample.csv data/products.csv
cp data/compatibility.sample.csv data/compatibility.csv
```

## products.csv 列
`id,slug,brand,name_zh,name_en,category,chemistry,cure_type,color,viscosity,tensile_str,elongation,temp_min,temp_max,shore,mix_ratio,pot_life_min,cure_time_min,shelf_life,features`
- `id` 必须唯一且稳定（改了会被当成新产品）
- `slug` URL 友好，唯一
- `features` 为 JSON 数组字符串，如 `"[""high-strength"",""metal""]"`
- 数值列留空则存 NULL

## compatibility.csv 列
`product_id,substrate_id,suitability,primer_req,surface_prep,note`
- `product_id` 可写产品 `id` 或 `slug`
- `substrate_id` 可写 `SUB-ALU` 或 `aluminum`（内置映射见 `migrations/0002_domain.sql`）
- `suitability`：1=差 2=一般 3=好 4=优
- `primer_req`：true/false

## 导入命令
```bash
# 只生成 SQL 检查（不写库）
node scripts/import-products.mjs --file data/products.csv --compat data/compatibility.csv --sql-only

# 写本地 D1
node scripts/import-products.mjs --file data/products.csv --compat data/compatibility.csv --local

# 写线上 D1（需先建库 + 配 CLOUDFLARE_API_TOKEN）
node scripts/import-products.mjs --file data/products.csv --compat data/compatibility.csv --remote
```

## 注意
- 幂等：`INSERT OR REPLACE`，可重复导入
- 先建库并 apply `migrations/`（含 `0002_domain.sql`），否则表不存在
- 导入顺序：products 先、compatibility 后（脚本同一次执行已按此顺序）
