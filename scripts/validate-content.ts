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

/* ---------------- 可信度：跨书互证与争议块 ---------------- */

/**
 * 书目判据：史料 id 的第一段。
 *
 * `sanguozhi-chibi` 与 `sanguozhi-zhuge` 同属「三国志」，
 * `suishu-yangdi` 与 `chenshu-houzhu` 分属两本。
 * 这是启发式判断，不追求万全——只用来拦「同一本书引两次冒充互证」。
 */
function bookOf(sourceId: string): string {
  return sourceId.split('-')[0];
}

/** 解析 corroboration 块（yaml 缩进结构，手工扫一遍） */
function parseCorroboration(raw: string): {
  primary: string | null;
  secondary: string[];
  agreement: string | null;
} | null {
  // 归一换行：Windows 下 raw 是 CRLF，行尾的 \r 会让 `(\S+)$` 匹配失败
  const normalized = raw.replace(/\r\n/g, '\n');
  const block = normalized.match(/^corroboration:\s*\n((?:[ \t]+.*\n?)+)/m);
  if (!block) return null;
  const body = block[1];

  const primary = body.match(/^\s+primary:\s*(\S+)/m)?.[1] ?? null;
  const agreement = body.match(/^\s+agreement:\s*(\S+)/m)?.[1] ?? null;

  const secondary: string[] = [];
  const secBlock = body.match(/^\s+secondary:\s*\n((?:\s+-\s+\S+\n?)+)/m);
  if (secBlock) {
    for (const line of secBlock[1].split('\n')) {
      const m = line.match(/^\s+-\s+(\S+)$/);
      if (m) secondary.push(m[1].trim());
    }
  }
  return { primary, secondary, agreement };
}

/** 解析 disputes 里出现的所有 sourceId */
function parseDisputeSources(raw: string): string[] {
  const block = raw.match(/^disputes:\s*\n((?:[ \t]+.*\n?)+)/m);
  if (!block) return [];
  const out: string[] = [];
  const re = /^\s+sourceId:\s*(\S+)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block[1]))) out.push(m[1].trim());
  return out;
}

for (const f of listDir('events')) {
  const fm = readFrontmatter(join(ROOT, 'events', f));
  if (!fm) continue;
  const raw = fm.__raw as string;
  const id = pick(raw, 'id') ?? f;

  // 收集本事件声明的 sources
  const declared: string[] = [];
  const srcBlock = raw.match(/^sources:\s*\n((?:\s+-\s+.+\n?)+)/m);
  if (srcBlock) {
    for (const line of srcBlock[1].split('\n')) {
      const m = line.match(/^\s+-\s+(.+)$/);
      if (m) declared.push(m[1].trim());
    }
  }

  const corr = parseCorroboration(raw);

  // 检查 1：corroboration 的 primary / secondary 必须真的在 sources 或彼此之间
  if (corr && corr.primary) {
    const all = new Set([...declared, corr.primary, ...corr.secondary]);
    const books = new Set([...all].map(bookOf));

    if (corr.secondary.length === 0) {
      issues.push({
        level: 'error',
        where: `events/${id}`,
        message: 'corroboration.secondary 为空，至少需要 1 条不同书目的旁证',
      });
    } else if (books.size < 2) {
      issues.push({
        level: 'error',
        where: `events/${id}`,
        message: `corroboration 的 primary 与 secondary 同属一本书（${[...books].join(', ')}），无法构成互证`,
      });
    }

    // 检查 2：agreement 枚举
    if (corr.agreement && !['consistent', 'partial', 'conflicting'].includes(corr.agreement)) {
      issues.push({
        level: 'error',
        where: `events/${id}`,
        message: `corroboration.agreement 非法值「${corr.agreement}」，可用 consistent / partial / conflicting`,
      });
    }

    // 检查 3：conflicting 必须有 disputes
    if (corr.agreement === 'conflicting') {
      const claimed = raw.match(/^disputes:\s*\n(?:\s+-\s+claim:)/m);
      if (!claimed) {
        issues.push({
          level: 'error',
          where: `events/${id}`,
          message: 'agreement 为 conflicting 但 disputes 为空，争议点必须写明',
        });
      }
    }
  }

  // 检查 4：disputes 里的 sourceId 必须存在
  for (const s of parseDisputeSources(raw)) {
    if (!ids.sources.has(s)) {
      issues.push({
        level: 'error',
        where: `events/${id}`,
        message: `disputes 引用了不存在的史料：${s}`,
      });
    }
  }

  // 检查 5：正文脚注 id 必须在 sources / corroboration 里
  const body = (readFrontmatter(join(ROOT, 'events', f)) as any)?.__raw;
  const fullText = readFileSync(join(ROOT, 'events', f), 'utf8');
  const bodyPart = fullText.replace(/^---[\s\S]*?\n---/, '');
  const footRe = /\[\^([a-z0-9-]+)(?:\|[^\]]+)?\]/g;
  const known = new Set([...declared, corr?.primary ?? '', ...(corr?.secondary ?? [])].filter(Boolean));
  let fm2: RegExpExecArray | null;
  while ((fm2 = footRe.exec(bodyPart))) {
    const sid = fm2[1];
    if (!ids.sources.has(sid)) {
      issues.push({
        level: 'error',
        where: `events/${id}`,
        message: `正文脚注引用了不存在的史料：${sid}`,
      });
    } else if (!known.has(sid)) {
      issues.push({
        level: 'warn',
        where: `events/${id}`,
        message: `正文脚注 ${sid} 未出现在 sources / corroboration 里，建议补上以便溯源`,
      });
    }
  }
}

