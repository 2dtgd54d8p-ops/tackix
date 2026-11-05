/**
 * 后台编辑表单字段描述。edit.astro 把这个 schema 注入页面，由客户端脚本递归渲染出
 * 与 Keystatic 同构的编辑表单；提交时按 key 还原成与 D1 `data` 列同构的对象。
 *
 * 字段类型：
 *  - text / bilingual / textarea / date / select / multiselect / checkbox / image
 *  - group：对象分组（对应 data 的某个子对象，如 content/info/trust/items）
 *  - array：可重复数组（对应 steps/faq/navItems 等），item 内再是一组 fields
 *
 * 双语字段统一存成 { zh, en }；image 存成字符串，两种形态都支持：
 *  - 本站媒体路径 `/uploads/<key>`（上传来，落 R2 或 KV）
 *  - 外部链接 `https://…`（不落存储，渲染时原样输出）
 * 渲染侧由 src/lib/assets.ts 的 uploadsUrl() 统一解析，页面无需区分。
 */
import {
  CATEGORY_OPTIONS as CATEGORY_VOCAB,
  TAG_OPTIONS as TAG_VOCAB,
  SCENARIO_OPTIONS as SCENARIO_VOCAB,
} from '../generated/content-options';

export type FieldFormat = 'email' | 'url' | 'whatsapp';
export type FieldDef =
  | { type: 'text'; key: string; label: string; description?: string; placeholder?: string; required?: boolean; format?: FieldFormat }
  | { type: 'bilingual'; key: string; label: string; multiline?: boolean; description?: string; required?: boolean }
  | { type: 'textarea'; key: string; label: string; description?: string; required?: boolean }
  | { type: 'date'; key: string; label: string; description?: string; required?: boolean }
  | { type: 'select'; key: string; label: string; options: { label: string; value: string }[]; description?: string; required?: boolean }
  | { type: 'multiselect'; key: string; label: string; options: { label: string; value: string }[]; description?: string; required?: boolean }
  | { type: 'checkbox'; key: string; label: string; description?: string; required?: boolean }
  | { type: 'image'; key: string; label: string; description?: string; required?: boolean }
  | { type: 'group'; key: string; label: string; fields: FieldDef[]; description?: string; required?: boolean }
  | { type: 'array'; key: string; label: string; fields: FieldDef[]; itemLabel?: string; description?: string; required?: boolean };

export interface CollectionSchema {
  collection: string;
  title: string;
  isSingleton: boolean;
  slugEditableOnCreate?: boolean;
  fields: FieldDef[];
}

// ── 下拉选项：来自构建期 codegen 的词表（D1 快照 → src/generated/content-options.ts）──
// 在后台「分类管理 / 标签管理 / 场景方案」增删条目后，重新构建即同步到这里，无需改代码。
// 显示中文优先（labelZh），与后台中文界面一致；label 保留英文优先，供站点侧消费。
type Opt = { label: string; value: string; labelZh?: string };
const zhOpts = (list: ReadonlyArray<Opt>) =>
  list.map((o) => ({ label: o.labelZh || o.label, value: o.value }));

export const SCENARIO_OPTIONS = [{ label: '无', value: 'none' }, ...zhOpts(SCENARIO_VOCAB)];
export const CATEGORY_OPTIONS = [{ label: '未分类', value: 'uncategorized' }, ...zhOpts(CATEGORY_VOCAB)];
export const TAG_OPTIONS = zhOpts(TAG_VOCAB);

// 自定义区块类型与提示色调
const CUSTOM_SECTION_TYPES = [
  { label: '标题', value: 'heading' },
  { label: '段落', value: 'paragraph' },
  { label: '图片', value: 'image' },
  { label: '提示框', value: 'callout' },
  { label: '引用', value: 'quote' },
];
const CALLOUT_TONES = [
  { label: '提示', value: 'info' },
  { label: '警告', value: 'warn' },
  { label: '危险', value: 'danger' },
];

// ── 构造小工具 ───────────────────────────────────────────────
const bi = (key: string, label: string, opts: { multiline?: boolean; description?: string; required?: boolean } = {}): FieldDef => ({
  type: 'bilingual',
  key,
  label,
  multiline: opts.multiline,
  description: opts.description,
  required: opts.required,
});
const txt = (key: string, label: string, description?: string, opts: { required?: boolean; format?: FieldFormat } = {}): FieldDef =>
  ({ type: 'text', key, label, description, required: opts.required, format: opts.format });
const area = (key: string, label: string, description?: string): FieldDef => ({ type: 'textarea', key, label, description });
const chk = (key: string, label: string, description?: string): FieldDef => ({ type: 'checkbox', key, label, description });
const img = (key: string, label: string, description?: string): FieldDef => ({ type: 'image', key, label, description });
const grp = (key: string, label: string, fields: FieldDef[], description?: string): FieldDef => ({ type: 'group', key, label, fields, description });
const sel = (key: string, label: string, options: { label: string; value: string }[], description?: string): FieldDef => ({ type: 'select', key, label, options, description });
const multi = (key: string, label: string, options: { label: string; value: string }[], description?: string): FieldDef => ({ type: 'multiselect', key, label, options, description });
const date = (key: string, label: string, description?: string): FieldDef => ({ type: 'date', key, label, description });
const arr = (key: string, label: string, fields: FieldDef[], itemLabel: string, description?: string): FieldDef => ({ type: 'array', key, label, fields, itemLabel, description });

