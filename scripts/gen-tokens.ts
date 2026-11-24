/**
 * tokens.ts → tokens.generated.css
 *
 * CSS 通道：把设计令牌输出成 CSS 变量，供全站样式消费。
 * 目前只有一套风格（classical），因此只生成一个主题块；
 * 变量仍挂在 [data-theme='classical'] 上，保留未来加风格的结构。
 *
 * 运行：node scripts/gen-tokens.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  color,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  space,
  radius,
  shadow,
  duration,
  easing,
  breakpoint,
  layout,
  control,
  themes,
  DEFAULT_THEME,
} from '../src/design/tokens.ts';

const OUT = resolve(import.meta.dirname, '../src/styles/tokens.generated.css');

/** camelCase / 数字 key → kebab 变量后缀 */
const kebab = (k: string) => k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

function primitiveVars(): string {
  const lines: string[] = [];

  // 色板：--xuan-0, --mosong-900 ...（只输出实际使用的）
  for (const [group, scale] of Object.entries(color)) {
    if (typeof scale === 'string') {
      lines.push(`  --${group}: ${scale};`);
      continue;
    }
    for (const [step, value] of Object.entries(scale)) {
      lines.push(`  --${group}-${step}: ${value};`);
    }
  }

  for (const [k, v] of Object.entries(fontSize)) lines.push(`  --fs-${k}: ${v};`);
  for (const [k, v] of Object.entries(fontWeight)) lines.push(`  --fw-${k}: ${v};`);
  for (const [k, v] of Object.entries(lineHeight)) lines.push(`  --lh-${k}: ${v};`);
  for (const [k, v] of Object.entries(letterSpacing)) lines.push(`  --ls-${k}: ${v};`);
  for (const [k, v] of Object.entries(space)) lines.push(`  --sp-${k}: ${v};`);
  for (const [k, v] of Object.entries(radius)) lines.push(`  --radius-${k}: ${v};`);
  for (const [k, v] of Object.entries(shadow)) lines.push(`  --shadow-${k}: ${v};`);
  for (const [k, v] of Object.entries(duration)) lines.push(`  --dur-${k}: ${v};`);
  for (const [k, v] of Object.entries(easing)) lines.push(`  --ease-${k}: ${v};`);

  // 字体栈不在这里定义：由主题块输出，避免留一份会误导人的兜底值。

  // 断点（供 JS 读，媒体查询里仍写死数字）
  for (const [k, v] of Object.entries(breakpoint)) lines.push(`  --bp-${k}: ${v}px;`);

  // 布局
  lines.push(`  --container-prose: ${layout.container.prose};`);
  lines.push(`  --container-wide: ${layout.container.wide};`);
  lines.push(`  --container-full: ${layout.container.full};`);
  lines.push(`  --touch-target: ${layout.touchTarget};`);
  lines.push(`  --timeline-lane-h: ${layout.timeline.laneHeight};`);
  lines.push(`  --timeline-lane-gap: ${layout.timeline.laneGap};`);
  lines.push(`  --timeline-label-w: ${layout.timeline.laneLabelWidth};`);

  // 控件尺寸（三档高度 + 固定行高）
  lines.push(`  --control-sm: ${control.sm};`);
  lines.push(`  --control-md: ${control.md};`);
  lines.push(`  --control-lg: ${control.lg};`);
  lines.push(`  --control-lh: ${control.lineHeight};`);

  return lines.join('\n');
}

function themeBlock(): string {
  const theme = themes[DEFAULT_THEME];
  const vars = Object.entries(theme.semantic)
    .map(([key, value]) => `  --${kebab(key)}: ${value};`)
    .join('\n');

  // 字体栈：切换风格时整站正文字体跟着变
  const fonts = [
    `  --font-display: ${theme.fontFamily.display};`,
    `  --font-body: ${theme.fontFamily.body};`,
    `  --font-ui: ${theme.fontFamily.ui};`,
    `  --font-numeric: ${theme.fontFamily.numeric};`,
  ].join('\n');

  // 装饰令牌：风格的结构性差异（留白倍率、行距倍率、字距、圆角、竖排开关）
  const d = theme.decor;
  const decor = [
    `  --decor-space: ${d.spaceScale};`,
    `  --decor-line: ${d.lineScale};`,
    `  --decor-title-tracking: ${d.titleTracking};`,
    `  --decor-card-radius: ${d.cardRadius};`,
    `  --decor-vertical: ${d.verticalRhythm ? 1 : 0};`,
    // 派生值：供布局直接消费，避免组件里做乘法
    `  --sp-section: calc(var(--sp-16) * ${d.spaceScale});`,
    `  --lh-body: calc(var(--lh-relaxed) * ${d.lineScale});`,
  ].join('\n');

  // :root 也指向同一套值，这样即使 data-theme 未写入也不会无样式
  const sel = `:root, [data-theme='${theme.id}']`;

  return `/* ${theme.label}：${theme.note} */\n${sel} {\n  color-scheme: light;\n${vars}\n\n${fonts}\n\n${decor}\n}`;
}

const css = `/* 由 scripts/gen-tokens.ts 生成，请勿手改。改令牌请编辑 src/design/tokens.ts */

:root {
${primitiveVars()}
}

${themeBlock()}
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, css, 'utf8');
console.log(`[tokens] 已生成 ${OUT}（${css.split('\n').length} 行）`);