/* ---------------- 可信度：人物评价必须带出处 ---------------- */

for (const f of listDir('people')) {
  const fm = readFrontmatter(join(ROOT, 'people', f));
  if (!fm) continue;
  const raw = fm.__raw as string;
  const id = pick(raw, 'id') ?? f;

  const evalBlock = raw.match(/^evaluations:\s*\n((?:[ \t]+.*\n?)+)/m);
  if (evalBlock) {
    const re = /^\s+sourceId:\s*(\S+)/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(evalBlock[1]))) {
      const s = m[1].trim();
      if (!ids.sources.has(s)) {
        issues.push({
          level: 'error',
          where: `people/${id}`,
          message: `evaluations 引用了不存在的史料：${s}`,
        });
      }
    }
  }
}

/* ---------------- 枚举值校验 ---------------- */

/**
 * Zod 会校验枚举，但只在 `astro build` 时。validate 用的是自己的正则解析，
 * 所以枚举写错（如把 participants.role 写成 enemy）会漏过去，
 * 直到构建才炸。这里补上前置检查，让 CI 的 validate 步骤就能拦下。
 *
 * 注意：这里的枚举必须与 src/content.config.ts 保持同步。
 */
const EVENT_CATEGORIES = new Set([
  'political',
  'military',
  'institution',
  'culture',
  'science',
  'disaster',
]);
const PARTICIPANT_ROLES = new Set(['leader', 'participant', 'victim']);
const RELATION_TYPES = new Set([
  'parent-child',
  'sibling',
  'spouse',
  'kinship',
  'ruler-subject',
  'superior',
  'teacher-student',
  'recommend',
  'ally',
  'enemy',
  'kill',
  'colleague',
]);
const POLITY_PERIODS = new Set(['pre-imperial', 'imperial-early', 'imperial-mid', 'imperial-late']);

