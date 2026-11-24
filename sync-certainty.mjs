import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * 给有 disputes 的事件补 `certainty: disputed`。
 *
 * 为什么要联动：事件页有「史料有异说」徽章，判据是 certainty === 'disputed'。
 * 但 certainty 与 disputes 是两个独立字段，人工填一处容易漏另一处——
 * 之前 100 条事件里 certainty 全是默认值，徽章从未出现过。
 *
 * 这里的规则：**disputes 非空 → certainty 必须是 disputed**。
 * validate 里也加了同样的检查，防止以后写反。
 */
const DIR = 'src/content/events';
let added = 0;

for (const f of readdirSync(DIR)) {
  if (!f.endsWith('.md')) continue;
  const path = `${DIR}/${f}`;
  let t = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

  const hasDisputes = /^disputes:\n(?:[ \t]+-\s+\S.*\n?)+/m.test(t);
  if (!hasDisputes) continue;

  // 已有 certainty 则跳过（可能已手工设过）
  if (/^certainty:/m.test(t)) {
    const cur = t.match(/^certainty:\s*(\S+)/m)[1];
    if (cur !== 'disputed') {
      t = t.replace(/^certainty:\s*\S+$/m, 'certainty: disputed');
      writeFileSync(path, t, 'utf8');
      console.log(`✓ 改 ${f} (${cur} → disputed)`);
      added++;
    }
    continue;
  }

  // 插在最后一行 frontmatter 之前（即闭合 --- 之前）
  const closeIdx = t.indexOf('\n---\n', 3);
  if (closeIdx < 0) { console.log(`✗ 无闭合: ${f}`); continue; }
  t = t.slice(0, closeIdx) + '\ncertainty: disputed' + t.slice(closeIdx);

  writeFileSync(path, t, 'utf8');
  console.log(`✓ ${f}`);
  added++;
}
console.log(`\n补充 ${added} 条`);
