#!/usr/bin/env node
/**
 * 预上线闸门 · 上线切换脚本
 * ---------------------------------------------------------------
 * 用途：正式上线时，把三处「封锁」一次性切到「放行」——
 *   ① public/robots.txt   解除 Disallow: /、恢复 Sitemap 提交
 *   ② public/_headers     移除全站 X-Robots-Tag（保留后台/API 的 noindex）
 *   ③ （meta 与横幅由 PUBLIC_PRELAUNCH 环境变量控制，本脚本会提示）
 *
 * 用法：
 *   node scripts/launch.js          # 切到「正式上线」状态
 *   node scripts/launch.js --revert # 切回「预上线」状态
 *
 * 幂等：可重复执行，已处于目标状态时不做改动。
 * 反悔成本低——切错了再跑一次 --revert 即可。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ⚠️ 本项目 package.json 是 {"type":"module"}，必须用 ESM import，不能用 require
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.resolve(__dirname, '..');
const ROBOTS = path.join(ROOT, 'public', 'robots.txt');
const HEADERS = path.join(ROOT, 'public', '_headers');

const revert = process.argv.includes('--revert');
const mode = revert ? '预上线（停止收录）' : '正式上线（允许收录）';

const ONLINE_BLOCK = `User-agent: *
Allow: /
Disallow: /keystatic
Disallow: /api/keystatic

# AI 检索体（GPTBot / PerplexityBot / Google-Extended）显式放行，
# 提升站点在 AI 答案中的可见度
User-agent: GPTBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

Sitemap: https://tackix.pages.dev/sitemap.xml
`;

const OFFLINE_BLOCK = `User-agent: *
Disallow: /
`;

function toggleRobots() {
  const src = fs.readFileSync(ROBOTS, 'utf8');
  const lines = src.split('\n');

  // 有效行 = 非注释、非空
  const eff = lines.filter((l) => l.trim() && !l.trimStart().startsWith('#'));
  // 判据：出现 `Disallow: /`（精确等于根路径）即为封锁态
  const isBlocked = eff.some((l) => l.trim() === 'Disallow: /');
  const wantOnline = !revert;

  if (isBlocked === !wantOnline) {
    console.log('  robots.txt   已是目标状态，跳过');
    return;
  }

  if (wantOnline) {
    // 封锁 → 放行：用完整放行配置替换所有有效行，保留顶部说明注释
    const head = lines.filter((l) => l.trimStart().startsWith('#')).join('\n');
    const next =
      '# robots.txt —— Tackix\n' +
      '# 正式上线状态：允许搜索引擎与 AI 检索体抓取。\n\n' +
      ONLINE_BLOCK.trimEnd() + '\n';
    fs.writeFileSync(ROBOTS, next);
    console.log('  ✓ robots.txt  → 允许抓取 + 提交 Sitemap');
  } else {
    // 放行 → 封锁：生效行收敛为一条 Disallow: /，原放行内容以注释保留备查
    const backup = eff.join('\n');
    const next =
      '# robots.txt —— Tackix\n' +
      '# 预上线状态：全面禁止抓取。\n' +
      '# 理由：noindex 需爬虫先抓到页面才生效，故在 robots 层先拦一道。\n' +
      '# 上线时把 PUBLIC_PRELAUNCH 设为 0，并取消下方注释即可恢复。\n\n' +
      OFFLINE_BLOCK.trimEnd() + '\n\n' +
      '# ── 以下为正式上线时的放行配置 ──\n' +
      backup.split('\n').map((l) => '# ' + l).join('\n') + '\n';
    fs.writeFileSync(ROBOTS, next);
    console.log('  ✓ robots.txt  → Disallow: / （放行配置已注释备查）');
  }
}

/**
 * 全站 noindex 开关。
 *
 * 不依赖锚点标记 —— Cloudflare _headers 是「路径块」语法，按行号猜块边界极易
 * 误删 /keystatic、/admin、/api 的 noindex。改为定位「第一个 /* 块」并判断
 * 其中 X-Robots-Tag 行**是否被注释**：
 *   · 未注释（生效中）→ 注释掉
 *   · 已注释（已停用）→ 取消注释
 * 这样即便有人手工调整过文件也不会误判，切换可反复执行。
 */
const GLOBAL_NOINDEX = 'X-Robots-Tag: noindex, nofollow, noarchive';

function toggleHeaders() {
  const src = fs.readFileSync(HEADERS, 'utf8');
  const lines = src.split('\n');

  // 全站块 = 第一个路径恰为 `/*` 的块
  const start = lines.findIndex((l) => l.trim() === '/*');
  if (start < 0) {
    console.log('  _headers     未找到 /* 全站块，跳过');
    return;
  }
  // 块结束 = 下一个顶格且形如「路径」的行
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t && !t.startsWith('#') && !t.startsWith(' ') && t.includes('/')) {
      end = i;
      break;
    }
  }

  const idx = lines.findIndex((l, i) => i > start && i < end && l.includes(GLOBAL_NOINDEX));
  if (idx < 0) {
    console.log('  _headers     全站块内未找到 X-Robots-Tag，跳过');
    return;
  }

  const isCommented = lines[idx].trimStart().startsWith('#');
  const wantOn = !!revert;

  // isCommented === true  →  当前为「停用」（上线态）
  // isCommented === false →  当前为「生效」（预上线态）
  // wantOn    === true    →  目标为「生效」（预上线态）
  if (isCommented === !wantOn) {
    console.log('  _headers     已是目标状态，跳过');
    return;
  }

  if (wantOn) {
    // 停用 → 启用：去掉行首注释符与其后**所有**空白
    // （需 \s* 而非 \s? —— 人手注释过可能留多个空格）
    lines[idx] = lines[idx].replace(/^(\s*)#\s*/, '$1');
  } else {
    // 启用 → 停用：整行注释掉（内容保留，随时可还原）
    lines[idx] = lines[idx].replace(/^(\s*)/, '$1# ');
  }
  fs.writeFileSync(HEADERS, lines.join('\n'));
  console.log(
    `  ✓ _headers    → 全站 X-Robots-Tag 已${wantOn ? '启用' : '停用'}（后台 /keystatic /admin /api 的 noindex 不受影响）`
  );
}

console.log(`\n切换到：${mode}\n`);
toggleRobots();
toggleHeaders();

console.log(`
完成。还需一步（环境变量，控制 meta 与横幅）：

  Cloudflare Pages → Settings → Environment variables
  ${revert ? '  · 设 PUBLIC_PRELAUNCH=1（或删除该变量）' : '  · 设 PUBLIC_PRELAUNCH=0'}
  ${revert ? '  · 设 CONTACT_OPEN=0' : '  · 设 CONTACT_OPEN=1'}

然后等 CI 部署完成（约 1–2 分钟）即可生效。
想反悔就把上面参数改回去，再跑：
  node scripts/launch.js${revert ? '' : ' --revert'}
`);