for (const f of listDir('events')) {
  const fm = readFrontmatter(join(ROOT, 'events', f));
  if (!fm) continue;
  const raw = fm.__raw as string;
  const id = pick(raw, 'id') ?? f;

  // significance 必须 1..5
  const sig = pick(raw, 'significance');
  if (sig !== null) {
    const n = Number(sig);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      issues.push({
        level: 'error',
        where: `events/${id}`,
        message: `significance 必须是 1-5 的整数，实际为 ${sig}`,
      });
    }
  }

  // categories 必须在枚举内
  const catBlock = raw.match(/^categories:\s*\n((?:\s+-\s+.+\n?)+)/m);
  if (catBlock) {
    for (const line of catBlock[1].split('\n')) {
      const m2 = line.match(/^\s+-\s+(\S+)\s*$/);
      if (m2 && !EVENT_CATEGORIES.has(m2[1])) {
        issues.push({
          level: 'error',
          where: `events/${id}`,
          message: `categories 含非法值「${m2[1]}」，可用：${[...EVENT_CATEGORIES].join(' / ')}`,
        });
      }
    }
  }

  // participants.role 必须在枚举内
  for (const m2 of raw.matchAll(/^\s+role:\s*(\S+)\s*$/gm)) {
    if (!PARTICIPANT_ROLES.has(m2[1])) {
      issues.push({
        level: 'error',
        where: `events/${id}`,
        message: `participants.role 含非法值「${m2[1]}」，可用：${[...PARTICIPANT_ROLES].join(' / ')}`,
      });
    }
  }
}

// 人物 relations[].type 必须在枚举内
for (const f of listDir('people')) {
  const fm = readFrontmatter(join(ROOT, 'people', f));
  if (!fm) continue;
  const raw = fm.__raw as string;
  const id = pick(raw, 'id') ?? f;
  for (const m2 of raw.matchAll(/^\s+type:\s*(\S+)\s*$/gm)) {
    if (!RELATION_TYPES.has(m2[1])) {
      issues.push({
        level: 'error',
        where: `people/${id}`,
        message: `relations.type 含非法值「${m2[1]}」，可用：${[...RELATION_TYPES].join(' / ')}`,
      });
    }
  }
}

// 政权 period 必须在枚举内
for (const f of listDir('polities')) {
  const fm = readFrontmatter(join(ROOT, 'polities', f));
  if (!fm) continue;
  const raw = fm.__raw as string;
  const id = pick(raw, 'id') ?? f;
  const period = pick(raw, 'period');
  if (period !== null && !POLITY_PERIODS.has(period)) {
    issues.push({
      level: 'error',
      where: `polities/${id}`,
      message: `period 含非法值「${period}」，可用：${[...POLITY_PERIODS].join(' / ')}`,
    });
  }
}

/* ---------------- 组件内硬编码绝对路径 ---------------- */

/**
 * 扫描 src/components/**\/*.vue 里的硬编码站内绝对路径。
 *
 * 为什么要查：Vue 组件不经过 lib/url.ts 的 url()，如果写成
 * `` :href="`/people/${id}`" ``，在 GitHub Pages 项目站（base = '/<repo>'）
 * 下会跳到域名根直接 404。历史上 RelationList / RelationGraph /
 * GraphExplorer / TimelineVertical 四处都犯过。
 *
 * 正确写法：import { personHref } from '../../lib/nav' 后用 personHref(id)。
 */
const COMPONENTS = join(ROOT, '..', '..', 'src', 'components');

function walkVue(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, n.name);
    if (n.isDirectory()) walkVue(p, out);
    else if (n.name.endsWith('.vue')) out.push(p);
  }
  return out;
}

/** 模板里出现 `/people/` 这类根路径（不含 ${...} 的纯字面量也算） */
const HARDCODED_ROUTE = /["'`]\/(people|events|dynasties|graph|timeline|search|styleguide)\b/;

for (const file of walkVue(COMPONENTS)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    // 注释与文档示例放过
    if (/^\s*(\*|\/\/|<!--)/.test(line)) return;
    if (HARDCODED_ROUTE.test(line)) {
      issues.push({
        level: 'error',
        where: file.slice(join(ROOT, '..', '..').length + 1).replace(/\\/g, '/'),
        message: `第 ${i + 1} 行硬编码了站内绝对路径，子路径部署会 404。改用 lib/nav.ts 的 personHref / eventHref 等`,
      });
    }
  });
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
