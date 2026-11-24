import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * 给「评价存在真实分歧」的人物补 `disputed: true`。
 *
 * 判据：evaluations 里 kind: dispute 的条目 ≥ 2 条，且引用了 ≥ 2 个不同书目。
 * 单条 dispute 往往只是「补充一面」，两条以上来自不同书的分歧才算真的「评价不一」。
 *
 * 为什么要填：people/[id].astro:173 有 `person.disputed && (...)` 的渲染分支，
 * 但 274 人全部是默认 false，那个分支从未触发过。
 */
const DIR = 'src/content/people';
let added = 0;

for (const f of readdirSync(DIR)) {
  if (!f.endsWith('.md')) continue;
  const path = `${DIR}/${f}`;
  let t = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

  const m = t.match(/^evaluations:\n([\s\S]*?)(?=^\S|\Z)/m);
  if (!m) continue;
  const blocks = m[1].split(/(?=^\s*-\s+claim:)/m).filter((b) => b.trim().startsWith('-'));
  const disputes = blocks.filter((b) => /kind:\s*dispute/.test(b));
  const ids = new Set(disputes.map((b) => (b.match(/sourceId:\s*(\S+)/) || [])[1]).filter(Boolean));

  if (!(disputes.length >= 2 && ids.size >= 2)) continue;

  if (/^disputed:\s*true$/m.test(t)) continue;

  if (/^disputed:\s*\S+$/m.test(t)) {
    t = t.replace(/^disputed:\s*\S+$/m, 'disputed: true');
  } else {
    const closeIdx = t.indexOf('\n---\n', 3);
    if (closeIdx < 0) { console.log(`✗ 无闭合: ${f}`); continue; }
    t = t.slice(0, closeIdx) + '\ndisputed: true' + t.slice(closeIdx);
  }

  writeFileSync(path, t, 'utf8');
  added++;
}
console.log(`标记 ${added} 位`);
