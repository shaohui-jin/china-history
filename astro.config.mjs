import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';

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
  integrations: [vue()],
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
