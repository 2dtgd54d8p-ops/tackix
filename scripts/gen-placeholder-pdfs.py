#!/usr/bin/env python3
"""
生成 10 个产品的「占位」TDS / SDS PDF（共 20 个），用于预上线期让中英文产品页的
下载区正常显示，待真实文档就绪后直接替换 public/uploads/ 下同名文件即可。

设计原则：
- 内容为英文（B2B 国际买家场景，且避免 CJK 字体依赖），但清楚标注 DRAFT / PLACEHOLDER，
  任何人看到都不会误以为是正式文档。
- 结构按真实 TDS / 16 节 SDS 模板排版，便于后续用真实数据填充。
- 命名：public/uploads/tackix-tds-<slug>.pdf / tackix-sds-<slug>.pdf，与产品 slug 一一对应。

用法：
  python3 scripts/gen-placeholder-pdfs.py            # 生成全部
  python3 scripts/gen-placeholder-pdfs.py aa-instant-510   # 仅生成指定 slug
"""
import os
import sys
from fpdf import FPDF
from fpdf.enums import XPos, YPos

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "uploads")

# slug -> (model, 英文品类描述)
PRODUCTS = [
    ("aa-instant-510",      "TAC-AA-510",   "Cyanoacrylate Instant Adhesive"),
    ("acrylic-700",         "TAC-AL-700",   "Acrylic Adhesive (No-Primer)"),
    ("anerobic-610",        "TAC-CR-610",   "Anaerobic Threadlocker"),
    ("epoxy-thermal-550",   "TAC-EP-550",   "Thermally Conductive Epoxy Potting Compound"),
    ("hotmelt-150",         "TAC-HM-150",   "Hot Melt Adhesive Stick"),
    ("ms-silicone-903",     "TAC-MS-903",   "Neutral Silicone Sealant"),
    ("pu-structural-2200",  "TAC-PU-2200",  "Two-Component Polyurethane Structural Adhesive"),
    ("uv-bond-3200",        "TAC-UV3200",   "UV Curing Adhesive"),
    ("uv-medical-3600",     "TAC-UV-3600",  "Medical-Grade UV Curing Adhesive"),
    ("epoxy-structural-8800", "ABRO-8800", "Two-Component Epoxy Structural Adhesive"),
]

DARK = (31, 41, 55)
ACCENT = (58, 123, 255)
BANNER_BG = (255, 244, 224)
BANNER_FG = (153, 92, 0)
GREY = (90, 90, 90)
LINE = (210, 214, 222)


