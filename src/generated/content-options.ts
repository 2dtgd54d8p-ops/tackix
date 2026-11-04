// ⚠️ 本文件由 scripts/gen-content-options.mjs 自动生成，请勿手动编辑。
// 数据来源（优先）：src/generated/content.json —— 构建期从 Cloudflare D1 拉取的内容快照，
//          即后台「分类管理 / 标签管理 / 场景方案」真正在改的数据；
//          兜底：仓库根 categories/index.yaml、tags/index.yaml、src/content/scenarios/*.yaml（历史词表）。
// 生成时机：postinstall / predev / prebuild，以及 dev 期间这些文件变化触发的重启。
// 作用：文章编辑器的「分类」「标签」「所属场景」下拉跟随后台数据，无需手改代码。
// 字段：label = 英文优先（通用显示）；labelZh = 中文优先（后台编辑器用）；value = 值。
export const CATEGORY_OPTIONS: ReadonlyArray<{ label: string; labelZh: string; value: string }> = [
  {
    "label": "Selection Guide",
    "labelZh": "选型指南",
    "value": "selection-guide"
  },
  {
    "label": "Application Pitfalls",
    "labelZh": "应用避坑",
    "value": "application-pitfalls"
  },
  {
    "label": "Troubleshooting",
    "labelZh": "故障排查",
    "value": "troubleshooting"
  }
];

export const TAG_OPTIONS: ReadonlyArray<{ label: string; labelZh: string; value: string }> = [
  {
    "label": "Silicone Sealant",
    "labelZh": "硅酮密封胶",
    "value": "silicone-sealant"
  },
  {
    "label": "Polyurethane",
    "labelZh": "聚氨酯",
    "value": "polyurethane"
  },
  {
    "label": "Epoxy",
    "labelZh": "环氧",
    "value": "epoxy"
  },
  {
    "label": "MS Polymer",
    "labelZh": "MS 聚合物",
    "value": "ms-polymer"
  },
  {
    "label": "Waterproofing",
    "labelZh": "防水",
    "value": "waterproofing"
  },
  {
    "label": "Mould Resistance",
    "labelZh": "防霉",
    "value": "mould-resistant"
  },
  {
    "label": "Tile & Stone",
    "labelZh": "瓷砖与石材",
    "value": "tile-stone"
  },
  {
    "label": "Expansion Joints",
    "labelZh": "伸缩缝",
    "value": "expansion-joints"
  },
  {
    "label": "Surface Prep",
    "labelZh": "表面处理",
    "value": "surface-prep"
  },
  {
    "label": "Substrate",
    "labelZh": "基材",
    "value": "substrate"
  },
  {
    "label": "Temperature",
    "labelZh": "温度",
    "value": "temperature"
  },
  {
    "label": "DIY",
    "labelZh": "DIY",
    "value": "diy"
  },
  {
    "label": "Professional",
    "labelZh": "专业",
    "value": "professional"
  }
];

export const SCENARIO_OPTIONS: ReadonlyArray<{ label: string; labelZh: string; value: string }> = [
  {
    "label": "Kitchen & Bath Mould Resistance",
    "labelZh": "厨卫防霉防漏",
    "value": "kitchen-bath-mould"
  },
  {
    "label": "Roof & Terrace Waterproofing",
    "labelZh": "屋顶与露台防水",
    "value": "roof-waterproof"
  },
  {
    "label": "Tile Grouting & Joints",
    "labelZh": "瓷砖填缝与美缝",
    "value": "tile-grout"
  },
  {
    "label": "Window & Door Leak Sealing",
    "labelZh": "门窗渗水密封",
    "value": "window-door-leak"
  }
];
