// 选型工具（L3 模块·模块 3「选型工具」）规则数据与评分引擎。
// 维度：基材(substrate) + 环境(environment) + 位移(movement) → 推荐胶型。
// 胶型取值与后台 tags 词表对齐：silicone-sealant / polyurethane / epoxy / ms-polymer。
// 评分采用「各维度亲和度加权求和」，纯静态、无后端依赖，构建期注入前端 JSON 复用。

export interface Bilingual {
  zh: string;
  en: string;
}
export interface Option {
  value: string;
  label: Bilingual;
  /** 选中该选项时附加的「关键要求」提示（用于结果解释） */
  hint?: Bilingual;
}
export interface Adhesive {
  value: string; // 与 tags 词表一致
  name: Bilingual;
  blurb: Bilingual;
  props: Bilingual; // 关键性能要点（短句）
  uses: Bilingual; // 典型用途
}

export const SUBSTRATES: Option[] = [
  { value: 'glass', label: { zh: '玻璃', en: 'Glass' }, hint: { zh: '需透明、低气味、不腐蚀玻璃', en: 'Needs clarity, low odor, non-corrosive to glass' } },
  { value: 'metal', label: { zh: '金属', en: 'Metal' }, hint: { zh: '注意金属种类与底涂（铝/不锈钢差异大）', en: 'Mind metal type & primer (aluminum vs stainless differ)' } },
  { value: 'tile-stone', label: { zh: '瓷砖 / 石材', en: 'Tile / Stone' }, hint: { zh: '需防霉、与填缝兼容', en: 'Needs mould resistance, grout-compatible' } },
  { value: 'wood', label: { zh: '木材', en: 'Wood' }, hint: { zh: '需一定弹性以适应木涨缩', en: 'Needs some elasticity for wood movement' } },
  { value: 'plastic', label: { zh: '塑料 (PP/PE 等)', en: 'Plastic (PP/PE…)' }, hint: { zh: '低表面能基材，建议底涂提升附着力', en: 'Low-surface-energy: use primer to improve adhesion' } },
  { value: 'concrete', label: { zh: '混凝土 / 多孔', en: 'Concrete / Porous' }, hint: { zh: '需封孔底涂，关注潮气固化', en: 'Needs primer/sealer; watch moisture cure' } },
];

export const ENVIRONMENTS: Option[] = [
  { value: 'indoor', label: { zh: '室内 · 干燥', en: 'Indoor · dry' } },
  { value: 'wet', label: { zh: '潮湿（厨卫）', en: 'Wet (kitchen/bath)' }, hint: { zh: '需防霉等级与长期耐水', en: 'Needs mould rating & long-term water resistance' } },
  { value: 'outdoor', label: { zh: '户外 · 耐候', en: 'Outdoor · weathering' }, hint: { zh: '需抗 UV 与耐候老化', en: 'Needs UV & weather resistance' } },
  { value: 'submerged', label: { zh: '持续浸水', en: 'Continuously submerged' }, hint: { zh: '需可水下固化 / 长期泡水不失效', en: 'Needs underwater-cure / long soak stability' } },
  { value: 'hightemp', label: { zh: '高温', en: 'High temperature' }, hint: { zh: '需耐高温等级（>150℃）', en: 'Needs high-temp grade (>150℃)' } },
  { value: 'food', label: { zh: '食品接触', en: 'Food contact' }, hint: { zh: '需食品级认证', en: 'Needs food-grade certification' } },
];

export const MOVEMENTS: Option[] = [
  { value: 'static', label: { zh: '静态（刚性连接）', en: 'Static (rigid)' } },
  { value: 'low', label: { zh: '低位移', en: 'Low movement' } },
  { value: 'high', label: { zh: '高位移 / 伸缩缝', en: 'High movement / expansion joint' }, hint: { zh: '需高弹性与位移能力（±25% 以上）', en: 'Needs high elasticity & movement (±25%+)' } },
];

