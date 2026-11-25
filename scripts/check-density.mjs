/**
 * 事件密度检查：按世纪统计事件数，找出「不足 4 条」的世纪。
 *
 * 为什么单独一个脚本：
 * U3 的验收标准是「每个世纪 ≥ 4 条」，但这条没法并进 validate ——
 * validate 管的是引用完整性（一错就该拦），密度是覆盖率指标，
 * 缺几条不该让 CI 红。
 *
 * 世纪编号约定：前 N 世纪为负数，公元 N 世纪为正数，没有 0 世纪。
 *   前 221 年 → 前 3 世纪 → -3
 *   公元 1 年 → 1 世纪 → 1
 * 这套约定与 src/lib/time.ts 的 centuryOf 一致。
 *
 * 运行：node scripts/check-density.mjs [--strict]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content', 'events');
const STRICT = process.argv.includes('--strict');
const MIN_PER_CENTURY = 4;

/** 前 N 世纪 → -N；公元 N 世纪 → N */
function centuryOf(year) {
  return year > 0 ? Math.floor((year - 1) / 100) + 1 : -Math.ceil(-year / 100);
}

function label(c) {
  return c > 0 ? `${c} 世纪` : `前 ${-c} 世纪`;
}

/** 取 frontmatter 里 time.from.year */
function yearOf(raw) {
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return null;
  const m = fm[1].match(/time:\s*\n\s+from:\s*\n\s+year:\s*(-?\d+)/);
  return m ? Number(m[1]) : null;
}

const rows = [];
for (const f of readdirSync(ROOT)) {
  if (!f.endsWith('.md')) continue;
  const y = yearOf(readFileSync(join(ROOT, f), 'utf8').replace(/\r\n/g, '\n'));
  if (y !== null) rows.push({ id: f.replace(/\.md$/, ''), year: y });
}

if (rows.length === 0) {
  console.log('没有找到任何带 time.from.year 的事件');
  process.exit(0);
}

const byCentury = new Map();
for (const r of rows) {
  const c = centuryOf(r.year);
  if (!byCentury.has(c)) byCentury.set(c, []);
  byCentury.get(c).push(r);
}

const keys = [...byCentury.keys()].sort((a, b) => a - b);
const all = [];
for (let c = keys[0]; c <= keys[keys.length - 1]; c++) {
  if (c !== 0) all.push(c); // 不存在 0 世纪
}

const thin = [];
const empty = [];
for (const c of all) {
  const n = byCentury.get(c)?.length ?? 0;
  if (n === 0) empty.push(c);
  else if (n < MIN_PER_CENTURY) thin.push({ c, n, ids: byCentury.get(c).map((r) => r.id) });
}

console.log('');
console.log('=== 事件密度检查 ===');
console.log('');
console.log(
  `${rows.length} 条事件，跨 ${all.length} 个世纪，平均 ${(rows.length / all.length).toFixed(1)} 条/世纪`,
);
console.log(`要求：每个世纪 ≥ ${MIN_PER_CENTURY} 条`);

if (empty.length) {
  console.log('');
  console.log(`完全空白：${empty.length} 个 → ${empty.map(label).join('、')}`);
}

if (thin.length) {
  console.log('');
  console.log(`不足 ${MIN_PER_CENTURY} 条：${thin.length} 个`);
  for (const t of thin) {
    console.log(`  ${label(t.c).padStart(9)}  ${String(t.n).padStart(2)} 条  ${t.ids.join(', ')}`);
  }
}

const ok = all.length - empty.length - thin.length;
console.log('');
console.log(`达标：${ok} / ${all.length} 个世纪`);

const fail = empty.length + thin.length;
if (STRICT && fail > 0) {
  console.log('');
  console.error(`strict 模式：${fail} 个世纪不达标，退出码 1`);
  process.exit(1);
}
console.log('');