class Doc(FPDF):
    def __init__(self, doc_type, model, desc):
        super().__init__(format="A4")
        self.doc_type = doc_type        # "TDS" / "SDS"
        self.model = model
        self.desc = desc
        self.set_auto_page_break(auto=True, margin=18)
        self.set_margins(18, 16, 18)
        self.add_page()

    def header(self):
        if self.page_no() == 1:
            return  # 首页用自定义封面，不画通用页眉
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*GREY)
        self.cell(0, 6, f"TACKIX  ·  {self.doc_type}  ·  {self.model}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_draw_color(*LINE)
        self.line(18, 22, 192, 22)
        self.ln(4)

    def footer(self):
        self.set_y(-14)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*GREY)
        self.cell(0, 6, "Tackix Materials  ·  Confidential  ·  DRAFT / PLACEHOLDER", align="L")
        self.cell(0, 6, f"Page {self.page_no()}", align="R")

    # ---- helpers ----
    def h1(self, text):
        self.ln(2)
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(*DARK)
        self.multi_cell(0, 7, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_draw_color(*ACCENT)
        self.set_line_width(0.5)
        self.line(18, self.get_y(), 70, self.get_y())
        self.ln(3)

    def para(self, text):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(60, 60, 60)
        self.multi_cell(0, 5.4, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(1.5)

    def banner(self):
        self.set_fill_color(*BANNER_BG)
        h = 13
        y0 = self.get_y()
        self.rect(18, y0, 174, h, "F")
        self.set_xy(20, y0 + 1.5)
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(*BANNER_FG)
        self.cell(0, 4.5, "DRAFT / PLACEHOLDER DOCUMENT", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_x(20)
        self.set_font("Helvetica", "", 8.5)
        self.multi_cell(170, 4.2,
                        "Template only. Replace with the official, approved "
                        f"{self.doc_type} before publication. Do not distribute to customers.",
                        new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_y(y0 + h + 3)

    def cover(self):
        self.set_font("Helvetica", "B", 22)
        self.set_text_color(*ACCENT)
        self.cell(0, 10, "TACKIX", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(2)
        self.set_font("Helvetica", "B", 15)
        self.set_text_color(*DARK)
        self.cell(0, 8, f"{self.doc_type} - Technical {'Data Sheet' if self.doc_type=='TDS' else 'Safety Data Sheet'}",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(1)
        self.set_font("Helvetica", "", 11)
        self.set_text_color(*GREY)
        self.cell(0, 6, f"Model: {self.model}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.cell(0, 6, f"Product family: {self.desc}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(3)
        self.banner()


def build_tds(model, desc):
    d = Doc("TDS", model, desc)
    d.cover()
    d.h1("1. Product Description")
    d.para(f"{model} is a {desc.lower()} developed for industrial bonding and sealing "
           "applications. [Insert a 2-4 sentence description of chemistry, key benefits, and "
           "typical use cases here.]")
    d.h1("2. Typical Properties")
    rows = [
        ("Appearance", "________________________"),
        ("Base chemistry", desc),
        ("Viscosity", "________ mPa·s"),
        ("Mix ratio (if 2K)", "________ : ________"),
        ("Cure condition", "________ / ________ min"),
        ("Tensile / lap-shear", "________ MPa"),
        ("Elongation", "________ %"),
        ("Operating temperature", "________ to ________ °C"),
        ("Hardness (Shore)", "________"),
        ("Shelf life", "________ months @ 25 °C"),
    ]
    d.set_font("Helvetica", "", 10)
    for k, v in rows:
        d.set_text_color(*DARK)
        d.set_font("Helvetica", "B", 10)
        d.cell(55, 6, f"  {k}", new_x=XPos.RIGHT, new_y=YPos.TOP)
        d.set_font("Helvetica", "", 10)
        d.set_text_color(60, 60, 60)
        d.cell(0, 6, v, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    d.ln(2)
    d.h1("3. Application Guidelines")
    d.para("[Insert surface preparation, dispensing, cure profile, and assembly instructions.]")
    d.h1("4. Storage & Shelf Life")
    d.para("[Insert storage temperature, humidity, and shelf-life conditions.]")
    d.h1("5. Notes & Disclaimer")
    d.para("Values shown above are placeholders. Actual data must be verified by the "
           "manufacturer's quality department prior to release. This document is provided "
           "for template purposes only.")
    return d


def build_sds(model, desc):
    d = Doc("SDS", model, desc)
    d.cover()
    sections = [
        ("1. Product and Company Identification",
         f"Product name: {model}. Product family: {desc}. Recommended use: industrial adhesive / sealant. "
         "[Insert manufacturer and emergency contact details.]"),
        ("2. Hazards Identification",
         "[Insert GHS classification, pictograms, signal word, and hazard statements.]"),
        ("3. Composition / Information on Ingredients",
         "[Insert CAS numbers and concentration ranges of hazardous components.]"),
        ("4. First Aid Measures",
         "[Insert inhalation / skin / eye / ingestion first-aid instructions.]"),
        ("5. Fire-Fighting Measures",
         "[Insert suitable extinguishing media and protective equipment for firefighters.]"),
        ("6. Accidental Release Measures",
         "[Insert containment and cleanup procedures.]"),
        ("7. Handling and Storage",
         "[Insert handling precautions and storage conditions.]"),
        ("8. Exposure Controls / Personal Protection",
         "[Insert occupational exposure limits and PPE requirements.]"),
        ("9. Physical and Chemical Properties",
         "[Insert appearance, odour, pH, density, flash point, etc.]"),
        ("10. Stability and Reactivity",
         "[Insert stability and incompatible materials.]"),
        ("11. Toxicological Information",
         "[Insert health effects and toxicity data.]"),
        ("12. Ecological Information",
         "[Insert environmental fate and ecotoxicity.]"),
        ("13. Disposal Considerations",
         "[Insert waste disposal guidance per local regulation.]"),
        ("14. Transport Information",
         "[Insert UN number, shipping class, and packing group if applicable.]"),
        ("15. Regulatory Information",
         "[Insert regulatory listings (REACH, RoHS, etc.).]"),
        ("16. Other Information",
         "[Insert revision date, reference standards, and disclaimer.]"),
    ]
    for title, body in sections:
        d.h1(title)
        d.para(body)
    return d


def main():
    wanted = set(sys.argv[1:])
    os.makedirs(OUT_DIR, exist_ok=True)
    count = 0
    for slug, model, desc in PRODUCTS:
        if wanted and slug not in wanted:
            continue
        for doc_type, builder in (("TDS", build_tds), ("SDS", build_sds)):
            out = os.path.join(OUT_DIR, f"tackix-{doc_type.lower()}-{slug}.pdf")
            builder(model, desc).output(out)
            print("written", os.path.relpath(out, ROOT))
            count += 1
    print(f"\nDone: {count} PDF(s) in {os.path.relpath(OUT_DIR, ROOT)}")


if __name__ == "__main__":
    main()
