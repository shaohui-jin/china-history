/**
 * 精确子集：medium(500) 字重只服务标题与正文强调。
 *
 * 为什么需要单独一步：
 * 标题文字有两个来源——
 *   1. 页面模板里写死的标题（<h2>人物传记</h2> 之类），源码可扫；
 *   2. **由数据插值出来的标题**（<h1>{person.name}</h1>、<h3>{event.title}</h3>），
 *      源码里只有一个 `{...}`，真正的字在 Markdown/YAML 内容里。
 * 只靠扫源码会漏掉大量人名与事件名（实测漏 19% 的标题字符），
 * 表现为同一个标题里粗细不一。
 *
 * 所以这里在 astro build **之后**再跑一遍：直接读 dist 的 HTML，
 * 把真正会以 500+ 字重渲染的字符捞出来，重新切一份 medium.woff2 覆盖进去。
 * 这样既不用猜，也不会为了保险把整张全字表塞进第二个字重
 * （那会让首屏字体从 488KB 涨回 856KB）。
 *
 * 源文件缺失时（离线构建）静默跳过：public/fonts/medium.woff2 里
 * 已有一份构建期生成的近似子集，只是覆盖不全，不会 404。
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const SOURCE = '.cache/fonts/LXGWWenKai-Medium.ttf';
const TARGET = join(DIST, 'fonts', 'medium.woff2');

/** 以 500+ 字重渲染的选择器（与 global.css / 组件里的 --fw-semibold 用法一致） */
const DISPLAY_SELECTOR = new RegExp(
  [
    '<(h[1-6]|strong|b|th|dt|summary)\\b[^>]*>([\\s\\S]*?)</\\1>',
    '<(span|div|a|p|dt|dd|li|button)\\b[^>]*class="[^"]*' +
      '(?:topbar__name|topbar__mark|stat__value|tl__title|tl__list-year|identity__seal|' +
      'card__title|section__title|eyebrow|people-group__title|btn|badge|seal|quote__cite)' +
      '"[^>]*>([\\s\\S]*?)</\\3>',
  ].join('|'),
  'gi',
);

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function collectDisplayCharset(): Set<number> {
  const set = new Set<number>();
  const pages = walk(DIST).filter((f) => f.endsWith('.html'));

  for (const f of pages) {
    const html = readFileSync(f, 'utf8');
    for (const m of html.matchAll(DISPLAY_SELECTOR)) {
      const inner = m[2] ?? m[4] ?? '';
      // 去掉内层标签（标题里常有 <a>、<span> 包裹）
      for (const ch of inner.replace(/<[^>]+>/g, '')) {
        const cp = ch.codePointAt(0);
        if (cp !== undefined) set.add(cp);
      }
    }
  }

  // 补基础 ASCII 与常用标点：标题里会出现年份、破折号、书名号
  for (let cp = 0x20; cp <= 0x7e; cp++) set.add(cp);
  for (const cp of [
    0x3000, 0x3001, 0x3002, 0x300a, 0x300b, 0x300c, 0x300d, 0x300e, 0x300f,
    0x3010, 0x3011, 0x2018, 0x2019, 0x201c, 0x201d, 0x2014, 0x2026, 0x00b7,
    0xff01, 0xff08, 0xff09, 0xff0c, 0xff1a, 0xff1b, 0xff1f,
  ]) {
    set.add(cp);
  }
  return set;
}

async function main() {
  if (!existsSync(SOURCE)) {
    console.warn('[fonts] 缺少 medium 源文件，跳过精确子集（沿用构建期近似子集）');
    return;
  }
  if (!existsSync(TARGET)) {
    console.warn('[fonts] dist/fonts/medium.woff2 不存在，跳过精确子集');
    return;
  }

  const cps = collectDisplayCharset();
  const cjk = [...cps].filter((cp) => cp > 0x2e80).length;  if (cjk === 0) {
    console.warn('[fonts] dist 里没有找到标题文本，跳过精确子集');
    return;
  }

  const subsetFont = (await import('subset-font')).default;
  const text = String.fromCodePoint(...[...cps].sort((a, b) => a - b));
  const before = statSync(TARGET).size;
  const out = await subsetFont(readFileSync(SOURCE), text, { targetFormat: 'woff2' });
  writeFileSync(TARGET, out);

  console.log(
    `[fonts] medium 精确子集：${cjk} 个汉字覆盖全部标题，` +
      `${(before / 1024).toFixed(0)}KB → ${(out.length / 1024).toFixed(0)}KB`,
  );
}

main().catch((e) => {
  console.warn('[fonts] 精确子集失败（不影响构建）：', e instanceof Error ? e.message : e);
});
