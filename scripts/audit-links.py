import os, re

DIST = 'dist'

html_files = []
all_files = set()
for root, _, files in os.walk(DIST):
    for f in files:
        full = os.path.join(root, f)
        all_files.add(full)
        if f.endswith('.html'):
            html_files.append(full)

print(f"产出 HTML 页: {len(html_files)}")

def exists(url):
    url = url.split('#')[0].split('?')[0]
    if not url or url.startswith(('http', 'mailto:', 'tel:', 'wa.me', '#')):
        return True
    p = url.lstrip('/')
    base = os.path.join(DIST, p)
    return (os.path.exists(base)
            or os.path.exists(os.path.join(base, 'index.html'))
            or os.path.exists(base + '.html'))

dead = []
checked = 0
for hf in html_files:
    try:
        s = open(hf, encoding='utf-8', errors='ignore').read()
    except Exception:
        continue
    for href in re.findall(r'href="([^"]+)"', s):
        h = href.strip()
        if not h:
            continue
        if h.startswith(('http', 'mailto:', 'tel:', 'wa.me', '#', '//')):
            continue
        checked += 1
        if not exists(h):
            rel = os.path.relpath(hf, DIST)
            dead.append((rel, h))

print(f"检查内部链接: {checked} 处")
print(f"死链: {len(dead)} 处")
for src, link in sorted(set(dead)):
    print(f"  {src}  ->  {link}")

# 检测可疑空页（main 内容极少）
print("\n===== 可疑空/短页（main 文本 < 200 字）=====")
for hf in html_files:
    s = open(hf, encoding='utf-8', errors='ignore').read()
    m = re.search(r'<main[^>]*>(.*?)</main>', s, re.S)
    body = re.sub(r'<[^>]+>', '', m.group(1)) if m else re.sub(r'<[^>]+>', '', s)
    txt = re.sub(r'\s+', ' ', body).strip()
    if len(txt) < 200:
        rel = os.path.relpath(hf, DIST)
        print(f"  {rel:42s} 正文 {len(txt)} 字")
