// 一次性迁移脚本：把根目录 singleton YAML（旧的 xxx / xxxEn 平铺双语形态）
// 改写为统一的 { zh, en } 对象形态，以匹配内容后台（D1 / content.json）的新 schema。
// 仅本地使用，跑完可删除。
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const ROOT = process.cwd();

const files = {
  'home/index.yaml': {
    content: {
      heroEyebrow: { zh: '工业胶粘剂与密封剂 · 选型 · 技术 · 询盘', en: 'Industrial Adhesives & Sealants · Selection · Technology · Inquiry' },
      heroCta1: { zh: '探索解决方案', en: 'Explore Solutions' },
      heroCta2: { zh: '联系我们报价', en: 'Contact Us for Quotation' },
      scenariosTitle: { zh: '解决方案', en: 'Solutions' },
      scenariosSub: { zh: '从场景选型到落地应用，一站式找到适合的胶粘剂方案。', en: 'From scenario selection to real-world application — find the right adhesive solution in one place.' },
      knowledgeTitle: { zh: '知识库', en: 'Knowledge Base' },
      knowledgeSub: { zh: '面向真实工况的胶粘剂与密封剂选型指南、避坑与排障。', en: 'Guides, pitfalls and troubleshooting for real-world adhesive & sealant jobs.' },
      bandTitle: { zh: '需要选型建议？', en: 'Need a selection recommendation?' },
      bandSub: { zh: '面向工业胶粘剂与密封剂行业的垂直平台，提供方案、选型、技术与案例。', en: 'A vertical platform for the industrial adhesive & sealant industry — solutions, selection, technology and cases.' },
      bandCta1: { zh: '联系我们获取报价', en: 'Contact Us for Quotation' },
      bandCta2: { zh: '浏览知识库', en: 'Browse the Knowledge Base' },
    },
  },
  'ui/index.yaml': {
    navItems: [
      { label: { zh: '首页', en: 'Home' }, href: '/' },
      { label: { zh: '解决方案', en: 'Solutions' }, href: '/solutions' },
      { label: { zh: '知识库', en: 'Knowledge' }, href: '/knowledge' },
      { label: { zh: '关于', en: 'About' }, href: '/about' },
      { label: { zh: '联系', en: 'Contact' }, href: '/contact' },
    ],
    content: { footerText: { zh: '', en: '' } },
  },
  'contact/index.yaml': {
    content: {
      contactInfoTitle: { zh: '联系方式', en: 'Contact Information' },
      formSectionTitle: { zh: '在线留言', en: 'Send us a message' },
      pageTitle: { zh: '联系我们', en: 'Contact Sales' },
      pageSub: { zh: '告诉我们您的基材、工况与产能，我们的技术团队将提供针对性的选型建议与报价。', en: 'Tell us your substrates, operating conditions and volume — our engineers will recommend a grade and quote.' },
      formTitle: { zh: '发送消息', en: 'Send us a message' },
      formName: { zh: '您的姓名', en: 'Your name' },
      formEmail: { zh: '商务邮箱', en: 'Business email' },
      formMsg: { zh: '您的应用场景', en: 'Your application' },
      submit: { zh: '发送询盘', en: 'Send Enquiry' },
      success: { zh: '感谢您的留言，我们会尽快回复。', en: 'Thank you — your enquiry has been received. We will reply shortly.' },
      prelaunchTitle: { zh: '本站尚未正式上线', en: 'This site is not yet live' },
      prelaunchBody: { zh: '在线表单暂时关闭，避免测试数据与真实询盘混淆。请通过邮件或 WhatsApp 直接联系我们。', en: 'The online form is temporarily closed. Please reach us directly by email or WhatsApp.' },
      tipsTitle: { zh: '留言时请包含', en: 'What to include' },
    },
    tipsItems: [
      { text: { zh: '基材（如铝、钢、PC、FRP）', en: 'Substrates (e.g. aluminium, steel, PC, FRP)' } },
      { text: { zh: '载荷类型与接头活动量', en: 'Load type and joint movement' } },
      { text: { zh: '工作温度范围', en: 'Operating temperature range' } },
      { text: { zh: '固化偏好与产线节拍', en: 'Cure preference and line takt' } },
      { text: { zh: '认证要求（RoHS、REACH、UL 等）', en: 'Certification requirements (RoHS, REACH, UL)' } },
    ],
  },
  'pages/index.yaml': {
    content: {
      knowledgeTitle: { zh: '知识库', en: 'Knowledge Base' },
      knowledgeSub: { zh: '共 {n} 篇 · 选型指南、应用避坑与故障排查', en: '{n} articles · selection guides, application pitfalls and troubleshooting' },
      scenariosTitle: { zh: '解决方案', en: 'Scenario Solutions' },
      scenariosSub: { zh: '选择您的工况，获取明确推荐与可询盘的产品。', en: 'Pick your job, get a clear recommendation and the products to ask about.' },
      searchPlaceholder: { zh: '搜索文章与方案…', en: 'Search articles and solutions…' },
    },
  },
  'detail/index.yaml': {
    content: {
      articleFaqTitle: { zh: '常见问题（FAQ）', en: 'Frequently Asked Questions' },
      scenarioConclusionTitle: { zh: '一句话结论', en: 'The bottom line' },
      scenarioSelectionTitle: { zh: '选型逻辑', en: 'How to choose' },
      scenarioProductsTitle: { zh: '推荐产品', en: 'Recommended products' },
      scenarioInquiryTitle: { zh: '获取量身定制的建议', en: 'Get a tailored recommendation' },
    },
  },
  'site/index.yaml': {
    info: {
      title: { zh: 'Tackix', en: 'Tackix' },
      description: { zh: 'Tackix 是面向海外承包商、安装商与 DIY 用户的场景化工业胶粘剂与密封剂选型知识平台——提供场景方案、应用知识与直接询盘。', en: 'Tackix helps overseas contractors, installers and DIY users choose the right industrial adhesive or sealant for the job — with scenario-based guides, application know-how and direct inquiry.' },
      tagline: { zh: '工业胶粘剂与密封剂 · 选型 · 技术 · 询盘', en: 'Industrial adhesives & sealants · selection · technology · inquiry' },
      email: 'jccker@gmail.com',
      company: '',
      phone: '',
      whatsapp: '',
      address: '',
      hours: 'Mon-Fri 09:00-18:00 (GMT+8)',
      whatsappPrefill: 'Hello, I would like a quotation for industrial adhesives. Could you share TDS/SDS and technical support?',
    },
    trust: {
      trustTitle: { zh: '为什么选择我们', en: 'Why Tackix' },
      trustSub: { zh: '以场景为先的选型知识，让每一次材料指定都透明、高效、可信赖。', en: 'Scenario-first selection knowledge that makes every specification transparent, efficient and trustworthy.' },
    },
    certBadges: [],
  },
  'categories/index.yaml': {
    items: [
      { label: { zh: '选型指南', en: 'Selection Guide' }, value: 'selection-guide' },
      { label: { zh: '应用避坑', en: 'Application Pitfalls' }, value: 'application-pitfalls' },
      { label: { zh: '故障排查', en: 'Troubleshooting' }, value: 'troubleshooting' },
    ],
  },
  'tags/index.yaml': {
    items: [
      { label: { zh: '硅酮密封胶', en: 'Silicone Sealant' }, value: 'silicone-sealant' },
      { label: { zh: '聚氨酯', en: 'Polyurethane' }, value: 'polyurethane' },
      { label: { zh: '环氧', en: 'Epoxy' }, value: 'epoxy' },
      { label: { zh: 'MS 聚合物', en: 'MS Polymer' }, value: 'ms-polymer' },
      { label: { zh: '防水', en: 'Waterproofing' }, value: 'waterproofing' },
      { label: { zh: '防霉', en: 'Mould Resistance' }, value: 'mould-resistant' },
      { label: { zh: '瓷砖与石材', en: 'Tile & Stone' }, value: 'tile-stone' },
      { label: { zh: '伸缩缝', en: 'Expansion Joints' }, value: 'expansion-joints' },
      { label: { zh: '表面处理', en: 'Surface Prep' }, value: 'surface-prep' },
      { label: { zh: '基材', en: 'Substrate' }, value: 'substrate' },
      { label: { zh: '温度', en: 'Temperature' }, value: 'temperature' },
      { label: { zh: 'DIY', en: 'DIY' }, value: 'diy' },
      { label: { zh: '专业', en: 'Professional' }, value: 'professional' },
    ],
  },
};

for (const [rel, data] of Object.entries(files)) {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, yaml.dump(data, { lineWidth: 120, noRefs: true }));
  console.log('wrote', rel);
}
