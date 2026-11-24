/**
 * 内容深度检查：按 significance 核算正文字数与小节完整性。
 *
 * 为什么单独一个脚本而不并进 validate-content.ts：
 * validate 管的是「引用是否断了」这类硬错误，一错就该拦。
 * 深度是渐进改善指标，一上来 54 条不达标，混进 error 会让 CI 直接红掉。
 * 所以拆成独立命令 `npm run depth`，输出清单但不阻断构建。
 *
 * 标准（见 docs/CONTENT-SCHEMA.md）：
 *   sig=5 → 正文 ≥ 800 字，需含「背景 / 经过 / 影响 / 争议」四节
 *   sig=4 → 正文 ≥ 500 字，需含「背景 / 经过 / 影响」三节
 *   sig≤3 → 不强制
 *
 * 运行：node scripts/check-depth.ts [--strict]
 *   --strict  不达标也返回非零退出码（供将来收紧 CI 用）
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'src', 'content');
const STRICT = process.argv.includes('--strict');

interface Row {
  kind: 'event' | 'person';
  id: string;
  sig: number;
  chars: number;
  /** 人物：正文 + 带出处评价的字数（评价也渲染在页面上，是实际内容量） */
  totalChars?: number;
  needChars: number;
  missingSections: string[];
  needSections: string[];
  /** 人物：带出处的评价条数 */
  evalCount?: number;
}

/** 取正文（去 frontmatter），并把 CRLF 归一 */
function bodyOf(path: string): string {
  const raw = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return m ? m[1].trim() : '';
}

/**
 * 正文字数：去掉 markdown 语法与脚注标记后数中文字符。
 *
 * 不用 `length` 直接算，因为：
 * - `[[person:xxx]]` 是引用不是内容，展开后才有字
 * - `[^source]` 是标记不是字数
 * - 空白与换行不算
 */
