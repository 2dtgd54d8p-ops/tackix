// 自动从 git 历史生成「内容变更日志」docs/content-changelog.md。
//
// 作用（L4② 运营保鲜）：
//   后台（Keystatic）每次保存都会往仓库提交一次 YAML 变更。本脚本把这些提交
//   聚合成一份按月分组、最新的在前的变更日志，运营一眼看清近期新增/修订了哪些内容，
//   配合「新鲜度徽章」做内容保鲜与更新节奏把控。
//
// 跟踪范围：src/content/（知识库文章 + 场景方案）。
// 用法：  node scripts/gen-changelog.mjs            # 写入 docs/content-changelog.md
//        node scripts/gen-changelog.mjs --stdout    # 仅打印到终端（CI 预览）
//        node scripts/gen-changelog.mjs --limit 30  # 只取最近 N 条提交
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEST = path.join(ROOT, 'docs/content-changelog.md');
// 只跟踪「知识库文章」与「场景方案」两个集合，排除历史遗留的 posts/ 噪音目录
const CONTENT_DIRS = ['src/content/knowledge', 'src/content/scenarios'];

const argv = process.argv.slice(2);
const STDOUT = argv.includes('--stdout');
const limitArg = argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) || Infinity : Infinity;

/**
 * 用 execFileSync + 参数数组，避免 shell 把 format 里的 `|` 当成管道。
 * 返回 git log 的纯文本（newest→oldest），失败返回 null。
 */
function gitLog() {
  try {
    return execFileSync(
      'git',
      ['log', '--date=short', '--pretty=format:%ad|%s', '--', ...CONTENT_DIRS],
      { cwd: ROOT, encoding: 'utf8' }
    ).trim();
  } catch (e) {
    return null;
  }
}

function slugFromSubject(subject) {
  // Keystatic GitHub App 的提交信息形如 "Update knowledge/<slug>" 或 "Update knowledge P12: …"
  // 尽量抽出可被内容团队识别的标识。
  const m = subject.match(/([A-Za-z0-9_.-]+\.yaml|knowledge\/\S+|scenarios\/\S+|\bP\d+\b)/);
  return m ? m[1] : '';
}

function main() {
  const raw = gitLog();
  if (raw === null) {
    const msg = '[changelog] 不在 git 仓库或 git 不可用，跳过。';
    if (STDOUT) console.log(msg);
    else console.warn(msg);
    return;
  }
  const lines = raw ? raw.split('\n') : []; // git log 默认 newest → oldest
  const groups = new Map(); // month -> [{date, subject, slug}]
  let total = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    const idx = line.indexOf('|');
    if (idx < 0) continue;
    const date = line.slice(0, idx);
    const subject = line.slice(idx + 1).trim();
    const slug = slugFromSubject(subject);
    const month = date.slice(0, 7);
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month).push({ date, subject, slug });
    total++;
    if (total >= LIMIT) break;
  }

  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

  const out = [];
  out.push('# 内容变更日志（自动生成）');
  out.push('');
  out.push(`> 由 \`scripts/gen-changelog.mjs\` 依据 \`git log\` 自动生成，跟踪 \`src/content/knowledge\` 与 \`src/content/scenarios\` 的提交。`);
  out.push(`> 生成时间：${stamp}　·　共 ${total} 条（最近 ${LIMIT === Infinity ? '全部' : LIMIT} 条）。`);
  out.push('');
  for (const [month, entries] of groups) {
    out.push(`## ${month}`);
    out.push('');
    for (const e of entries) {
      const ref = e.slug ? ` \`${e.slug}\`` : '';
      out.push(`- **${e.date}** — ${e.subject}${ref}`);
    }
    out.push('');
  }
  if (total === 0) {
    out.push('_暂无内容提交记录。_');
    out.push('');
  }

  const text = out.join('\n');
  if (STDOUT) {
    console.log(text);
    return;
  }
  fs.mkdirSync(path.dirname(DEST), { recursive: true });
  const prev = fs.existsSync(DEST) ? fs.readFileSync(DEST, 'utf8') : '';
  if (prev !== text) {
    fs.writeFileSync(DEST, text);
    console.log(
      `[changelog] 已更新 ${path.relative(ROOT, DEST)}（${total} 条，${groups.size} 个月份分组）`
    );
  } else {
    console.log(`[changelog] 无变化（${total} 条）`);
  }
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();

export { main };
