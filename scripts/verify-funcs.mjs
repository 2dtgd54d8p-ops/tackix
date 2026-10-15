// 验证新逻辑函数：normalizeSections（自定义区块归一化）与 howToFromSteps（HowTo 结构化）。
// 用 esbuild 打包为 node 可执行的 bundle 后运行，覆盖正常 / 边界 / 异常输入。
import { normalizeSections } from '../src/lib/custom-sections';
import { howToFromSteps } from '../src/lib/schema';

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra ? JSON.stringify(extra) : ''); }
}

console.log('— normalizeSections —');
// 1. 非数组输入安全降级
check('非数组 -> []', JSON.stringify(normalizeSections(null)) === '[]');
check('undefined -> []', JSON.stringify(normalizeSections(undefined)) === '[]');
check('字符串 -> []', JSON.stringify(normalizeSections('x')) === '[]');

// 2. 五类区块 + 图片解析 + 提示级别降级
const raw = [
  { type: 'heading', heading: '  H2标题  ', text: 'ignored' },
  { type: 'paragraph', text: '  段落文字  ' },
  { type: 'image', image: 'cover.png', imageCaption: ' 图注 ' },
  { type: 'callout', text: '警告内容', calloutTone: 'warn' },
  { type: 'quote', text: '引用句', calloutTone: 'bogus' }, // 非法 tone 降级 info
  { type: 'unknown-type', text: '未知类型按段落' },
  null,
  'garbage',
];
const norm = normalizeSections(raw);
check('过滤非对象项', norm.length === 6, norm.length);
check('heading 去空格', norm[0].heading === 'H2标题' && norm[0].type === 'heading');
check('paragraph 去空格', norm[1].text === '段落文字');
check('image 解析为 /uploads/ 路径', norm[2].image === '/uploads/cover.png' && norm[2].imageCaption === '图注');
check('callout warn 保留', norm[3].type === 'callout' && norm[3].calloutTone === 'warn' && norm[3].text === '警告内容');
check('callout 非法 tone 降级 info', norm[4].calloutTone === 'info' && norm[4].type === 'quote');
check('未知 type 默认 paragraph', norm[5].type === 'paragraph');

console.log('— howToFromSteps —');
// 3. 空 / 全避坑 -> null
check('空步骤 -> null', howToFromSteps('zh-CN', '标题', []) === null);
check('全 pitfall -> null', howToFromSteps('zh-CN', '标题', [{ pitfall: true, title: { zh: '别这样做' } }]) === null);

// 4. 只取非 pitfall 编号；pitfall 不计入步骤
const steps = [
  { title: { zh: '第一步', en: 'Step 1' }, text: { zh: '做A', en: 'Do A' } },
  { title: { zh: '别做陷阱', en: 'Pitfall' }, text: { zh: '别X', en: 'No X' }, pitfall: true },
  { title: { zh: '第二步', en: 'Step 2' }, text: { zh: '做B', en: 'Do B' } },
];
const ht = howToFromSteps('zh-CN', '施工步骤', steps);
check('返回 HowTo 类型', ht && ht['@type'] === 'HowTo');
check('仅 2 个编号步骤（pitfall 排除）', ht && ht.step.length === 2, ht && ht.step.length);
check('步骤 position 连续编号', ht && ht.step[0].position === 1 && ht.step[1].position === 2);
check('中文取 zh', ht && ht.step[0].name === '第一步' && ht.step[0].text === '做A');
check('inLanguage=zh-CN', ht && ht.inLanguage === 'zh-CN');

// 5. en 语种取 en
const htEn = howToFromSteps('en', 'Steps', steps);
check('en 取 en 文案', htEn && htEn.step[0].name === 'Step 1' && htEn.step[1].name === 'Step 2');

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
