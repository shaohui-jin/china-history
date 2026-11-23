/**
 * 截图脚本：四档宽度 × 关键页面。
 *
 * 用 Chromium 实际渲染，而不是只看 HTML —— 之前所有验证都停在 HTTP 层，
 * Cytoscape 布局、Canvas 绘制、字体渲染、滚动条观感全是盲区。
 *
 * 运行：node scripts/shoot.mjs [baseUrl]
 * 产物：.shots/<页面>-<宽度>.png
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:4322';

/** 四档宽度：手机竖屏 / 手机横屏+小平板 / 平板横屏 / 桌面 */
const VIEWPORTS = [
  { name: '375', width: 375, height: 900 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 900 },
  { name: '1440', width: 1440, height: 1000 },
];

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'timeline', path: '/timeline' },
  { name: 'graph', path: '/graph?focus=zhuge-liang' },
  { name: 'person', path: '/people/zhuge-liang' },
  { name: 'event', path: '/events/chibi' },
  { name: 'dynasty', path: '/dynasties/sanguo' },
  { name: 'search', path: '/search?q=诸葛亮' },
  { name: 'styleguide', path: '/styleguide' },
];

mkdirSync('.shots', { recursive: true });

const browser = await chromium.launch();
const errors = [];

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    // 用中文 locale，避免系统字体回退差异
    locale: 'zh-CN',
  });

  for (const page of PAGES) {
    const tab = await context.newPage();

    // 收集控制台错误与页面异常：这是发现运行时问题的关键
    tab.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(`[${vp.name} ${page.name}] console: ${msg.text()}`);
      }
    });
    tab.on('pageerror', (err) => {
      errors.push(`[${vp.name} ${page.name}] pageerror: ${err.message}`);
    });

    try {
      await tab.goto(`${BASE}${page.path}`, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
      // 等字体加载完成，否则截到的可能是回退字形
      await tab.evaluate(() => document.fonts.ready);
      // 给 Cytoscape / Canvas 一点渲染时间
      await tab.waitForTimeout(1200);

      await tab.screenshot({
        path: `.shots/${page.name}-${vp.name}.png`,
        fullPage: vp.width >= 1024, // 桌面截全页，移动端只截首屏
      });
      console.log(`ok  ${page.name}-${vp.name}`);
    } catch (e) {
      console.log(`ERR ${page.name}-${vp.name}: ${e.message}`);
      errors.push(`[${vp.name} ${page.name}] ${e.message}`);
    } finally {
      await tab.close();
    }
  }

  await context.close();
}

await browser.close();

/* ---------------- 报告 ---------------- */

console.log('');
if (errors.length === 0) {
  console.log('✓ 无控制台错误');
} else {
  console.log(`发现 ${errors.length} 个运行时问题：`);
  for (const e of errors) console.log(`  × ${e}`);
}