// ── 文章（knowledge）────────────────────────────────────────
const knowledgeSchema: CollectionSchema = {
  collection: 'knowledge',
  title: '知识库文章',
  isSingleton: false,
  slugEditableOnCreate: true,
  fields: [
    bi('name', '展示标题', { description: '卡片与详情页显示的中英双语标题', required: true }),
    bi('excerpt', '一句话结论 / 摘要', { multiline: true }),
    sel('scenario', '所属场景（维度一）', SCENARIO_OPTIONS),
    sel('category', '分类（维度二）', CATEGORY_OPTIONS),
    multi('tags', '标签（维度三·多选）', TAG_OPTIONS),
    bi('body', '双语正文（MDX）', { multiline: true, description: '中英各一份，支持 Markdown/MDX' }),
    arr(
      'steps',
      '结构化步骤（驱动 HowTo）',
      [bi('title', '步骤标题'), bi('text', '步骤说明', { multiline: true }), chk('pitfall', '避坑提示（不计入编号步骤）')],
      '添加步骤'
    ),
    arr(
      'customSections',
      '自定义内容区块',
      [
        sel('type', '区块类型', CUSTOM_SECTION_TYPES),
        txt('heading', '标题文字'),
        area('text', '文字内容'),
        img('image', '图片'),
        txt('imageCaption', '图片说明'),
        sel('calloutTone', '提示级别', CALLOUT_TONES),
      ],
      '添加区块'
    ),
    arr(
      'faq',
      '常见问题（≥3 条，驱动 FAQPage）',
      [bi('question', '问题'), bi('answer', '答案', { multiline: true })],
      '添加问答'
    ),
    img('cover', '封面图'),
    date('publishedAt', '发布日期'),
    chk('published', '已发布'),
    chk('featured', '在首页展示'),
  ],
};

// ── 场景方案（scenarios）─────────────────────────────────────
const scenarioSchema: CollectionSchema = {
  collection: 'scenarios',
  title: '场景方案',
  isSingleton: false,
  slugEditableOnCreate: true,
  fields: [
    bi('name', '展示标题', { required: true }),
    bi('excerpt', '摘要', { multiline: true }),
    chk('published', '已发布'),
    chk('featured', '在首页展示'),
    bi('conclusion', '一句话结论', { multiline: true }),
    arr(
      'selectionLogic',
      '选型逻辑（驱动 HowTo）',
      [bi('title', '要点标题'), bi('point', '要点说明', { multiline: true })],
      '添加要点'
    ),
    arr(
      'recommendedProducts',
      '推荐产品占位（2-3 个）',
      [bi('name', '产品占位名'), txt('slug', '产品 slug（对应 TDS/SDS 文件名）'), bi('params', '参数占位符', { multiline: true })],
      '添加产品'
    ),
    arr('faq', '常见问题', [bi('question', '问题'), bi('answer', '答案', { multiline: true })], '添加问答'),
    bi('inquiryCta', '询盘按钮文案'),
    img('cover', '封面图'),
    bi('body', '正文（可选）', { multiline: true }),
    arr(
      'customSections',
      '自定义内容区块',
      [
        sel('type', '区块类型', CUSTOM_SECTION_TYPES),
        txt('heading', '标题文字'),
        area('text', '文字内容'),
        img('image', '图片'),
        txt('imageCaption', '图片说明'),
        sel('calloutTone', '提示级别', CALLOUT_TONES),
      ],
      '添加区块'
    ),
  ],
};

