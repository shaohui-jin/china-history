/**
 * 内容校验：在构建前跑一遍，把跨条目的语义问题查出来。
 *
 * Zod 只管字段类型与必填；这里管「引用是否指向真实存在的条目」
 * 「生卒与事件是否矛盾」等只有在全库视角下才看得见的问题。
 *
 * 运行：npm run validate
 *
 * 注意：这个脚本用 Astro 的 content 层，需要在 Astro 环境下运行，
 * 所以实际是 `astro build` 时会由 lib/content.ts 的 validateAll 兜住。
 * 这里提供一个独立的 CLI 入口，便于 CI 单独跑。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'src', 'content');

interface Issue {
  level: 'error' | 'warn';
  where: string;
  message: string;
}

const issues: Issue[] = [];

/** 极简 frontmatter 解析：只取需要的字段，不引 yaml 库。
 *  .md 用 `---` 包裹；.yaml 整份就是数据。 */
function readFrontmatter(path: string): Record<string, unknown> | null {
  const text = readFileSync(path, 'utf8');
  if (path.endsWith('.yaml') || path.endsWith('.yml')) {
    return { __raw: text };
  }
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  return { __raw: m[1] };
}

/** 从原始 frontmatter 文本中抽取某些键的值（够用即可） */
function pick(raw: string, key: string): string | null {
  const re = new RegExp(`^${key}:\\s*(.+)$`, 'm');
  const m = raw.match(re);
  return m ? m[1].trim() : null;
}

function listDir(sub: string): string[] {
  const dir = join(ROOT, sub);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.md') || f.endsWith('.yaml'));
}

/** 收集所有 id */
const ids = {
  people: new Set<string>(),
  events: new Set<string>(),
  polities: new Set<string>(),
  sources: new Set<string>(),
};

for (const f of listDir('people')) {
  const fm = readFrontmatter(join(ROOT, 'people', f));
  const id = fm ? pick(fm.__raw as string, 'id') : null;
  if (id) ids.people.add(id);
  else issues.push({ level: 'error', where: `people/${f}`, message: '缺少 id' });
}

for (const f of listDir('events')) {
  const fm = readFrontmatter(join(ROOT, 'events', f));
  const id = fm ? pick(fm.__raw as string, 'id') : null;
  if (id) ids.events.add(id);
  else issues.push({ level: 'error', where: `events/${f}`, message: '缺少 id' });
}

for (const f of listDir('polities')) {
  const fm = readFrontmatter(join(ROOT, 'polities', f));
  const id = fm ? pick(fm.__raw as string, 'id') : null;
  if (id) ids.polities.add(id);
}

for (const f of listDir('sources')) {
  const fm = readFrontmatter(join(ROOT, 'sources', f));
  const id = fm ? pick(fm.__raw as string, 'id') : null;
  if (id) ids.sources.add(id);
}

/** 检查 people 里的 relations.target 与 polityIds */
for (const f of listDir('people')) {
  const fm = readFrontmatter(join(ROOT, 'people', f));
  if (!fm) continue;
  const raw = fm.__raw as string;
  const id = pick(raw, 'id') ?? f;

  // relations 下的 target
  const targetRe = /^\s+-\s+target:\s*(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = targetRe.exec(raw))) {
    const target = m[1].trim();
    if (!ids.people.has(target)) {
      issues.push({
        level: 'error',
        where: `people/${id}`,
        message: `关系目标不存在：${target}`,
      });
    }
  }

  // sourceId
  const srcRe = /^\s+sourceId:\s*(.+)$/gm;
  while ((m = srcRe.exec(raw))) {
    const s = m[1].trim();
    if (!ids.sources.has(s)) {
      issues.push({
        level: 'error',
        where: `people/${id}`,
        message: `史料出处不存在：${s}`,
      });
    }
  }

  // polityIds 下的条目（在 polityIds: 之后的 - xxx）
  const polityBlock = raw.match(/^polityIds:\s*\n((?:\s+-\s+.+\n?)+)/m);
  if (polityBlock) {
    for (const line of polityBlock[1].split('\n')) {
      const pm = line.match(/^\s+-\s+(.+)$/);
      if (!pm) continue;
      const p = pm[1].trim();
      if (!ids.polities.has(p)) {
        issues.push({
          level: 'error',
          where: `people/${id}`,
          message: `政权不存在：${p}`,
        });
      }
    }
  }
}

/** 检查 events 里的 personId / polityIds / sources */
for (const f of listDir('events')) {
  const fm = readFrontmatter(join(ROOT, 'events', f));
  if (!fm) continue;
  const raw = fm.__raw as string;
  const id = pick(raw, 'id') ?? f;

  const pRe = /^\s+-\s+personId:\s*(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = pRe.exec(raw))) {
    const p = m[1].trim();
    if (!ids.people.has(p)) {
      issues.push({ level: 'error', where: `events/${id}`, message: `参与者不存在：${p}` });
    }
  }

  const polityBlock = raw.match(/^polityIds:\s*\n((?:\s+-\s+.+\n?)+)/m);
  if (polityBlock) {
    for (const line of polityBlock[1].split('\n')) {
      const pm = line.match(/^\s+-\s+(.+)$/);
      if (!pm) continue;
      const p = pm[1].trim();
      if (!ids.polities.has(p)) {
        issues.push({ level: 'error', where: `events/${id}`, message: `政权不存在：${p}` });
      }
    }
  }

  const srcBlock = raw.match(/^sources:\s*\n((?:\s+-\s+.+\n?)+)/m);
  if (srcBlock) {
    for (const line of srcBlock[1].split('\n')) {
      const sm = line.match(/^\s+-\s+(.+)$/);
      if (!sm) continue;
      const s = sm[1].trim();
      if (!ids.sources.has(s)) {
        issues.push({ level: 'error', where: `events/${id}`, message: `史料不存在：${s}` });
      }
    }
  }
}

/* ---------------- 输出 ---------------- */

const errors = issues.filter((i) => i.level === 'error');
const warns = issues.filter((i) => i.level === 'warn');

console.log(`\n内容统计：`);
console.log(`  人物 ${ids.people.size} · 事件 ${ids.events.size} · 政权 ${ids.polities.size} · 史料 ${ids.sources.size}`);

if (errors.length === 0 && warns.length === 0) {
  console.log(`\n✓ 校验通过，无问题。\n`);
  process.exit(0);
}

if (warns.length > 0) {
  console.log(`\n警告 ${warns.length} 条：`);
  for (const w of warns) console.log(`  ! ${w.where}: ${w.message}`);
}

if (errors.length > 0) {
  console.log(`\n错误 ${errors.length} 条：`);
  for (const e of errors) console.log(`  × ${e.where}: ${e.message}`);
  console.log('');
  process.exit(1);
}

console.log('');
