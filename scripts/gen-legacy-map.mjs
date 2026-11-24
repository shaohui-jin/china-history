/**
 * 生成旧 id → 新 id 的映射表，供 legacy 跳转页使用。
 *
 * 配对方式：用 `name:`（中文名）作为键。迁移只改 id 与引用，
 * 不改 name，所以中文名是稳定的。人物名在库内唯一（已核查 0 组重名）。
 * 事件没有 name 字段，用 title。
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

function keyOf(text, collection) {
  const field = collection === 'events' ? 'title' : 'name';
  const m = text.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
  return m ? m[1].trim() : null;
}

function collect(files, getText, collection) {
  const map = new Map();
  const dup = [];
  for (const { name, text } of files) {
    const id = text.match(/^id:\s*(\S+)/m)?.[1];
    if (!id) continue;
    const k = keyOf(text, collection);
    if (!k) continue;
    if (map.has(k)) dup.push(k);
    map.set(k, id);
  }
  if (dup.length) console.error(`  !! ${collection} 键重复:`, dup.slice(0, 5).join(', '));
  return { map, dupCount: dup.length };
}

const result = {};
for (const col of ['people', 'events']) {
  const skipped = [];
  const oldFiles = execSync(`git ls-tree -r --name-only master -- src/content/${col}`, {
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({
      name: f,
      text: execSync(`git show master:${f}`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }),
    }));

  const dir = join(ROOT, 'src', 'content', col);
  const newFiles = readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ name: f, text: readFileSync(join(dir, f), 'utf8') }));

  const before = collect(oldFiles, null, col);
  const after = collect(newFiles, null, col);
  console.log(col, 'old:', before.map.size, 'new:', after.map.size, 'dupKey:', before.dupCount);

  const pairs = [];
  let unmatched = 0;
  for (const [k, oldId] of before.map) {
    const newId = after.map.get(k);
    // 已删除的条目（如合并的重复项）不再生成跳转
    if (!newId) { skipped.push(oldId); continue; }
    if (newId !== oldId) pairs.push([oldId, newId]);
  }
  if (skipped.length) console.log('  已删除/合并的旧条目（不生成跳转）:', skipped.join(', '));
  result[col] = pairs;
  console.log('  实际改名:', pairs.length);
}

const body = `/**
 * 旧 id → 新 id 映射（自动生成，勿手改）。
 *
 * 由 scripts/gen-legacy-map.mjs 生成。用途：id 加朝代前缀后，
 * 旧 URL /people/<old>/ 仍可访问，跳转到新路径。
 *
 * 何时可以删：确认旧链接不再有访问后，删掉本文件与
 * src/pages/people/legacy/、src/pages/events/legacy/ 即可。
 */
export const legacyPeopleIds: Record<string, string> = {
${result.people.map(([o, n]) => `  '${o}': '${n}',`).join('\n')}
};

export const legacyEventIds: Record<string, string> = {
${result.events.map(([o, n]) => `  '${o}': '${n}',`).join('\n')}
};
`;

writeFileSync(join(ROOT, 'src', 'lib', 'legacy-ids.ts'), body, 'utf8');
console.log('\n已写入 src/lib/legacy-ids.ts');
console.log('人物', result.people.length, '事件', result.events.length);