// ── 单例 ───────────────────────────────────────────────────
const singletonSchemas: Record<string, CollectionSchema> = {
  home: {
    collection: 'home',
    title: '首页内容',
    isSingleton: true,
    fields: [
      grp('content', '首页文案', [
        bi('heroEyebrow', '首屏眉标'),
        bi('heroCta1', '首屏按钮 1'),
        bi('heroCta2', '首屏按钮 2'),
        bi('scenariosTitle', '场景区标题'),
        bi('scenariosSub', '场景区副标题', { multiline: true }),
        bi('knowledgeTitle', '知识区标题'),
        bi('knowledgeSub', '知识区副标题', { multiline: true }),
        bi('bandTitle', '行动号召区标题'),
        bi('bandSub', '行动号召区副标题', { multiline: true }),
        bi('bandCta1', '行动号召按钮 1'),
        bi('bandCta2', '行动号召按钮 2'),
      ]),
    ],
  },
  ui: {
    collection: 'ui',
    title: '全局界面文案',
    isSingleton: true,
    fields: [
      arr(
        'navItems',
        '主导航',
        [bi('label', '导航标签'), txt('href', '链接'), chk('scenariosMenu', '下拉展示场景方案')],
        '添加导航项'
      ),
      grp('content', '页脚与浮动按钮', [
        bi('footerText', '页脚文字'),
        bi('footerAdminLabel', '后台入口标签'),
        bi('footerReportLabel', '报表链接标签'),
        bi('whatsappLabel', 'WhatsApp 按钮标签'),
        bi('whatsappAria', 'WhatsApp 无障碍标签'),
        bi('contactAria', '联系按钮无障碍标签'),
      ]),
    ],
  },
  contact: {
    collection: 'contact',
    title: '联系页',
    isSingleton: true,
    fields: [
      grp('content', '联系页文案', [
        bi('pageTitle', '页面标题'),
        bi('pageSub', '页面副标题', { multiline: true }),
        bi('contactInfoTitle', '联系信息标题'),
        bi('formSectionTitle', '表单区标题'),
        bi('formName', '姓名字段标签'),
        bi('formEmail', '邮箱字段标签'),
        bi('formMsg', '留言字段标签'),
        bi('submit', '提交按钮'),
        bi('success', '成功提示', { multiline: true }),
        bi('prelaunchTitle', '预上线提示标题'),
        bi('prelaunchBody', '预上线提示正文', { multiline: true }),
        bi('tipsTitle', '提示标题'),
      ]),
      arr('tipsItems', '提示列表', [bi('text', '提示内容', { multiline: true })], '添加提示'),
    ],
  },
  pages: {
    collection: 'pages',
    title: '列表页标题',
    isSingleton: true,
    fields: [
      grp('content', '列表页标题', [
        bi('knowledgeTitle', '知识库列表标题'),
        bi('knowledgeSub', '知识库列表副标题', { multiline: true }),
        bi('scenariosTitle', '场景列表标题'),
        bi('scenariosSub', '场景列表副标题', { multiline: true }),
        bi('searchPlaceholder', '搜索框占位符'),
      ]),
    ],
  },
  detail: {
    collection: 'detail',
    title: '详情页区块',
    isSingleton: true,
    fields: [
      grp('content', '详情页区块标题', [
        bi('articleFaqTitle', '文章常见问题标题'),
        bi('articleStepsTitle', '文章：步骤标题'),
        bi('articlePitfallsTitle', '文章：避坑标题'),
        bi('scenarioConclusionTitle', '场景：结论标题'),
        bi('scenarioSelectionTitle', '场景：选型逻辑标题'),
        bi('scenarioProductsTitle', '场景：推荐产品标题'),
        bi('scenarioInquiryTitle', '场景：询盘 CTA 标题'),
        bi('scenarioArticlesTitle', '场景：相关内容标题'),
      ]),
    ],
  },
  about: {
    collection: 'about',
    title: '关于页',
    isSingleton: true,
    fields: [
      grp('content', '关于页内容', [
        bi('storyTitle', '品牌故事标题'),
        bi('storyBody', '品牌故事正文', { multiline: true }),
        bi('missionTitle', '使命标题'),
        bi('missionBody', '使命正文', { multiline: true }),
        bi('factoryCaption', '工厂图片说明'),
      ]),
      img('factoryImage', '工厂图片'),
    ],
  },
  site: {
    collection: 'site',
    title: '站点与公司信息',
    isSingleton: true,
    fields: [
      grp('info', '站点与联系信息', [
        bi('title', '站点标题'),
        bi('brandName', '页头品牌名'),
        bi('description', '站点描述', { multiline: true }),
        bi('tagline', '首页标语'),
        txt('email', '商务邮箱', undefined, { required: true, format: 'email' }),
        txt('company', '公司名称'),
        txt('phone', '电话'),
        txt('whatsapp', 'WhatsApp 号码（仅数字+国家码）', undefined, { format: 'whatsapp' }),
        area('address', '地址'),
        txt('hours', '营业时间'),
        txt('whatsappPrefill', 'WhatsApp 预填话术'),
        chk('showWhatsappFloat', '显示 WhatsApp 悬浮按钮'),
      ]),
      grp('trust', '信任带', [bi('trustTitle', '信任带标题'), bi('trustSub', '信任带副标题', { multiline: true })]),
      arr('certBadges', '认证与信任徽章', [bi('label', '徽章标签'), bi('note', '徽章说明', { multiline: true })], '添加徽章'),
    ],
  },
  categories: {
    collection: 'categories',
    title: '分类管理',
    isSingleton: true,
    fields: [arr('items', '分类项', [bi('label', '显示名称'), txt('value', '值（slug，英文）')], '添加分类')],
  },
  tags: {
    collection: 'tags',
    title: '标签',
    isSingleton: true,
    fields: [arr('items', '标签项', [bi('label', '显示名称'), txt('value', '值（slug，英文）')], '添加标签')],
  },
};

export const SCHEMAS: Record<string, CollectionSchema> = {
  knowledge: knowledgeSchema,
  scenarios: scenarioSchema,
  ...singletonSchemas,
};

export function getSchema(collection: string): CollectionSchema | undefined {
  return SCHEMAS[collection];
}
