#!/usr/bin/env python3
"""检查 _headers 中「全站 /* 块」的 X-Robots-Tag 是否处于生效状态。"""
import io
import sys

path = sys.argv[1] if len(sys.argv) > 1 else 'public/_headers'
lines = io.open(path, encoding='utf-8').read().split('\n')

start = next((i for i, l in enumerate(lines) if l.strip() == '/*'), -1)
if start < 0:
    print('NO_BLOCK'); sys.exit(0)

end = len(lines)
for i in range(start + 1, len(lines)):
    t = lines[i].strip()
    if t and not t.startswith('#') and not t.startswith(' ') and '/' in t:
        end = i; break

block = lines[start + 1:end]
hits = [l for l in block if 'X-Robots-Tag' in l]
if not hits:
    print('ABSENT')
elif all(l.strip().startswith('#') for l in hits):
    print('OFF (已注释)')
else:
    print('ON (生效中)')