#!/usr/bin/env node
/**
 * smoke-pages.mjs —— 全站页面「真浏览器」冒烟体检。
 *
 * 为什么需要它：后台曾出现「HTTP 200、HTML 完整、接口全通，但页面白屏/卡在加载中」的情况
 * （Astro 表达式写在不会被求值的 script 里 → 前端 SyntaxError）。这类问题 curl 和接口测试都
 * 发现不了，只有真浏览器跑一遍才看得见。详见 docs/data-foundation-design.md §8.5。
 *
 * 用法：
 *   node scripts/smoke-pages.mjs                      # 体检线上站（默认 https://tackix.pages.dev）
 *   node scripts/smoke-pages.mjs --base http://localhost:4321
 *   node scripts/smoke-pages.mjs --dist dist          # 只测本地构建产物里有的静态页
 *   node scripts/smoke-pages.mjs --cookie "k=v"       # 带上会话 cookie，可一并测 /admin（需先自行登录）
 *
 * 依赖：本机装了 Chrome（默认 macOS 路径，可用 CHROME_PATH 覆盖）。不引入 puppeteer：
 * 用 Chrome 的 --remote-debugging-port + CDP，Node 18+ 自带 fetch/WebSocket 足够。
 *
 * 判定标准（任一命中即记为问题）：
 *   - 页面抛未捕获异常 / console.error
 *   - 请求 4xx / 5xx，或资源加载失败
 *   - 正文文本过少（默认 < 200 字），可能整块渲染失败
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const BASE = argOf('--base', 'https://tackix.pages.dev').replace(/\/$/, '');
const DIST = argOf('--dist', 'dist');
const COOKIE = argOf('--cookie', '');
const MIN_TEXT = Number(argOf('--min-text', '200'));
// 这两页是「运营令牌门」静态壳，正文本来就极短（未输令牌时不渲染内容），不做字数判定
const SHORT_OK = new Set(['/admin/report/', '/admin/messages/']);
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(argOf('--port', '9391'));

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (f === 'index.html') {
      out.push('/' + relative(DIST, dir).replace(/\\/g, '/') + '/');
    }
  }
  return out;
}

let routes;
try {
  routes = [...new Set(walk(DIST))].sort();
} catch (e) {
  console.error(`读不到构建产物目录 ${DIST}，先 npm run build，或用 --dist 指定路径。`);
  process.exit(1);
}
if (COOKIE) {
  // 带 cookie 时把后台页也纳入体检
  routes = routes.concat(['/admin/', '/admin/edit?singleton=site', '/admin/revisions?singleton=site']);
}

const prof = mkdtempSync(join(tmpdir(), 'smoke-'));
const chrome = spawn(
  CHROME,
  ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-software-rasterizer', '--in-process-gpu',
   `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--no-first-run', '--hide-scrollbars',
   '--window-size=1280,900', 'about:blank'],
  { stdio: 'ignore' }
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) break; } catch {}
    await sleep(250);
  }
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let seq = 0;
  const pend = new Map();
  let logs = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      logs.push('EXC ' + (d.exception?.description || d.text).split('\n')[0]);
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      logs.push('CONSOLE ' + (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' '));
    } else if (m.method === 'Network.loadingFailed' && !String(m.params.errorText).includes('ERR_ABORTED')) {
      logs.push('NET ' + m.params.errorText);
    } else if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) {
      logs.push('HTTP ' + m.params.response.status + ' ' + m.params.response.url.replace(BASE, ''));
    }
  };
  await new Promise((r) => (ws.onopen = r));
  const send = (method, params = {}) => new Promise((res) => {
    const id = ++seq;
    pend.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  if (COOKIE) {
    const [name, ...rest] = COOKIE.split('=');
    const host = new URL(BASE).hostname;
    await send('Network.setCookie', { name, value: rest.join('='), domain: host, path: '/', secure: BASE.startsWith('https'), httpOnly: true, sameSite: 'Lax' });
  }

  console.log(`体检 ${routes.length} 个页面 · ${BASE}\n`);
  const bad = [];
  for (const route of routes) {
    logs = [];
    await send('Page.navigate', { url: BASE + route });
    await sleep(2600);
    const ev = await send('Runtime.evaluate', {
      expression: `document.body.innerText.replace(/\\s+/g,' ').trim().length`,
      returnByValue: true,
    });
    const textLen = ev.result?.result?.value || 0;
    const uniq = [...new Set(logs)];
    const tooShort = textLen < MIN_TEXT && !SHORT_OK.has(route);
    if (uniq.length || tooShort) {
      bad.push({ route, textLen, logs: uniq });
      console.log(`✗ ${route}  (正文 ${textLen} 字)`);
      for (const l of uniq.slice(0, 5)) console.log('    ' + l);
      if (!uniq.length) console.log('    （无异常但正文过少，疑似整块渲染失败）');
    } else {
      console.log('✓ ' + route);
    }
  }

  const report = '/tmp/smoke-pages.json';
  writeFileSync(report, JSON.stringify(bad, null, 2));
  console.log(`\n问题页面 ${bad.length} / ${routes.length}（明细 ${report}）`);
  ws.close();
  chrome.kill();
  process.exit(bad.length ? 1 : 0);
})().catch((e) => {
  console.error('ERR', e);
  chrome.kill();
  process.exit(1);
});
