#!/usr/bin/env python3
"""
修正 Astro 页面的相对导入层级。

背景（本项目反复踩坑）：
  - `keystatic.config.ts` 在**项目根目录**；
  - `src/layouts/`、`src/lib/` 在**根下的 src/ 里**；
  - ⇒ 同一文件里两者的 `../` 层级永远相差 2。
    src/pages/ 下的页面手写层级极易算错，报错还只是
    "Could not resolve ... from ..."，逐个试错很慢。

做法：不手算，直接**实测**候选路径是否存在（自动补全 .ts/.astro 扩展名），
逐级从 1..6 试探，取第一个真实存在的层级并写回。
"""
import io
import os
import re
import sys

EXT_CANDIDATES = ('', '.ts', '.astro', '.tsx', '.js', '.mjs')

# 需要校验/修正的目标（相对 root 的模块名）
TARGETS = (
    'keystatic.config',
    'layouts/Base.astro',
    'lib/i18n-content',
    'lib/site-data',
    'lib/i18n',
)


def resolve_ok(from_dir: str, rel: str) -> bool:
    """rel 指向的目标（补全常见扩展名）是否真实存在"""
    base = os.path.normpath(os.path.join(from_dir, rel))
    return any(os.path.isfile(base + ext) for ext in EXT_CANDIDATES)


def fix_file(path: str) -> int:
    src = io.open(path, encoding='utf-8').read()
    orig = src
    d = os.path.dirname(path)

    for target in TARGETS:
        # 匹配 import 中该模块的任意层级写法
        pattern = r"from '((?:\.\./)+)?" + re.escape(target) + r"'"

        def repl(m, target=target):
            for n in range(1, 7):
                cand = '../' * n + target
                if resolve_ok(d, cand):
                    return "from '%s'" % cand
            # 找不到就保留原样，避免乱改
            return m.group(0)

        src = re.sub(pattern, repl, src)

    if src != orig:
        io.open(path, 'w', encoding='utf-8').write(src)
    return src.count('\n')


def verify(path: str) -> list[str]:
    """返回该文件中无法解析的相对导入列表（空 = 全部 OK）"""
    d = os.path.dirname(path)
    src = io.open(path, encoding='utf-8').read()
    bad = []
    for m in re.finditer(r"from '((?:\.\./)+[^']+)'", src):
        rel = m.group(1)
        if not resolve_ok(d, rel):
            bad.append(rel)
    return bad


def main():
    roots = sys.argv[1:] or ['src/pages']
    files = []
    for r in roots:
        for root, _dirs, names in os.walk(r):
            files += [os.path.join(root, n) for n in names if n.endswith('.astro')]
    files.sort()

    for p in files:
        fix_file(p)

    bad_map = {p: verify(p) for p in files}
    total = len(files)
    failed = {p: v for p, v in bad_map.items() if v}

    print('扫描 %d 个 .astro 文件' % total)
    if failed:
        print('仍有无法解析的导入：')
        for p, v in failed.items():
            print('  ✗ %s' % p)
            for rel in v:
                print('      %s' % rel)
        sys.exit(1)
    print('✓ 全部相对导入均可解析')


if __name__ == '__main__':
    main()
