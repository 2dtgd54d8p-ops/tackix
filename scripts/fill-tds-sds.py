#!/usr/bin/env python3
"""
批量给每个产品 YAML 写入 tds / sds 文件名（与 scripts/gen-placeholder-pdfs.py 产出的
PDF 一一对应）。幂等：已写入则跳过。

用法：python3 scripts/fill-tds-sds.py
"""
import glob
import os
import re

BASE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "content", "products")


def main():
    for path in sorted(glob.glob(os.path.join(BASE, "*.yaml"))):
        slug = os.path.splitext(os.path.basename(path))[0]
        tds = f"tackix-tds-{slug}.pdf"
        sds = f"tackix-sds-{slug}.pdf"
        with open(path, encoding="utf-8") as f:
            s = f.read()
        if f"tds: '{tds}'" in s:
            print("skip   ", slug)
            continue
        m = re.search(r"(cover: '[^']*')", s)
        if not m:
            print("NO cover line:", slug)
            continue
        ins = m.group(1) + f"\ntds: '{tds}'\nsds: '{sds}'"
        s = s[: m.start()] + ins + s[m.end():]
        with open(path, "w", encoding="utf-8") as f:
            f.write(s)
        print("updated", slug)


if __name__ == "__main__":
    main()
