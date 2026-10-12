#!/usr/bin/env python3
"""
生成产品占位图（P0-1）
------------------------
10 款产品目前 0 张图，B2B 买家无图不会发询盘。这里按**化学体系**配色生成
信息型 SVG：每张含产品名、型号、化学体系带、3 项关键参数（耐温 / 间隙 / 固化）。

设计取舍：
- 用 SVG 而非生成式图片 —— 参数文字必须**准确**。AI 图像模型画化学式和
  参数数字几乎必然出现乱码/错数，对技术资料是硬伤。
- 参数文字用 `<text>` 真实渲染，可被搜索引擎读入 alt/OCR，也便于后续
  人工替换成实拍图（只需在 YAML 改 cover 指向，版式不用动）。
- 每体系一组主色，列表页并排时能一眼区分（环氧深琥珀 / UV 紫罗兰…）。

用法：python3 scripts/gen-product-images.py
输出：public/uploads/product-<slug>.svg
"""
import io
import os
import textwrap

OUT = os.path.join('public', 'uploads')

W, H = 800, 600

# ── 化学体系配色（主色 / 渐变辅色 / 深底）────────────────────────────────
PALETTE = {
    'epoxy':         ('#B45309', '#F59E0B', '#1C1917', 'Epoxy'),
    'polyurethane':   ('#92400E', '#D97706', '#1C1917', 'Polyurethane'),
    'silicone':      ('#64748B', '#CBD5E1', '#0F172A', 'Silicone'),
    'uv':            ('#6D28D9', '#A78BFA', '#17102B', 'UV-Curable'),
    'cyanoacrylate': ('#0E7490', '#22D3EE', '#082F3B', 'Instant'),
    'anaerobic':     ('#1E40AF', '#3B82F6', '#0B1220', 'Anaerobic'),
    'acrylic':       ('#3730A3', '#6366F1', '#12102B', 'Acrylic'),
    'hotmelt':       ('#C2410C', '#FB923C', '#23150B', 'Hot Melt'),
    'medical':       ('#0F766E', '#2DD4BF', '#07211F', 'Medical'),
    'thermal':       ('#9A3412', '#F97316', '#241009', 'Thermal'),
}

# slug → (中文名, 英文名, 型号, category, tempRange, displacement, cure)
PRODUCTS = {
    'epoxy-structural-8800': (
        '双组分环氧结构胶', 'Epoxy Structural Adhesive', 'ABRO-8800', 'epoxy',
        '-40~120℃', '0.1–5 mm', '双组分'),
    'epoxy-thermal-550': (
        '导热环氧灌封胶', 'Thermal Epoxy Potting', 'TAC-EP-550', 'thermal',
        '-40~150℃', '0.2–6 mm', '双组分'),
    'pu-structural-2200': (
        '双组分聚氨酯结构胶', 'PU Structural Adhesive', 'TAC-PU-2200', 'polyurethane',
        '-50~100℃', '0.2–8 mm', '双组分'),
    'ms-silicone-903': (
        '中性硅酮密封胶', 'Neutral Silicone Sealant', 'TAC-MS-903', 'silicone',
        '-60~150℃', '±25%', '湿气'),
    'uv-bond-3200': (
        '紫外光固化胶', 'UV-Curable Adhesive', 'TAC-UV-3200', 'uv',
        '-20~120℃', '0.05–0.5 mm', 'UV'),
    'uv-medical-3600': (
        '医疗级 UV 固化胶', 'Medical UV Adhesive', 'TAC-UV-3600', 'medical',
        '-20~120℃', '0.05–0.5 mm', 'UV'),
    'aa-instant-510': (
        '丙烯酸酯瞬干胶', 'Cyanoacrylate Instant Adhesive', 'TAC-AA-510', 'cyanoacrylate',
        '-40~80℃', '0.05–0.3 mm', '常温'),
    'anerobic-610': (
        '厌氧螺纹锁固胶', 'Anaerobic Threadlocker', 'TAC-CR-610', 'anaerobic',
        '-55~200℃', 'M2–M64', '常温'),
    'acrylic-700': (
        '丙烯酸酯结构胶', 'Acrylic Structural Adhesive', 'TAC-AL-700', 'acrylic',
        '-40~100℃', '0.1–3 mm', '常温'),
    'hotmelt-150': (
        '热熔胶棒', 'Hot Melt Glue Stick', 'TAC-HM-150', 'hotmelt',
        '-20~80℃', '0.05–1 mm', '热熔'),
}


def esc(t: str) -> str:
    return (t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))


def wrap_cjk(text: str, width: int) -> list[str]:
    """按字符数粗折行（中文按字数，英文按空格）"""
    if ' ' in text and all(ord(c) < 128 for c in text):
        return textwrap.wrap(text, width) or [text]
    return [text[i:i + width] for i in range(0, len(text), width)] or ['']


