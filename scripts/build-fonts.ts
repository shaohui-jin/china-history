/**
 * 中文字体切片管线。
 *
 * 为什么用 subset-font 而不是 cn-font-split：
 * - cn-font-split 面向「整站大字体按频率分片」场景，即便指定 subsets 与
 *   chunkSize=1000000，1931 字仍产出 52 个文件 / 11MB（默认保留剩余字形）。
 * - subset-font 用 harfbuzz 的 wasm 版做真正的字形裁剪（Google Fonts 同源方案），
 *   同样 1931 字产出 1 个文件 / 416KB。
 * 对本项目「字数可控、要少请求」的场景，后者明显更合适。
 *
 * 字重策略（移动端首屏的关键）：
 * - 400（regular）承载正文，必须覆盖全站字表 → 约 428KB，但不阻塞首屏
 *   （不 preload，靠 font-display: swap 先出系统楷体，再换字）。
 * - 500（medium）只服务标题与正文强调。实测标题字表仅 349 字，
 *   若按全站字表切会产生第二个 428KB —— 那是首屏 875KB 的主因。
 *   这里只切「标题/强调实际用到的字」，压到约 100KB。
 *   未覆盖的标题字回落到 regular 的 400 字重（仍是楷体，不会变宋体）。
 *
 * 字体：霞鹜文楷 LXGW WenKai（SIL OFL 1.1，允许自由分发与修改）。
 * 不使用 Windows 的 simkai.ttf / STKAITI.TTF——微软专有，不能打包。
 *
 * 源文件缓存于 .cache/fonts/（已 gitignore），只下载一次。
 * 运行：npm run fonts
 * 产物：
 *   public/fonts/*.woff2           子集文件
 *   src/styles/fonts.generated.css @font-face 声明
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  rmSync,
  existsSync,
} from 'node:fs';
import { join } from 'node:path';

const CACHE = '.cache/fonts';
const OUT_FONTS = 'public/fonts';
const OUT_CSS = 'src/styles/fonts.generated.css';

/**
 * 字体下载源。固定版本号而非 latest，保证构建可重现——
 * 否则上游更新会让不同时间的构建产出不同的字体文件。
 */
const FONT_VERSION = 'v1.520';
const FONT_BASE_URL = `https://github.com/lxgw/LxgwWenKai/releases/download/${FONT_VERSION}`;

/**
 * 部署根路径。与 astro.config.mjs 的 base 保持一致：
 *   BASE_PATH=/history npm run build  → 字体引用 /history/fonts/xxx.woff2
 * 样式会被内联进 HTML，相对路径会相对**页面 URL** 解析，
 * 在 /people/xxx/ 下 ../fonts/ 会 404，所以必须走根绝对路径。
 */
const BASE_PATH = (process.env.BASE_PATH ?? '/').replace(/\/$/, '');
/** 生成 CSS 时用的路径前缀（与上面同名，避免模板里到处 replace） */
const basePath = BASE_PATH;

/**
 * 字重方案：该版本只有 Light/Regular/Medium，没有 Bold。
 * - regular(400) → 正文，全字表
 * - medium(500)  → 标题与强调，仅标题字表
 *
 * 缺源文件时跳过该字重，不中断流程。
 */
const WEIGHTS = [
  {
    source: join(CACHE, 'LXGWWenKai-Regular.ttf'),
    remote: 'LXGWWenKai-Regular.ttf',
    weight: 400,
    name: 'regular',
    /** 全字表：正文任意字符都可能出现 */
    scope: 'all',
  },
  {
    source: join(CACHE, 'LXGWWenKai-Medium.ttf'),
    remote: 'LXGWWenKai-Medium.ttf',
    weight: 500,
    name: 'medium',
    /** 标题字表：只有出现在标题/强调里的字才需要这个字重 */
    scope: 'display',
  },
] as const;

/* ------------------------------------------------------------------ *
 * 1. 收集项目实际展示的字符
 * ------------------------------------------------------------------ */

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) {
      if (!n.startsWith('.') && n !== 'node_modules') walk(p, out);
    } else {
      out.push(p);
    }
  }
  return out;
}

/** 只扫能产生**可见文本**的文件。不扫 .ts（注释与变量名不显示）、不扫 scripts。 */
const TEXT_ROOTS = ['src/content', 'src/pages', 'src/components', 'src/layouts'];
const TEXT_EXT = /\.(md|astro|vue|yaml)$/;

function textFiles(): string[] {
  const files: string[] = [];
  for (const r of TEXT_ROOTS) files.push(...walk(r));
  return files.filter((f) => TEXT_EXT.test(f));
}