export const ADHESIVES: Adhesive[] = [
  {
    value: 'silicone-sealant',
    name: { zh: '硅酮密封胶', en: 'Silicone Sealant' },
    blurb: { zh: '弹性极佳、耐水耐候、防霉等级可选，是厨卫与伸缩缝的常青选择；但多数不可涂漆、粘接力中等。', en: 'Excellent elasticity, water & weather resistant, mould grades available — the go-to for wet joints & expansion. Mostly non-paintable with moderate adhesion.' },
    props: { zh: '高弹性 · 耐候 · 防霉可选 · 不可涂漆', en: 'High elasticity · weatherproof · mould-grade opt. · not paintable' },
    uses: { zh: '厨卫接缝、幕墙、伸缩缝、玻璃装配', en: 'Kitchen/bath joints, curtain walls, expansion joints, glazing' },
  },
  {
    value: 'polyurethane',
    name: { zh: '聚氨酯 (PU)', en: 'Polyurethane (PU)' },
    blurb: { zh: '强度高、耐磨、可涂漆，适合地坪/伸缩缝与结构粘结；对潮气敏感，施工需控湿。', en: 'High strength, abrasion-resistant, paintable — great for floors/joints/structural bond. Moisture-sensitive; control humidity.' },
    props: { zh: '高强度 · 可涂漆 · 耐磨 · 潮气固化', en: 'High strength · paintable · abrasion-resist · moisture-cure' },
    uses: { zh: '地坪伸缩缝、金属/木材结构粘结、防水涂层', en: 'Floor joints, metal/wood structural bond, waterproof coating' },
  },
  {
    value: 'epoxy',
    name: { zh: '环氧 (EP)', en: 'Epoxy (EP)' },
    blurb: { zh: '刚性极强、耐化学腐蚀、粘结金属/混凝土优异，适合结构修补与地坪；几乎无弹性、不耐 UV。', en: 'Very rigid, chemical-resistant, superb on metal/concrete — ideal for repair & flooring. Almost no elasticity, not UV-stable.' },
    props: { zh: '刚性 · 耐化学 · 高强度 · 不耐 UV', en: 'Rigid · chemical-resist · high strength · not UV-stable' },
    uses: { zh: '结构修补、地坪、金属/混凝土粘结', en: 'Structural repair, flooring, metal/concrete bond' },
  },
  {
    value: 'ms-polymer',
    name: { zh: 'MS 聚合物 (改性硅烷)', en: 'MS Polymer (hybrid)' },
    blurb: { zh: '硅酮与 PU 的优点结合：高弹性、可涂漆、低气味、低表面能基材也能粘，食品级可选；综合最均衡。', en: 'Best of silicone + PU: elastic, paintable, low odor, bonds low-energy substrates, food-grade opt. The most balanced choice.' },
    props: { zh: '高弹性 · 可涂漆 · 低气味 · 食品级可选', en: 'Elastic · paintable · low odor · food-grade opt.' },
    uses: { zh: '通用装配、车船、食品环境、难粘基材', en: 'General assembly, automotive/marine, food environments, tricky substrates' },
  },
];

// 各维度 → 胶型 亲和度加权（分值越高越优先）
export const SUBSTRATE_AFFINITY: Record<string, Record<string, number>> = {
  glass: { 'silicone-sealant': 3, 'ms-polymer': 2 },
  metal: { epoxy: 3, 'polyurethane': 2, 'ms-polymer': 2 },
  'tile-stone': { 'silicone-sealant': 3, 'ms-polymer': 2, 'polyurethane': 1 },
  wood: { 'polyurethane': 3, 'ms-polymer': 2, epoxy: 2 },
  plastic: { 'ms-polymer': 3, 'polyurethane': 2 },
  concrete: { 'polyurethane': 3, epoxy: 2, 'ms-polymer': 2 },
};
export const ENV_AFFINITY: Record<string, Record<string, number>> = {
  indoor: { epoxy: 1, 'ms-polymer': 1, 'silicone-sealant': 1, 'polyurethane': 1 },
  wet: { 'silicone-sealant': 3, 'ms-polymer': 2 },
  outdoor: { 'silicone-sealant': 3, 'polyurethane': 2, 'ms-polymer': 2 },
  submerged: { 'silicone-sealant': 3, 'polyurethane': 2 },
  hightemp: { 'silicone-sealant': 3, epoxy: 2 },
  food: { 'ms-polymer': 3, 'silicone-sealant': 2 },
};
export const MOVEMENT_AFFINITY: Record<string, Record<string, number>> = {
  static: { epoxy: 3, 'polyurethane': 2 },
  low: { 'ms-polymer': 2, 'polyurethane': 2, 'silicone-sealant': 1 },
  high: { 'silicone-sealant': 3, 'ms-polymer': 3, 'polyurethane': 2 },
};

const byValue = <T extends { value: string }>(arr: T[]) => {
  const m: Record<string, T> = {};
  for (const x of arr) m[x.value] = x;
  return m;
};
const SUB_MAP = byValue(SUBSTRATES);
const ENV_MAP = byValue(ENVIRONMENTS);
const MOV_MAP = byValue(MOVEMENTS);

export interface RankedAdhesive extends Adhesive {
  score: number;
}

/** 三维度加权评分，返回按得分降序、得分>0 的胶型列表（最多全部 4 种） */
export function recommend(substrate: string, env: string, movement: string): RankedAdhesive[] {
  const scores: Record<string, number> = {};
  const add = (aff: Record<string, Record<string, number>>, key: string) => {
    const m = aff[key];
    if (!m) return;
    for (const [a, p] of Object.entries(m)) scores[a] = (scores[a] || 0) + p;
  };
  add(SUBSTRATE_AFFINITY, substrate);
  add(ENV_AFFINITY, env);
  add(MOVEMENT_AFFINITY, movement);
  return ADHESIVES.map((a) => ({ ...a, score: scores[a.value] || 0 }))
    .filter((a) => a.score > 0)
    .sort((x, y) => y.score - x.score);
}

/** 结果解释：汇总所选维度里带「关键要求」提示的项 */
export function rationaleHints(substrate: string, env: string, movement: string): Bilingual[] {
  const out: Bilingual[] = [];
  for (const v of [SUB_MAP[substrate], ENV_MAP[env], MOV_MAP[movement]]) {
    if (v?.hint) out.push(v.hint);
  }
  return out;
}

export function optionLabel(dim: Option[], value: string): Bilingual | undefined {
  return dim.find((o) => o.value === value)?.label;
}
