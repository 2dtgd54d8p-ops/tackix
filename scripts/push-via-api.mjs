#!/usr/bin/env node
/**
 * push-via-api.mjs —— 当 `git push` 不可用（企业代理拦截 github.com，git 传输层挂死，
 * 但 api.github.com 仍可达）时，改用 GitHub Git Data API 推送本地提交。
 *
 * 背景：本项目所在网络经常出现 `CONNECT tunnel failed, response 502` 或 github.com 直连超时，
 * 而 REST API 走的是另一个域名，通常仍然可用。
 *
 * 用法：
 *   node scripts/push-via-api.mjs                 # 推到 main + 当前分支
 *   node scripts/push-via-api.mjs --branch-only   # 只推当前分支，不动 main
 *   node scripts/push-via-api.mjs --dry-run       # 只打印将推送哪些提交
 *
 * 工作方式：
 *   1. 读远端目标分支 head → 取其 tree；
 *   2. 在本地历史中找 tree 与之相同的提交作为“共同基点”（因为 API 造出来的提交本地没有对象，
 *      但 tree 是一致的，可据此对齐）；
 *   3. 从该基点往后的每个本地提交，逐个上传变更 blob → 建 tree → 建 commit；
 *   4. 最后把远端分支指针指到最新的新提交。
 *
 * 凭据：优先读环境变量 GITHUB_TOKEN / GH_TOKEN；否则从 macOS 钥匙串取（本项目习惯把 PAT
 *       放在 credential 的 username 字段里）。
 */
import { execSync } from 'node:child_process';

const REPO = process.env.GITHUB_REPO || '2dtgd54d8p-ops/tackix';
const DRY = process.argv.includes('--dry-run');
const BRANCH_ONLY = process.argv.includes('--branch-only');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const git = (args) => execSync(`git ${args}`, { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });

function readToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN.trim();
  // macOS 钥匙串：本项目把 PAT 存在 username 字段
  try {
    const out = execSync("printf 'protocol=https\\nhost=github.com\\n\\n' | git credential-osxkeychain get", {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const m = out.match(/^username=(.*)$/m);
    if (m && m[1]) return m[1].trim();
    const p = out.match(/^password=(.*)$/m);
    if (p && p[1]) return p[1].trim();
  } catch {}
  throw new Error('找不到 GitHub 凭据：请设置 GITHUB_TOKEN 环境变量');
}

const TOKEN = readToken();
const H = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'tackix-push-via-api',
  'content-type': 'application/json',
};

async function api(path, method = 'GET', body, tries = 6) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
        method,
        headers: H,
        body: body ? JSON.stringify(body) : undefined,
      });
      const txt = await r.text();
      let j;
      try { j = JSON.parse(txt); } catch { j = { raw: txt }; }
      if (!r.ok) {
        const err = new Error(`${method} ${path} → HTTP ${r.status}: ${txt.slice(0, 400)}`);
        err.http = r.status;
        throw err;
      }
      return j;
    } catch (e) {
      lastErr = e;
      if (e.http) throw e; // 业务错误不重试
      if (i === tries) break;
      console.log(`  (网络抖动，重试 ${i}/${tries})`);
      await sleep(3000 * i);
    }
  }
  throw lastErr;
}

async function remoteHead(branch) {
  try {
    const r = await api(`/git/ref/heads/${branch}`);
    return r.object.sha;
  } catch (e) {
    if (e.http === 404) return null;
    throw e;
  }
}

/** 找本地 tree === 远端 head tree 的提交，作为推送基点 */
function findLocalBase(remoteTree) {
  const shas = git('rev-list HEAD -n 300').trim().split('\n');
  for (const s of shas) {
    const t = git(`rev-parse ${s}^{tree}`).trim();
    if (t === remoteTree) return s;
  }
  return null;
}

async function pushBranch(branch) {
  const head = await remoteHead(branch);
  if (!head) {
    console.log(`✗ 远端分支 ${branch} 不存在，请先用网页或首次 push 创建`);
    return null;
  }
  const headCommit = await api(`/git/commits/${head}`);
  const base = findLocalBase(headCommit.tree.sha);

  if (!base) {
    console.log(`✗ 在本地历史中找不到与远端 ${branch} tree (${headCommit.tree.sha.slice(0, 10)}) 一致的提交`);
    console.log('  → 说明远端有你本地没有的提交，请先同步（或换用能 git fetch 的网络）');
    return null;
  }

  const commits = git(`rev-list --reverse ${base}..HEAD`).trim().split('\n').filter(Boolean);
  if (!commits.length) {
    console.log(`✓ ${branch} 已是最新（基点 ${base.slice(0, 7)}），无需推送`);
    return head;
  }
  console.log(`${branch}: 基点 ${base.slice(0, 7)}，待推 ${commits.length} 个提交`);
  if (DRY) {
    commits.forEach((c) => console.log('  - ' + git(`log -1 --pretty=%s ${c}`).trim()));
    return head;
  }

  let parent = head;
  let baseTree = headCommit.tree.sha;

  for (const sha of commits) {
    const message = git(`log -1 --pretty=%B ${sha}`);
    const name = git(`log -1 --pretty=%an ${sha}`).trim();
    const email = git(`log -1 --pretty=%ae ${sha}`).trim();
    const date = git(`log -1 --pretty=%aI ${sha}`).trim();

    const diff = git(`diff-tree --no-commit-id --name-status -r ${sha}`).trim().split('\n').filter(Boolean);
    const entries = [];
    for (const line of diff) {
      const [status, ...rest] = line.split('\t');
      if (status === 'D') {
        entries.push({ path: rest[0], mode: '100644', type: 'blob', sha: null });
        continue;
      }
      const p = rest[rest.length - 1];
      const content = execSync(`git show ${sha}:${p}`, { maxBuffer: 128 * 1024 * 1024 });
      const blob = await api('/git/blobs', 'POST', { content: content.toString('base64'), encoding: 'base64' });
      entries.push({ path: p, mode: '100644', type: 'blob', sha: blob.sha });
    }

    const tree = await api('/git/trees', 'POST', { base_tree: baseTree, tree: entries });
    const commit = await api('/git/commits', 'POST', {
      message,
      tree: tree.sha,
      parents: [parent],
      author: { name, email, date },
      committer: { name, email, date },
    });
    console.log(`  ✓ ${sha.slice(0, 7)} → ${commit.sha.slice(0, 7)}  (${entries.map((e) => e.path).join(', ')})`);
    parent = commit.sha;
    baseTree = tree.sha;
  }

  await api(`/git/refs/heads/${branch}`, 'PATCH', { sha: parent, force: true });
  console.log(`✓ ${branch} → ${parent.slice(0, 7)}`);
  return parent;
}

async function main() {
  // 先推当前分支，再推 main
  let branch = '';
  try { branch = git('branch --show-current').trim(); } catch {}
  if (!branch) throw new Error('当前处于 detached HEAD，请先切到分支');

  const pushed = await pushBranch(branch);

  if (!BRANCH_ONLY && branch !== 'main' && pushed && !DRY) {
    // main 快进：远端 main 是新提交祖先时 GitHub 才会接受，否则返回 422 —— 交给 API 判定，不本地猜
    try {
      await api('/git/refs/heads/main', 'PATCH', { sha: pushed });
      console.log(`✓ main → ${pushed.slice(0, 7)}`);
    } catch (e) {
      if (e.http === 422) console.log('⚠ main 不能快进到该提交（与远端 main 有分叉），已跳过；请先合并再推');
      else throw e;
    }
  }
}

main().catch((e) => {
  console.error('✗ ' + e.message);
  process.exit(1);
});