/** 基础 ASCII：数字、字母、半角标点（动态拼接的年份、ID 等会用到） */
function baseCodepoints(): number[] {
  const out: number[] = [];
  for (let cp = 0x20; cp <= 0x7e; cp++) out.push(cp);
  // 常用中文标点与全角字符，防止运行时出现未覆盖字符
  out.push(
    0x3000, 0x3001, 0x3002, 0x300a, 0x300b, 0x300c, 0x300d, 0x300e, 0x300f,
    0x3010, 0x3011, 0x2018, 0x2019, 0x201c, 0x201d, 0x2014, 0x2026, 0x00b7,
    0xff01, 0xff08, 0xff09, 0xff0c, 0xff1a, 0xff1b, 0xff1f,
  );
  return out;
}

function collectAllCodepoints(): Set<number> {
  const set = new Set<number>();
  for (const f of textFiles()) {
    for (const ch of readFileSync(f, 'utf8')) {
      const cp = ch.codePointAt(0);
      if (cp !== undefined) set.add(cp);
    }
  }
  for (const cp of baseCodepoints()) set.add(cp);
  return set;
}

/**
 * 标题字表：只保留会以 font-weight 500+ 渲染的字符。
 *
 * 为什么不能按「全站字表」切 medium：
 * 正文 1832 字全部给 medium 会再来一个 428KB，首屏就是 875KB 字体，
 * 在移动端 1.6Mbps 下等于 4 秒白屏。而 medium 实际只服务标题，
 * 覆盖 349 字就够，体积直接降到 1/4。
 *
 * 覆盖来源：
 * - HTML 标签 h1–h6 / strong / b / th / dt / summary
 * - 已知以 semibold 渲染的类名（见 global.css 的 --fw-semibold 用法）
 * - Markdown 的 `#` 标题行与 `**强调**`（会编译成 h2/h3 与 strong）
 */
function collectDisplayCodepoints(): Set<number> {
  const set = new Set<number>();

  const TAG = /<(h[1-6]|strong|b|th|dt|summary)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const byClass =
    /<(?:span|div|a|p|dt|dd|li|button|h[1-6])\b[^>]*class="[^"]*(?:topbar__name|topbar__mark|stat__value|tl__title|tl__list-year|identity__seal|card__title|card__meta|section__title|eyebrow|people-group__title|btn|badge|seal|quote__cite)[^"]*"[^>]*>([\s\S]*?)<\//gi;
  const MD_HEADING = /^#{1,6}[ \t]+(.+)$/gm;
  const MD_STRONG = /\*\*([^*\n]+)\*\*/g;

  const push = (s: string) => {
    const plain = s.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ');
    for (const ch of plain) {
      const cp = ch.codePointAt(0);
      if (cp !== undefined) set.add(cp);
    }
  };

  for (const f of textFiles()) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(TAG)) push(m[2]);
    for (const m of text.matchAll(byClass)) push(m[1]);
    if (f.endsWith('.md')) {
      for (const m of text.matchAll(MD_HEADING)) push(m[1]);
      for (const m of text.matchAll(MD_STRONG)) push(m[1]);
    }
  }

  // 标题里出现数字年份、纪元标记的概率很高，基础集必须带上
  for (const cp of baseCodepoints()) set.add(cp);
  return set;
}

/* ------------------------------------------------------------------ *
 * 2. 用 subset-font（harfbuzz wasm）切子集
 * ------------------------------------------------------------------ */

async function buildSubset(
  source: string,
  name: string,
  cps: Set<number>,
): Promise<{ file: string; bytes: number; chars: number }> {
  const subsetFont = (await import('subset-font')).default;

  // subset-font 接收的是「文本」，不是码点数组；必须按码点升序，
  // 这样 harfbuzz 的 cmap 能压缩得更紧，产物体积更小。
  const text = String.fromCodePoint(...[...cps].sort((a, b) => a - b));
  const buf = readFileSync(source);
  const out = await subsetFont(buf, text, { targetFormat: 'woff2' });

  const file = `${name}.woff2`;
  writeFileSync(join(OUT_FONTS, file), out);

  return { file, bytes: out.length, chars: cps.size };
}

/* ------------------------------------------------------------------ *
 * 3. 下载源文件
 * ------------------------------------------------------------------ */

/**
 * 下载缺失的字体源文件。
 *
 * 为什么不把 46MB 的 TTF 提交进 git：
 * 仓库会被撑爆，且字体是「输入」而非「产物」——CI 每次构建都能重新下载。
 * 这里做带重试的下载，并校验体积，避免半截文件进缓存。
 */