function countChars(body: string): number {
  const cleaned = body
    .replace(/\[\^[a-z0-9-]+(?:\|[^\]]+)?\]/g, '')
    .replace(/\[\[[a-z]+:([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (_m, id, label) => label ?? id)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>]/g, '');
  // 只数「可见字符」：汉字、字母数字、标点，不算空白
  return cleaned.replace(/\s/g, '').length;
}

/** 事件必备小节 */
const SECTION_RULES: Record<number, string[]> = {
  5: ['背景', '经过', '影响', '争议'],
  4: ['背景', '经过', '影响'],
  // sig=3 也要有「经过」。此前脚本只定义 5 和 4，文档却写着 sig=3 需「经过」，
  // 于是 3 条 sig=3 事件长期缺这一节而无人发现。
  3: ['经过'],
};

function findSections(body: string): Set<string> {
  const found = new Set<string>();
  const re = /^#{2,3}\s*(背景|经过|影响|争议|生平|评价)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) found.add(m[1]);
  return found;
}

const rows: Row[] = [];

for (const f of readdirSync(join(ROOT, 'events'))) {
  if (!f.endsWith('.md')) continue;
  const raw = readFileSync(join(ROOT, 'events', f), 'utf8');
  const sigM = raw.match(/significance:\s*(\d)/);
  if (!sigM) continue;
  const sig = Number(sigM[1]);
  const needChars = sig >= 5 ? 800 : sig >= 4 ? 500 : 0;
  const needSections = SECTION_RULES[sig] ?? [];
  const body = bodyOf(join(ROOT, 'events', f));
  const chars = countChars(body);
  const sections = findSections(body);
  rows.push({
    kind: 'event',
    id: f.replace(/\.md$/, ''),
    sig,
    chars,
    needChars,
    needSections,
    missingSections: needSections.filter((s) => !sections.has(s)),
  });
}

for (const f of readdirSync(join(ROOT, 'people'))) {
  if (!f.endsWith('.md')) continue;
  const raw = readFileSync(join(ROOT, 'people', f), 'utf8').replace(/\r\n/g, '\n');
  // 人物不按 sig 分级，统一以 600 字为「有实质内容」的软门槛
  const body = bodyOf(join(ROOT, 'people', f));
  const chars = countChars(body);

  // 带出处的评价也渲染在页面上，属于实际内容，须计入字数。
  // 只截取 evaluations: 到下一个顶层键之间的文本，避免把 relations 等算进来。
  const evalBlock = raw.match(/^evaluations:\n([\s\S]*?)(?=^\S|\Z)/m)?.[1] ?? '';
  const evalChars = countChars(evalBlock);

  // 评价条数：只数 `- claim:` 列表项，避免正文里的同名词干扰
  const evalCount = (evalBlock.match(/^\s*-\s*claim:/gm) ?? []).length;

  rows.push({
    kind: 'person',
    id: f.replace(/\.md$/, ''),
    sig: 0,
    chars,
    totalChars: chars + evalChars,
    needChars: 600,
    needSections: [],
    missingSections: [],
    evalCount,
  });
}

/* ---------------- 报告 ---------------- */

const failChars = rows.filter(
  (r) => r.needChars > 0 && (r.kind === 'person' ? (r.totalChars ?? 0) : r.chars) < r.needChars,
);
const failSections = rows.filter((r) => r.missingSections.length > 0);

console.log('');
console.log('=== 内容深度检查 ===');
console.log('');

for (const sig of [5, 4]) {
  const g = rows.filter((r) => r.kind === 'event' && r.sig === sig);
  const bad = g.filter((r) => r.chars < r.needChars);
  const need = sig === 5 ? 800 : 500;
  console.log(
    `sig=${sig}: ${g.length} 条，要求 ≥${need} 字，不达标 ${bad.length} 条`,
  );
  bad
    .sort((a, b) => a.chars - b.chars)
    .slice(0, 12)
    .forEach((r) => {
      const missing = r.missingSections.length ? `  缺节: ${r.missingSections.join('/')}` : '';
      console.log(`   ${String(r.chars).padStart(4)} / ${need}  ${r.id}${missing}`);
    });
  if (bad.length > 12) console.log(`   … 另有 ${bad.length - 12} 条`);
}

const thinPeople = rows
  .filter((r) => r.kind === 'person' && (r.totalChars ?? 0) < r.needChars)
  .sort((a, b) => (a.totalChars ?? 0) - (b.totalChars ?? 0));
console.log('');
console.log(`人物: ${rows.filter((r) => r.kind === 'person').length} 条，<600 字 ${thinPeople.length} 条`);
console.log('（字数 = 正文 + 带出处评价；评价也渲染在页面上）');
thinPeople
  .slice(0, 10)
  .forEach((r) =>
    console.log(`   ${String(r.totalChars).padStart(4)}  ${r.id}  正文 ${r.chars}`),
  );
if (thinPeople.length > 10) console.log(`   … 另有 ${thinPeople.length - 10} 条`);

const noEval = rows.filter((r) => r.kind === 'person' && (r.evalCount ?? 0) === 0);
console.log('');
console.log(`人物评价: 带出处评价为 0 条的人物 ${noEval.length} 条`);

const missSec = failSections.filter((r) => r.kind === 'event');
if (missSec.length > 0) {
  console.log('');
  console.log(`事件缺小节: ${missSec.length} 条`);
  missSec.slice(0, 12).forEach((r) =>
    console.log(`   sig=${r.sig}  ${r.id}  缺: ${r.missingSections.join('/')}`),
  );
  if (missSec.length > 12) console.log(`   … 另有 ${missSec.length - 12} 条`);
}

console.log('');
console.log('---');
console.log(`字数不达标合计: ${failChars.length} 条`);
console.log(`缺小节合计:     ${failSections.length} 条`);

if (STRICT && (failChars.length > 0 || failSections.length > 0)) {
  console.log('');
  console.error('strict 模式：存在不达标项，退出码 1');
  process.exit(1);
} else if (failChars.length > 0 || failSections.length > 0) {
  console.log('（非 strict 模式，仅报告不阻断）');
}
console.log('');
