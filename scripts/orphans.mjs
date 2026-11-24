/**
 * 打印两类缺口：
 *   1. 未出现在任何事件 participants 里的人物
 *   2. 没有任何参与者的事件
 *
 * 这两个数字写在 docs/PENDING-FEATURES.md 的 P7 一节里，
 * 但那份文档不可能实时更新。要看当下实况就跑这个。
 *
 * 用法：node scripts/orphans.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'src', 'content');

function read(p) {
  return readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
}

const eventFiles = readdirSync(join(ROOT, 'events')).filter((f) => f.endsWith('.md'));
const peopleFiles = readdirSync(join(ROOT, 'people')).filter((f) => f.endsWith('.md'));

const participated = new Set();
const eventsWithoutParticipants = [];

for (const f of eventFiles) {
  const text = read(join(ROOT, 'events', f));
  const ids = [...text.matchAll(/personId:\s*(\S+)/g)].map((m) => m[1]);
  if (ids.length === 0) {
    const id = text.match(/^id:\s*(\S+)/m)?.[1] ?? f;
    const title = text.match(/^title:\s*(.+)$/m)?.[1]?.trim() ?? '';
    eventsWithoutParticipants.push({ id, title });
  }
  for (const id of ids) participated.add(id);
}

const peopleWithoutEvents = [];
for (const f of peopleFiles) {
  const text = read(join(ROOT, 'people', f));
  const id = text.match(/^id:\s*(\S+)/m)?.[1] ?? f.replace(/\.md$/, '');
  if (participated.has(id)) continue;
  const name = text.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? '';
  const polity = text.match(/^polityIds:\n[ \t]+-\s*(\S+)/m)?.[1] ?? '';
  peopleWithoutEvents.push({ id, name, polity });
}

console.log(`事件 ${eventFiles.length} 条，人物 ${peopleFiles.length} 位\n`);

console.log(`== 没有任何参与者的事件：${eventsWithoutParticipants.length} 条 ==`);
for (const e of eventsWithoutParticipants) console.log(`  ${e.id.padEnd(30)} ${e.title}`);

console.log(`\n== 未出现在任何事件的人物：${peopleWithoutEvents.length} 位 ==`);
for (const p of peopleWithoutEvents) {
  console.log(`  ${p.id.padEnd(30)} ${p.name}（${p.polity}）`);
}

if (eventsWithoutParticipants.length === 0 && peopleWithoutEvents.length === 0) {
  console.log('\n两类缺口均为零。');
}