async function ensureSource(source: string, remote: string, name: string): Promise<boolean> {
  const MIN_BYTES = 5 * 1024 * 1024; // 低于 5MB 视为不完整

  if (existsSync(source)) {
    const size = statSync(source).size;
    if (size >= MIN_BYTES) return true;
    console.warn(`[fonts] ${name} 文件不完整（${(size / 1024 / 1024).toFixed(1)}MB），重新下载`);
    rmSync(source, { force: true });
  }

  const url = `${FONT_BASE_URL}/${remote}`;
  mkdirSync(CACHE, { recursive: true });

  console.log(`[fonts] 下载 ${name}…（约 23MB，只需一次）`);

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < MIN_BYTES) {
        throw new Error(`下载不完整：仅 ${(buf.length / 1024 / 1024).toFixed(1)}MB`);
      }
      writeFileSync(source, buf);
      console.log(`         → ${(buf.length / 1024 / 1024).toFixed(1)}MB`);
      return true;
    } catch (e) {
      console.warn(`[fonts] 第 ${attempt} 次下载失败：${e instanceof Error ? e.message : e}`);
      if (attempt === 2) {
        console.error(`[fonts] ${name} 下载失败，跳过该字重`);
        return false;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return false;
}

/* ------------------------------------------------------------------ *
 * 主流程
 * ------------------------------------------------------------------ */

async function main() {
  const available: (typeof WEIGHTS)[number][] = [];
  for (const w of WEIGHTS) {
    if (await ensureSource(w.source, w.remote, w.name)) available.push(w);
  }

  if (available.length === 0) {
    console.error('[fonts] 没有可用源文件，构建中止。');
    console.error(`  手动下载地址：${FONT_BASE_URL}`);
    process.exit(1);
  }

  const all = collectAllCodepoints();
  console.log(`[fonts] 全字表 ${all.size} 个字符`);
  // 只有需要 medium 时才扫描标题字表（省一次全量正则）
  const display = available.some((w) => w.scope === 'display')
    ? collectDisplayCodepoints()
    : new Set<number>();
  if (display.size > 0) console.log(`[fonts] 标题字表 ${display.size} 个字符`);

  // 清空旧产物
  if (existsSync(OUT_FONTS)) {
    for (const n of readdirSync(OUT_FONTS)) {
      rmSync(join(OUT_FONTS, n), { recursive: true, force: true });
    }
  }
  mkdirSync(OUT_FONTS, { recursive: true });

  const faces: Array<{ weight: number; file: string; bytes: number; chars: number }> = [];

  for (const w of available) {
    const cps = w.scope === 'display' ? display : all;
    console.log(`[fonts] 处理 ${w.name} (${w.weight}, ${cps.size} 字)…`);
    const r = await buildSubset(w.source, w.name, cps);
    faces.push({ weight: w.weight, ...r });
    console.log(`         → ${r.file}  ${(r.bytes / 1024).toFixed(0)} KB`);
  }

  /* ---------------- 生成 CSS ---------------- */

  const total = faces.reduce((s, f) => s + f.bytes, 0);

  const lines: string[] = [
    '/* 由 scripts/build-fonts.ts 生成，请勿手改。',
    ' * 字体：霞鹜文楷 LXGW WenKai（SIL OFL 1.1）',
    ' * 已按项目实际字表切子集（harfbuzz hb-subset），非全字库。',
    ' * 400 覆盖全站字表；500 只覆盖标题/强调（体积约为前者的 1/4）。',
    ' * 重新生成：npm run fonts */',
    '',
  ];

  for (const f of faces) {
    // 关键：字体路径必须是**根绝对**（带 BASE_PATH），不能用 ../fonts/。
    // 因为样式可能被内联进 HTML（astro.config 的 inlineStylesheets）。
    // 内联后 CSS 不再有独立文件 URL，相对路径会相对**页面 URL** 解析——
    // /people/zhuge-liang/ 上的 ../fonts/ 会变成 /people/fonts/，直接 404。
    lines.push('@font-face {');
    lines.push(`  font-family: 'LXGW WenKai';`);
    lines.push(`  font-style: normal;`);
    lines.push(`  font-weight: ${f.weight};`);
    // swap：先出系统楷体，webfont 到达后再替换。
    // 首屏不被 428KB 阻塞，是移动端 LCP 从 6s 降下来的关键。
    lines.push(`  font-display: swap;`);
    lines.push(`  src: url('${basePath}/fonts/${f.file}') format('woff2');`);
    lines.push('}');
    lines.push('');
  }

  mkdirSync('src/styles', { recursive: true });
  writeFileSync(OUT_CSS, lines.join('\n'), 'utf8');

  /* ---------------- 报告 ---------------- */

  console.log('');
  console.log(`[fonts] 产物：${faces.length} 个 woff2，合计 ${(total / 1024).toFixed(0)} KB`);
  for (const f of faces) {
    console.log(`        ${f.weight}: ${f.file} / ${(f.bytes / 1024).toFixed(0)} KB / ${f.chars} 字`);
  }
  console.log(`[fonts] CSS：${OUT_CSS}`);
}

main().catch((e) => {
  console.error('[fonts] 失败：', e);
  process.exit(1);
});
