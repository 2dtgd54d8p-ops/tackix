#!/usr/bin/env python3
# tackix 仓库推送助手（GitHub REST API contents）
# 用法: python3 push_tac.py <本地文件> [仓库内路径] [提交说明]
import sys, base64, json, os, urllib.request, urllib.error

TOKEN = os.environ.get("TACKIX_PAT") or os.environ.get("GH_TOKEN")
if not TOKEN:
    sys.exit("错误：未设置环境变量 TACKIX_PAT。请先 `export TACKIX_PAT=<你的 GitHub PAT>` 再运行本助手。")
OWNER = "2dtgd54d8p-ops"
REPO = "tackix"
BRANCH = "main"


def api(method, path, data=None):
    url = f"https://api.github.com{path}"
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "tackix-push/1.0",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


def push(local_path, repo_path=None, msg=None):
    repo_path = repo_path or local_path
    msg = msg or f"update {repo_path}"
    with open(local_path, "rb") as f:
        content = base64.b64encode(f.read()).decode()
    st, cur = api("GET", f"/repos/{OWNER}/{REPO}/contents/{repo_path}?ref={BRANCH}")
    sha = cur.get("sha") if st == 200 else None
    st2, res = api(
        "PUT",
        f"/repos/{OWNER}/{REPO}/contents/{repo_path}",
        {"message": msg, "content": content, "sha": sha, "branch": BRANCH},
    )
    print(st2, res.get("commit", {}).get("html_url") or res)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python3 push_tac.py <本地文件> [仓库内路径] [提交说明]")
        sys.exit(1)
    push(
        sys.argv[1],
        sys.argv[2] if len(sys.argv) > 2 else None,
        sys.argv[3] if len(sys.argv) > 3 else None,
    )