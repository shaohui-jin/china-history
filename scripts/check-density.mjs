/**
 * 事件密度报告：按世纪列出事件条数。
 *
 * 为什么是「报告」而不是「检查」：
 * 这里原本有一条验收标准「每个世纪 ≥ 4 条」，并带 `--strict` 退出码。
 * 2026-11 取消：历史事件在史料里本来就不是均匀分布的 —— 先秦两千年
 * 留下的可考节点远少于明清，而近代一段（1912–1949）只有几十年。
 * 硬凑配额只会逼人为了凑数写没有史料支撑的条目，与本项目
 * 「没有出处不写进正文」的第一原则直接冲突。
 *
 * 所以本脚本现在只回答一个问题：**哪些世纪的材料还很薄**。
 * 薄不等于欠账，它只是提示「这几段如果要继续补，该往哪找史料」。
 *
 * 世纪编号约定：前 N 世纪为负数，公元 N 世纪为正数，没有 0 世纪。
 *   前 221 年 → 前 3 世纪 → -3
 *   公元 1 年 → 1 世纪 → 1
 * 这套约定与 src/lib/time.ts 的 centuryOf 一致。
 *
 * 运行：node scripts/check-density.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content', 'events');

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

const counts = all.map((c) => ({ c, n: byCentury.get(c)?.length ?? 0 }));
const empty = counts.filter((x) => x.n === 0);
const thin = counts
  .filter((x) => x.n > 0 && x.n <= 2)
  .sort((a, b) => a.n - b.n)
  .slice(0, 8);

console.log('');
console.log('=== 事件密度报告（覆盖率，非验收）===');
console.log('');
console.log(
  `${rows.length} 条事件，跨 ${all.length} 个世纪，平均 ${(rows.length / all.length).toFixed(1)} 条/世纪`,
);
console.log(`最密：${Math.max(...counts.map((x) => x.n))} 条/世纪；最疏：${Math.min(...counts.map((x) => x.n))} 条/世纪`);

if (empty.length) {
  console.log('');
  console.log(`尚无事件：${empty.length} 个世纪 → ${empty.map((x) => label(x.c)).join('、')}`);
}

if (thin.length) {
  console.log('');
  console.log('事件最少的世纪（≤2 条）：');
  for (const t of thin) {
    const ids = byCentury.get(t.c).map((r) => r.id);
    console.log(`  ${label(t.c).padStart(9)}  ${t.n} 条  ${ids.join(', ')}`);
  }
}

console.log('');
console.log('（本表不设达标线。稀疏段的成因与可补方向见 docs/PENDING-FEATURES.md 的 U3）');
console.log('');
