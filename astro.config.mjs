import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import sitemap from '@astrojs/sitemap';
import remarkWikilink from './src/lib/remark-wikilink.ts';
import remarkFootnote from './src/lib/remark-footnote.ts';
import remarkGloss from './src/lib/remark-gloss.ts';

/**
 * GitHub Pages 部署配置。
 *
 * 两种部署形态：
 * 1. 项目站：https://<user>.github.io/<repo>/  → base 必须设成 '/<repo>'
 * 2. 用户站：https://<user>.github.io/          → base 为 '/'
 *
 * 通过环境变量切换，避免改代码：
 *   SITE_URL=https://xxx.github.io  BASE_PATH=/history  npm run build
 *
 * 本地开发不设 base（默认 '/'），这样 `npm run dev` 的地址最干净。
 */
const site = process.env.SITE_URL;
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  ...(site ? { site } : {}),
  base,
  /**
   * sitemap 需要 site 已配置。未设 SITE_URL 的本地构建跳过它，
   * 否则 @astrojs/sitemap 会因为拿不到绝对地址而报错。
   */
  integrations: site ? [vue(), sitemap()] : [vue()],
  markdown: {
    /**
     * 正文内链：[[person:zhuge-liang]] / [[event:chibi|自定义文字]]。
     *
     * 插件在构建期读取 src/content/ 建索引，写错 id 会直接让构建失败，
     * 避免拼错静默通过。source 类型暂无详情页，渲染成《书名》行内标记。
     */
    /**
     * 插件顺序有硬约束，三步都要按此排列：
     *
     * 1. footnote 先跑：它要在完整文本节点上匹配 `[^source-id]`。
     * 2. gloss 次之：它要在 footnote 切分后的文本片段上匹配 `{原文|译文}`。
     *    放在 footnote 之前也能工作，但脚注标记可能落在 gloss 内部，导致译文里混进 `[^id]`。
     * 3. wikilink 最后：它会把文本节点整个替换成链接节点，
     *    跑早了后面两个插件就扫不到原文了。
     */
    remarkPlugins: [remarkFootnote, remarkGloss, remarkWikilink],
  },
  // 构建产物里保留相对路径，减少 base 处理出错的面
  build: {
    assets: '_astro',
    /**
     * 样式全部内联进 HTML。
     *
     * 本站 CSS 只有 ~19KB（未压缩），但它是**渲染阻塞**的：
     * 移动端模拟网络下每个串行请求要付 562ms RTT，
     * 两个样式表就把 FCP 推到 3.4s（Lighthouse 实测）。
     * 内联之后没有阻塞请求，且 @font-face 在 HTML 解析阶段就被发现，
     * 字体能更早开始下载。代价是 HTML 大一点、跨页不能复用 CSS 缓存——
     * 对静态文档站来说，首屏时间远比这点缓存重要。
     */
    inlineStylesheets: 'always',
  },
});
