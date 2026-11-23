import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import sitemap from '@astrojs/sitemap';
import remarkWikilink from './src/lib/remark-wikilink.ts';
import remarkFootnote from './src/lib/remark-footnote.ts';

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
     * 插件顺序：footnote 先于 wikilink。
     *
     * wikilink 会把文本节点替换成新节点，而 footnote 依赖在文本节点上做标记，
     * 所以 footnote 必须先跑。
     */
    remarkPlugins: [remarkFootnote, remarkWikilink],
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