def build(slug, cn, en, model, cat, temp, gap, cure) -> str:
    main, accent, dark, fam = PALETTE[cat]
    gid = f'g-{slug}'

    # 参数条：三列
    cols = [('耐温范围', temp), ('间隙 / 涂布', gap), ('固化方式', cure)]
    colw = 210
    x0 = 60
    parts = []

    for i, (label, value) in enumerate(cols):
        cx = x0 + i * (colw + 30)
        parts.append(f'''
    <g transform="translate({cx},452)">
      <rect x="0" y="0" width="{colw}" height="76" rx="10" fill="#FFFFFF" fill-opacity="0.10" stroke="#FFFFFF" stroke-opacity="0.22"/>
      <text x="16" y="27" font-size="15" fill="#FFFFFF" fill-opacity="0.70" class="lbl">{esc(label)}</text>
      <text x="16" y="57" font-size="23" font-weight="600" fill="#FFFFFF" class="lbl">{esc(value)}</text>
    </g>''')

    # 中文名折行（最多 2 行）
    cn_lines = wrap_cjk(cn, 11)[:2]
    cn_svg = '\n'.join(
        f'    <text x="60" y="{196 + i * 52}" font-size="42" font-weight="700" fill="#FFFFFF" class="cn">{esc(l)}</text>'
        for i, l in enumerate(cn_lines))
    en_y = 196 + len(cn_lines) * 52 + 16

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="{esc(cn)} {esc(model)} 产品占位图">
  <title>{esc(cn)}（{esc(model)}）产品图</title>
  <defs>
    <linearGradient id="{gid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{dark}"/>
      <stop offset="55%" stop-color="{main}"/>
      <stop offset="100%" stop-color="{accent}"/>
    </linearGradient>
    <pattern id="dots-{gid}" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.5" fill="#FFFFFF" fill-opacity="0.07"/>
    </pattern>
  </defs>

  <style>
    .cn {{ font-family: "PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif; }}
    .en {{ font-family: "SF Pro Text","Helvetica Neue",Arial,sans-serif; }}
    .mono {{ font-family: "SF Mono","JetBrains Mono",Menlo,monospace; }}
    .lbl {{ font-family: "PingFang SC","Noto Sans SC",sans-serif; }}
  </style>
  <rect width="{W}" height="{H}" fill="url(#{gid})"/>
  <rect width="{W}" height="{H}" fill="url(#dots-{gid})"/>

  <!-- 化学体系色带：顶部实色条 + 左下角体系标签 -->
  <rect x="0" y="0" width="{W}" height="10" fill="{accent}"/>

  <!-- 胶层意象：底部交叠的半透明圆，代表胶体铺展 -->
  <g opacity="0.11">
    <circle cx="690" cy="150" r="96" fill="#FFFFFF"/>
    <circle cx="742" cy="196" r="72" fill="#FFFFFF"/>
    <circle cx="672" cy="212" r="58" fill="#FFFFFF"/>
  </g>

  <!-- 右上角型号牌 -->
  <g>
    <rect x="{W - 214}" y="42" width="164" height="42" rx="21" fill="#000000" fill-opacity="0.26" stroke="#FFFFFF" stroke-opacity="0.30"/>
    <text x="{W - 132}" y="70" font-size="20" font-weight="600" fill="#FFFFFF" text-anchor="middle" class="mono">{esc(model)}</text>
  </g>

{cn_svg}
  <text x="60" y="{en_y}" font-size="19" fill="#FFFFFF" fill-opacity="0.86" class="en" letter-spacing="0.6">{esc(en)}</text>

  <!-- 体系标签 -->
  <g transform="translate(60, 356)">
    <rect x="0" y="0" width="172" height="34" rx="17" fill="#FFFFFF" fill-opacity="0.16" stroke="#FFFFFF" stroke-opacity="0.30"/>
    <text x="86" y="23" font-size="15" font-weight="600" fill="#FFFFFF" text-anchor="middle" letter-spacing="1.1" font-family="'SF Pro Text','Helvetica Neue',Arial,sans-serif">{esc(fam.upper())}</text>
  </g>
  <text x="60" y="418" font-size="14" fill="#FFFFFF" fill-opacity="0.55" class="en">产品图为示意图· 实际规格以 TDS 为准</text>
{''.join(parts)}

  <!-- 页脚品牌 -->
  <text x="{W - 60}" y="{H - 26}" font-size="16" font-weight="600" fill="#FFFFFF" fill-opacity="0.62" text-anchor="end" class="en">Tackix</text>
</svg>
'''


def main():
    os.makedirs(OUT, exist_ok=True)
    for slug, args in PRODUCTS.items():
        path = os.path.join(OUT, f'product-{slug}.svg')
        io.open(path, 'w', encoding='utf-8').write(build(slug, *args))
        print(f'  ✓ {os.path.basename(path)}  ({args[0]})')
    print(f'\n共生成 {len(PRODUCTS)} 张 → {OUT}/')
    print('下一步：把这 10 个文件名写入各产品 YAML 的 cover 字段')


if __name__ == '__main__':
    main()