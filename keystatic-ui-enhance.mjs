// Keystatic 后台 UI 增强：把「多选框」由单列改为多列
// ---------------------------------------------------------------
// 背景：Keystatic 0.6.9 的 `fields.multiselect` 只接受
//   { label, options, defaultValue, description }，**没有任何布局/列数参数**
//   （见 node_modules/@keystatic/core/dist/declarations/src/form/fields/
//   multiselect/index.d.ts）。选项竖排是 UI 内部写死的，无法通过 config 调整。
//   本项目 posts 的「标签」有 20 个选项，竖排导致编辑页极长。
//
// 为什么用 middleware 而非 injectScript：/keystatic 后台页由 @keystatic/astro
//   自行渲染（client:only react），不走 Astro 默认的 head/script 注入流程，
//   实测 injectScript 的脚本不会出现在该页 HTML 中。故改在HTML 层面改写，
//   详见 keystatic-admin-middleware.mjs。
//
// 样式目标：multiselect 的选项容器（实测类名 `kui:reset kui-w6jnm`，display:grid）。
//   ⚠️ kui-* 是构建期哈希类名，升级 @keystatic/core 后可能变化，故 middleware 里
//   同时用**结构特征**兜底（子元素均为 LABEL 且数量足够时同样横排）。
export default function keystaticUiEnhance() {
  return {
    name: 'keystatic-ui-enhance',
    hooks: {
      'astro:config:setup': ({ addMiddleware, addWatchFile }) => {
        addWatchFile(new URL('../keystatic.config.ts', import.meta.url));
        addMiddleware({
          order: 'post',
          // ⚠️ entrypoint 必须是绝对 file:// URL —— 传相对路径会被 Vite 当成裸模块名，
          //   报 "Cannot find module 'keystatic-admin-middleware.mjs'"。
          entrypoint: new URL('./keystatic-admin-middleware.mjs', import.meta.url).pathname,
        });
      },
    },
  };
}