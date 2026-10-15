// ⚠️ 本文件由 scripts/gen-content-options.mjs 自动生成，请勿手动编辑。
// 数据来源：仓库根目录 categories/index.yaml（后台「分类管理」）、
//          tags/index.yaml（后台「标签管理」）；
//          src/content/scenarios/*.yaml（场景方案集合，提供「所属场景」下拉）。
// 生成时机：postinstall / predev / prebuild，以及 dev 期间这些文件变化触发的重启。
// 作用：文章编辑器的「分类」「标签」下拉与「所属场景」下拉跟随后台数据，无需手改代码。
export const CATEGORY_OPTIONS: ReadonlyArray<{ label: string; value: string }> = [
  {
    "label": "Selection Guide",
    "value": "selection-guide"
  },
  {
    "label": "Application Pitfalls",
    "value": "application-pitfalls"
  },
  {
    "label": "Troubleshooting",
    "value": "troubleshooting"
  }
];

export const TAG_OPTIONS: ReadonlyArray<{ label: string; value: string }> = [
  {
    "label": "Silicone Sealant",
    "value": "silicone-sealant"
  },
  {
    "label": "Polyurethane",
    "value": "polyurethane"
  },
  {
    "label": "Epoxy",
    "value": "epoxy"
  },
  {
    "label": "MS Polymer",
    "value": "ms-polymer"
  },
  {
    "label": "Waterproofing",
    "value": "waterproofing"
  },
  {
    "label": "Mould Resistance",
    "value": "mould-resistant"
  },
  {
    "label": "Tile & Stone",
    "value": "tile-stone"
  },
  {
    "label": "Expansion Joints",
    "value": "expansion-joints"
  },
  {
    "label": "Surface Prep",
    "value": "surface-prep"
  },
  {
    "label": "Substrate",
    "value": "substrate"
  },
  {
    "label": "Temperature",
    "value": "temperature"
  },
  {
    "label": "DIY",
    "value": "diy"
  },
  {
    "label": "Professional",
    "value": "professional"
  }
];

export const SCENARIO_OPTIONS: ReadonlyArray<{ label: string; value: string }> = [
  {
    "label": "Kitchen & Bath Mould Resistance",
    "value": "kitchen-bath-mould"
  },
  {
    "label": "Roof & Terrace Waterproofing",
    "value": "roof-waterproof"
  },
  {
    "label": "Tile Grouting & Joints",
    "value": "tile-grout"
  },
  {
    "label": "Window & Door Leak Sealing",
    "value": "window-door-leak"
  }
];
