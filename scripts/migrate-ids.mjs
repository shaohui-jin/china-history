/**
 * 一次性迁移：给人物与事件 id 加政权前缀。
 *
 * 用法：
 *   node scripts/migrate-ids.mjs           # dry-run，只打印映射与统计
 *   node scripts/migrate-ids.mjs --write   # 落盘
 *
 * 规则：新 id = polityIds[0] + '-' + 旧 id（若旧 id 已带该前缀则不动）。
 * 冲突：两个旧 id 映射到同一新 id 时中止，不写任何文件。
 * 替换：按完整 token 边界，避免 wang-jian 误伤 wang-jian-nanqi。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'src', 'content');
const WRITE = process.argv.includes('--write');

/**
 * 手工指定：默认规则会产出语义重复的 id，这里覆盖。
 * `beiwei-split` 加 northern-wei 前缀会变成 northern-wei-beiwei-split，
 * 「北魏」出现两次。
 */
const OVERRIDES = {
  'beiwei-split': 'northern-wei-split',
};

function readFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : null;
}

function pick(raw, key) {
  const m = raw.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return m ? m[1].trim() : null;
}

function firstPolity(raw) {
  const m = raw.match(/^polityIds:\s*\n((?:[ \t]+-.*\n?)+)/m);
  if (!m) return null;
  const line = m[1].split('\n').find((l) => /^[ \t]+-/.test(l));
  return line ? line.replace(/^[ \t]+-\s*/, '').trim() : null;
}

/** 收集映射 */
function buildMap(collection) {
  const dir = join(ROOT, collection);
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  const map = new Map(); // oldId -> newId
  const byFile = new Map(); // oldId -> filename
  const collisions = [];

  for (const f of files) {
    const text = readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n');
    const raw = readFrontmatter(text);
    if (!raw) continue;
    const id = pick(raw, 'id');
    const pol = firstPolity(raw);
    if (!id) continue;
    if (!pol) {
      collisions.push(`${collection}/${f}: 无 polityIds，无法确定前缀`);
      continue;
    }
    const newId = OVERRIDES[id] ?? (id.startsWith(`${pol}-`) ? id : `${pol}-${id}`);
    map.set(id, newId);
    byFile.set(id, f);
  }

  // 目标冲突
  const seen = new Map();
  for (const [oldId, newId] of map) {
    if (seen.has(newId)) {
      collisions.push(`冲突: ${seen.get(newId)} 与 ${oldId} 都映射到 ${newId}`);
    }
    seen.set(newId, oldId);
  }
  // 新 id 与原 id 撞车（旧 id 里已存在同名的另一条）
  for (const [oldId, newId] of map) {
    if (newId !== oldId && map.has(newId) && map.get(newId) !== newId) {
      collisions.push(`链式冲突: ${oldId} -> ${newId}，而 ${newId} 本身也要改成 ${map.get(newId)}`);
    }
  }
  return { map, byFile, collisions, count: files.length };
}

const people = buildMap('people');
const events = buildMap('events');

console.log('=== 人物 ===');
console.log('文件数:', people.count, '需改名:', [...people.map].filter(([a, b]) => a !== b).length);
console.log('=== 事件 ===');
console.log('文件数:', events.count, '需改名:', [...events.map].filter(([a, b]) => a !== b).length);

const allCollisions = [...people.collisions, ...events.collisions];
if (allCollisions.length) {
  console.log('\n!!! 冲突，中止 !!!');
  for (const c of allCollisions) console.log('  ' + c);
  process.exit(1);
}
console.log('\n无冲突。');

// 输出映射样本
if (!WRITE) {
  console.log('\n--- 人物映射样本（前 25）---');
  let i = 0;
  for (const [a, b] of people.map) {
    if (a === b) continue;
    console.log(`  ${a.padEnd(28)} -> ${b}`);
    if (++i >= 25) break;
  }
  console.log('\n--- 事件映射样本（前 25）---');
  i = 0;
  for (const [a, b] of events.map) {
    if (a === b) continue;
    console.log(`  ${a.padEnd(28)} -> ${b}`);
    if (++i >= 25) break;
  }
  console.log('\n这是 dry-run。加 --write 落盘。');
  process.exit(0);
}

// ---------------- 落盘 ----------------
const allMap = new Map([...people.map, ...events.map]);
const renamed = [...allMap].filter(([a, b]) => a !== b);
console.log('\n落盘：', renamed.length, '个 id');

/** 按完整 token 替换。长 id 先替换，避免短 id 抢先匹配 */
const ordered = renamed.slice().sort((a, b) => b[0].length - a[0].length);

/**
 * 单遍替换：每次扫描原文，取最左命中，命中后跳过整段已替换内容。
 *
 * 为什么不能对每个 id 各跑一遍 replaceTokens：替换出的新 id 可能又包含
 * 另一个待替换的旧 id（如 tang-an-lushan 内含 an-lushan），第二遍会二次改写。
 * 单遍扫描保证每个位置只处理一次。
 */
function replaceAllTokens(text, pairs) {
  // 建索引：起点字符 → 候选
  const byFirst = new Map();
  for (const [from, to] of pairs) {
    const c = from[0];
    if (!byFirst.has(c)) byFirst.set(c, []);
    byFirst.get(c).push([from, to]);
  }
  for (const arr of byFirst.values()) arr.sort((a, b) => b[0].length - a[0].length);

  const B = /[A-Za-z0-9_-]/;
  let out = '';
  let i = 0;
  while (i < text.length) {
    const cands = byFirst.get(text[i]);
    if (!cands) { out += text[i++]; continue; }
    let hit = null;
    for (const [from, to] of cands) {
      if (!text.startsWith(from, i)) continue;
      const before = i > 0 ? text[i - 1] : '';
      const after = text[i + from.length] ?? '';
      if ((!before || !B.test(before)) && (!after || !B.test(after))) { hit = [from, to]; break; }
    }
    if (hit) { out += hit[1]; i += hit[0].length; }
    else { out += text[i++]; }
  }
  return out;
}

/** 1) 改文件名与 frontmatter 的 id */
for (const collection of ['people', 'events']) {
  const dir = join(ROOT, collection);
  const { map, byFile } = collection === 'people' ? people : events;
  for (const [oldId, newId] of map) {
    if (oldId === newId) continue;
    const oldFile = join(dir, byFile.get(oldId));
    const newFile = join(dir, `${newId}.md`);
    if (!existsSync(oldFile)) { console.log('缺文件', oldFile); continue; }
    let text = readFileSync(oldFile, 'utf8');
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    // 只改 frontmatter 里的 id: 行
    const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (fmMatch) {
      const fm = fmMatch[1].replace(/^id:\s*.*$/m, `id: ${newId}`);
      text = text.replace(fmMatch[1], fm);
    }
    writeFileSync(oldFile, text, 'utf8');
    renameSync(oldFile, newFile);
  }
}
console.log('文件名与 id 已更新');

/** 2) 全库替换引用 */
const targets = [];
for (const sub of ['people', 'events', 'sources', 'polities']) {
  const dir = join(ROOT, sub);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) {
    if (f.endsWith('.md') || f.endsWith('.yaml')) targets.push(join(dir, f));
  }
}
let touched = 0;
for (const p of targets) {
  let text = readFileSync(p, 'utf8');
  const before = text;
  text = replaceAllTokens(text, ordered);
  if (text !== before) { writeFileSync(p, text, 'utf8'); touched++; }
}
console.log('引用替换涉及文件:', touched);
console.log('\n完成。请跑 npm run validate 复核。');
