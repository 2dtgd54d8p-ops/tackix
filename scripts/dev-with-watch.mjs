// Dev orchestrator（替代直接 `astro dev`）。
//
// 作用：
//   1. 启动前先从后台 singleton 生成 src/generated/content-options.ts；
//   2. 启动 astro dev；
//   3. 监听 categories/index.yaml、tags/index.yaml 的变化，自动重新生成
//      content-options.ts，使后台「分类管理 / 标签管理」的增删即时同步到
//      文章编辑器的「分类」下拉与「标签」多选框（Vite 检测到生成的模块变化会
//      触发热更新 / 整页刷新，无需手动重启 dev）。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateContentOptions } from './gen-content-options.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WATCH = ['categories/index.yaml', 'tags/index.yaml'].map((f) =>
  path.join(ROOT, f)
);

// 1) 先生成一次，保证 astro 启动时 config 已 import 到最新选项
generateContentOptions();

// 2) 启动 astro dev
const astro = spawn('npx', ['astro', 'dev'], {
  cwd: ROOT,
  env: { ...process.env },
  stdio: 'inherit',
});

// 3) 监听 singleton YAML，变化时重新生成（去抖 300ms）
let timer = null;
for (const f of WATCH) {
  if (!fs.existsSync(f)) continue;
  fs.watch(f, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      generateContentOptions();
    }, 300);
  });
}

const shutdown = () => {
  try {
    astro.kill('SIGTERM');
  } catch {
    /* noop */
  }
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
astro.on('exit', (code) => process.exit(code ?? 0));
