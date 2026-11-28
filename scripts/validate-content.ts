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
 *  .md 用 `---` 包裹；.yaml 整份就是数据。
 *
 *  **必须归一换行**：Windows 上 `core.autocrlf=true`，工作区文件是 CRLF。
 *  下面的检查大量依赖 `/^sources:\n((?:\s+-\s+.+\n?)+)/m` 这类跨行正则，
 *  行尾多一个 `\r` 会让 `(.+)$` 之前的那一行匹配不上，整块被静默跳过——
 *  检查不报错，但根本没执行。曾因此在本机报出 7 条假警告（首条 sources
 *  被吞，误判脚注未声明），而 CI（LF）全绿。 */
function readFrontmatter(path: string): Record<string, unknown> | null {
  const text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  if (path.endsWith('.yaml') || path.endsWith('.yml')) {
    return { __raw: text };
  }
  const m = text.match(/^---\n([\s\S]*?)\n---/);
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

/*
 * 文件名必须与 frontmatter 的 id 一致。
 *
 * 为什么必须查这条：Astro 的 glob loader 用**文件名**作为 entry id，
 * 而本脚本按 frontmatter 里的 id 建立索引。两者不一致时会出现
 * 「validate 通过但构建时报 Invalid content reference」的诡异局面 ——
 * 曾经 marco-polo.yaml 里写 id: yuan-marco-polo，validate 认它存在，
 * Astro 却按文件名 marco-polo 索引，于是引用全部悬空。
 */
for (const sub of ['sources', 'polities', 'people', 'events']) {
  for (const f of listDir(sub)) {
    const isYaml = sub === 'sources' || sub === 'polities';
    const ext = isYaml ? /\.ya?ml$/ : /\.md$/;
    if (!ext.test(f)) continue;

    const fm = readFrontmatter(join(ROOT, sub, f));
    if (!fm) continue;
    const id = pick(fm.__raw as string, 'id');
    const base = f.replace(ext, '');

    if (id && id !== base) {
      issues.push({
        level: 'error',
        where: `${sub}/${base}`,
        message:
          `文件名 ${base} 与 frontmatter 的 id「${id}」不一致。` +
          `Astro 按文件名索引，引用 ${id} 会解析不到。改名或改 id，二者取其一。`,
      });
    }
  }
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
 * 书目判据：优先用史料条目的 `title`（书名本身），拿不到才退回 id 前缀。
 *
 * 为什么不能只用 id 前缀：曾出现过 `tangshi-taizong.yaml` 里
 * `title: 旧唐书` 的情况——id 前缀写成 `tangshi`，于是它和
 * `jiutangshu-*` 被当成两本书，同书冒充互证就这样漏过了校验。
 * 现在按 title 归一，`旧唐书` 无论 id 怎么写都算同一本。
 *
 * `sanguozhi-chibi` 与 `sanguozhi-zhuge` 同属《三国志》；
 * `suishu-yangdi` 与 `chenshu-houzhu` 分属两本。
 * 这是启发式判断，不追求万全——只用来拦「同一本书引两次冒充互证」。
 */
const bookTitleCache = new Map<string, string>();

function bookOf(sourceId: string): string {
  const cached = bookTitleCache.get(sourceId);
  if (cached) return cached;

  // 目录在脚本顶部已扫过一遍，这里按需读一次即可
  const path = join(ROOT, 'sources', `${sourceId}.yaml`);
  let key = sourceId.split('-')[0];
  if (existsSync(path)) {
    const fm = readFrontmatter(path);
    const title = fm ? pick(fm.__raw as string, 'title') : null;
    // title 里的书名号与副题去掉，只留书名主干
    if (title) key = title.replace(/[《》]/g, '').replace(/[·・].*$/, '').trim();
  }
  bookTitleCache.set(sourceId, key);
  return key;
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

  // 检查 1：corroboration 的 primary / secondary 必须构成真正的跨书互证
  if (corr && corr.primary) {
    /*
     * 判据只取 primary + secondary，**不掺 `sources`**。
     *
     * 曾经把 `sources` 一起并进来算书数，于是「主证与旁证同属一本，
     * 但 sources 里另有一条别的书」就能骗过检查——yellow-turban 的
     * primary/secondary 都是《后汉书》，却因为 sources 里有
     * `sanguozhi-chibi` 而被当成两本书。互证看的是这一对，别的不算。
     */
    const pair = [corr.primary, ...corr.secondary];
    const books = new Set(pair.map(bookOf));

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

  /**
   * 检查 4.1：disputes 与 certainty 必须联动。
   *
   * 事件页的「史料有异说」徽章只看 `certainty === 'disputed'`，
   * 而 disputes 块是另一个字段。两者不联动时会出现两种错：
   * - 有 disputes 却没标 disputed → 徽章不出现，读者看不到异说提示
   * - 标了 disputed 却没有 disputes → 徽章出现但下方无内容
   * 历史上 100 条事件的 certainty 全是默认值，徽章一次都没显示过。
   */
  const disputeBlock = raw.match(/^disputes:\s*\n((?:[ \t]+.*\n?)+)/m);
  const hasDisputes = !!disputeBlock && /^\s+-\s+claim:/m.test(disputeBlock[1]);
  const certainty = pick(raw, 'certainty');

  if (hasDisputes && certainty !== 'disputed') {
    issues.push({
      level: 'error',
      where: `events/${id}`,
      message: `有 disputes 但 certainty 不是 disputed（当前 ${certainty ?? '未填'}），「史料有异说」徽章不会显示`,
    });
  }
  if (!hasDisputes && certainty === 'disputed') {
    issues.push({
      level: 'error',
      where: `events/${id}`,
      message: `certainty 标了 disputed 但 disputes 为空，徽章会显示却没有内容`,
    });
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
    const evalSources: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(evalBlock[1]))) {
      const s = m[1].trim();
      evalSources.push(s);
      if (!ids.sources.has(s)) {
        issues.push({
          level: 'error',
          where: `people/${id}`,
          message: `evaluations 引用了不存在的史料：${s}`,
        });
      }
    }

    /*
     * 书目多样性：评价不能全出自同一本书。
     *
     * 为什么必须按 title 而非 sourceId 判：同一本书的不同卷次 id 各不相同
     * （sanguozhi-xianzhu / sanguozhi-guanyu / sanguozhi-caocao），
     * 用 id 去重会把「四段全引自《三国志》」误判成四个书目。
     *
     * 这一项此前从未被检查，导致文档声称「274/274 每人 ≥2 个不同书目」，
     * 实际有 135 人只有一本书。用 warn 而非 error：存量需渐进修复，
     * 不能让 CI 立刻红掉；修完后可升为 error。
     */
    if (evalSources.length >= 2) {
      const books = new Set(evalSources.map(bookOf));
      if (books.size < 2) {
        issues.push({
          level: 'warn',
          where: `people/${id}`,
          message: `evaluations 的 ${evalSources.length} 条评价只出自一本书（${[...books].join(', ')}），缺独立第二出处`,
        });
      }
    }
  }
}

/* ---------------- YAML 结构校验 ---------------- */

/**
 * frontmatter 必须是合法 YAML。
 *
 * 踩过的坑：把 `evaluations:` 误粘到 `summary:` 行尾（少一个换行），
 * 变成 `summary: ……未称帝。evaluations:`，YAML 会报
 * 「Nested mappings are not allowed in compact mappings」。
 * 这个错误只在 `astro build` 的 content sync 阶段爆发，位置信息指向
 * 解析器内部而非出错的字段，排查成本高。这里用 yaml 库提前挡在 validate。
 *
 * 为什么不用自己的正则：YAML 的合法写法太多（折叠块、多行标量、锚点），
 * 正则判不全，只会制造假阳性。直接用与 Astro 相同的 yaml 库最准。
 */
import { parse as parseYaml } from 'yaml';

for (const sub of ['people', 'events']) {
  for (const f of listDir(sub)) {
    if (!f.endsWith('.md')) continue;
    const fm = readFrontmatter(join(ROOT, sub, f));
    if (!fm) continue;
    const raw = fm.__raw as string;
    try {
      parseYaml(raw);
    } catch (e) {
      const msg = e instanceof Error ? e.message.split('\n')[0] : String(e);
      issues.push({
        level: 'error',
        where: `${sub}/${f.replace(/\.md$/, '')}`,
        message: `frontmatter 不是合法 YAML：${msg}`,
      });
      continue;
    }
    // 顶层键被粘在长文本行尾的典型症状：`summary: …字evaluations:`
    for (const line of raw.split('\n')) {
      const glued = line.match(
        /^(summary|title|note):\s*.*[。」，）】」]\s*([a-z][a-zA-Z]*):\s*$/,
      );
      if (glued) {
        issues.push({
          level: 'error',
          where: `${sub}/${f.replace(/\.md$/, '')}`,
          message: `${glued[1]} 行尾粘连了顶层键 ${glued[2]}:（缺少换行）`,
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
const POLITY_PERIODS = new Set([
  'pre-imperial',
  'imperial-early',
  'imperial-mid',
  'imperial-late',
  'republican',
]);

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

/*
 * id 必须以政权前缀开头：`<polityIds[0]>-<拼音>`。
 *
 * 为什么定这条：2026-11 我把前蜀王建的内容写进了南宋王坚的条目——
 * 王坚、王建、王俭三个人拼音完全相同（wang-jian）。当时库里靠
 * `wang-jian-nanqi` 这种临时后缀区分，不成规则，也没有检查。
 *
 * 加前缀后 `song-wang-jian` 与 `shu-wang-jian` 一眼可分。这是命名约束，
 * 不是防错机制——写的时候认错人，前缀也拦不住。它保证的是「同音不同人
 * 不必靠记忆区分」。
 *
 * 注意：人物与事件都适用。事件此前只「建议」带前缀，现改为强制。
 */
const ID_PREFIX_EXEMPT = new Set<string>([
  // 无例外。若将来有跨政权聚合体人物，在此登记并写明理由。
]);

for (const collection of ['people', 'events'] as const) {
  for (const f of listDir(collection)) {
    const fm = readFrontmatter(join(ROOT, collection, f));
    if (!fm) continue;
    const raw = fm.__raw as string;
    const id = pick(raw, 'id');
    if (!id) continue;
    if (ID_PREFIX_EXEMPT.has(id)) continue;

    const polBlock = raw.match(/^polityIds:\s*\n((?:[ \t]+-.*\n?)+)/m);
    const firstPolity = polBlock?.[1]
      .split('\n')
      .find((l) => /^[ \t]+-/.test(l))
      ?.replace(/^[ \t]+-\s*/, '')
      .trim();

    if (!firstPolity) {
      issues.push({
        level: 'error',
        where: `${collection}/${id}`,
        message: 'polityIds 为空，无法确定 id 前缀（id 必须写作 <政权>-<拼音>）',
      });
      continue;
    }

    if (!id.startsWith(`${firstPolity}-`)) {
      issues.push({
        level: 'error',
        where: `${collection}/${id}`,
        message: `id 必须以政权前缀开头，建议改为 ${firstPolity}-${id}`,
      });
    }
  }
}

/*
 * 双向声明的一致性：同一条关系若两端都写了，from / to / strength 必须相同。
 *
 * 为什么必须查：CONTENT-SCHEMA 第 1 节要求「只在一端声明」，但存量里有
 * 189 条两边都写的。两端都写本身不会重复渲染（getPersonRelations 会去重），
 * 可怕的是**两端值不一致**：读者看到哪个年份，取决于他先打开谁的人物页。
 * 2026-11 核查时 37 对不一致，例如成吉思汗侧写「与忽必烈 1162 起」，
 * 忽必烈侧写「1215 起」——1162 其实是成吉思汗自己的生年。
 *
 * 报 warn 不报 error：这是存量数据的质量问题，逐步收敛，不该让 CI 立刻红。
 */
{
  /** key: `a|b::type`（a、b 排序保证无向）→ 各端声明的值 */
  const declared = new Map<string, Array<{ who: string; from: string; to: string; strength: string }>>();

  for (const f of listDir('people')) {
    const fm = readFrontmatter(join(ROOT, 'people', f));
    if (!fm) continue;
    const raw = fm.__raw as string;
    const id = pick(raw, 'id') ?? f;

    const block = raw.match(/^relations:\s*\n((?:[ \t]+.*\n?)+)/m);
    if (!block) continue;

    for (const item of block[1].split(/\n(?=\s+- )/)) {
      if (!/^\s+- /.test(item)) continue;
      const target = item.match(/target:\s*(\S+)/)?.[1];
      const type = item.match(/type:\s*(\S+)/)?.[1];
      if (!target || !type) continue;
      const key = [id, target].sort().join('|') + '::' + type;
      if (!declared.has(key)) declared.set(key, []);
      declared.get(key)!.push({
        who: id,
        from: item.match(/^\s+from:\s*(-?\d+)/m)?.[1] ?? '',
        to: item.match(/^\s+to:\s*(-?\d+)/m)?.[1] ?? '',
        strength: item.match(/strength:\s*(\S+)/)?.[1] ?? '',
      });
    }
  }

  for (const [key, ends] of declared) {
    if (ends.length < 2) continue;
    const froms = new Set(ends.map((e) => e.from));
    const tos = new Set(ends.map((e) => e.to));
    const strengths = new Set(ends.map((e) => e.strength));
    if (froms.size === 1 && tos.size === 1 && strengths.size === 1) continue;
    issues.push({
      level: 'warn',
      where: `people/${key.split('::')[0]}`,
      message:
        `双向声明的关系两端不一致（${ends.map((e) => `${e.who}: from=${e.from || '—'} to=${e.to || '—'} ${e.strength}`).join(' vs ')}），` +
        `同一条关系在不同人物页会显示不同年份。应只保留一端，或使两端取值一致`,
    });
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

/* ---------------- 史料与事件的年代合理性 ---------------- */

/**
 * 检查「引用了一本明显不可能记载此事的书」。
 *
 * 为什么需要这条：人工写内容时最容易犯的错不是「引用了不存在的书」，
 * 而是「引用了存在的书但时代不对」。实测发现过 6 处：
 * - cai-lun（105 年）引《后汉书·光武帝纪》（光武在位 25–57 年）
 * - huangchao（875 年）引《旧唐书·太宗本纪》（太宗在位 626–649 年）
 * - kaiyuan（713 年）引《旧唐书·太宗本纪》
 * - cao-pi（220 年）引《三国志·诸葛亮传》（诸葛亮 181–234）
 * - gaopingling（249 年）引《三国志·诸葛亮传》（亮 234 年已卒）
 * - dazexiang（前 209 年）引《史记·高祖本纪》（事在陈涉世家）
 *
 * 判据必须**按书名限定**：「太祖」在汉是刘邦、在宋是赵匡胤、在金是完颜阿骨打、
 * 在明是朱元璋。不区分书名的话，所有带「太祖本纪」的史料都会误报。
 */

/** 书名 + 纪名 → 在位年。key 为「书名|纪名」 */
const REIGNS: Record<string, [number, number]> = {
  // ── 汉书（班固）
  '汉书|高祖': [-202, -195],
  '汉书|武帝': [-141, -87],
  // ── 后汉书（范晔）
  '后汉书|光武': [25, 57],
  '后汉书|和帝': [88, 106],
  // ── 旧唐书（刘昫）
  '旧唐书|高祖': [618, 626],
  '旧唐书|太宗': [626, 649],
  '旧唐书|高宗': [649, 683],
  '旧唐书|玄宗': [712, 756],
  '旧唐书|肃宗': [756, 762],
  '旧唐书|德宗': [779, 805],
  '旧唐书|宪宗': [805, 820],
  '旧唐书|僖宗': [873, 888],
  // ── 宋书（沈约）
  '宋书|武帝': [420, 422],
  // ── 金史（脱脱）
  '金史|太祖': [1115, 1123],
  '金史|太宗': [1123, 1135],
  '金史|海陵': [1149, 1161],
  '金史|世宗': [1161, 1189],
  // ── 宋史（脱脱）
  '宋史|太祖': [960, 976],
  '宋史|钦宗': [1126, 1127],
  // ── 辽史（脱脱）
  '辽史|太祖': [916, 926],
  '辽史|太宗': [927, 947],
  // ── 明史（张廷玉）
  '明史|太祖': [1368, 1398],
  '明史|成祖': [1402, 1424],
  '明史|神宗': [1572, 1620],
  // ── 元史（宋濂）
  '元史|太祖': [1206, 1227],
  '元史|世祖': [1260, 1294],
  '元史|顺帝': [1333, 1368],
};

/** 史料 id → { title, volume } */
const sourceMeta = new Map<string, { title: string; volume: string }>();
for (const f of listDir('sources')) {
  const fm = readFrontmatter(join(ROOT, 'sources', f));
  if (!fm) continue;
  const raw = fm.__raw as string;
  const id = pick(raw, 'id');
  const title = pick(raw, 'title');
  const vol = pick(raw, 'volume');
  if (id && title && vol) sourceMeta.set(id, { title, volume: vol });
}

/** 从「书名 + 卷次」里找出对应的纪名与在位年 */
function reignOf(title: string, volume: string): { name: string; range: [number, number] } | null {
  for (const [key, range] of Object.entries(REIGNS)) {
    const [book, name] = key.split('|');
    if (title.includes(book) && volume.includes(`${name}本纪`)) {
      return { name, range };
    }
  }
  return null;
}

/** 从事件 frontmatter 取起始年 */
function eventYear(raw: string): number | null {
  const m = raw.match(/time:\s*\n\s*from:\s*\n\s*year:\s*(-?\d+)/);
  return m ? Number(m[1]) : null;
}

for (const f of listDir('events')) {
  const fm = readFrontmatter(join(ROOT, 'events', f));
  if (!fm) continue;
  const raw = fm.__raw as string;
  const id = pick(raw, 'id') ?? f;
  const year = eventYear(raw);
  if (year === null) continue;

  const srcBlock = raw.match(/^sources:\s*\n((?:\s+-\s+.+\n?)+)/m);
  if (!srcBlock) continue;

  for (const line of srcBlock[1].split('\n')) {
    const m = line.match(/^\s+-\s+(.+)$/);
    if (!m) continue;
    const sid = m[1].trim();
    const meta = sourceMeta.get(sid);
    if (!meta) continue;

    const reign = reignOf(meta.title, meta.volume);
    if (!reign) continue;

    const [from, to] = reign.range;

    /**
     * 开国之君的本纪会记录其称帝前的功业。
     *
     * 典型：刘裕 409 年北伐时还是东晋臣子，《宋书·武帝本纪》照记其事
     * （他 420 年才称帝）。这种情况不算错配——本纪本来就起于「未即位时」。
     *
     * 判据：事件年早于开国年但落在该人物的活动期内时放过。
     * 只对开国君主放宽，且放宽幅度有限（30 年），避免掩盖真正的错配。
     */
    const FOUNDERS = new Set([
      '宋书|武帝',   // 刘裕 420 称帝，北伐在 409
      '梁书|武帝',   // 萧衍 502 称帝
      '陈书|高祖',   // 陈霸先 557 称帝
      '隋书|高祖',   // 杨坚 581 称帝
      '旧唐书|高祖', // 李渊 618 称帝
      '宋史|太祖',   // 赵匡胤 960 称帝
      '明史|太祖',   // 朱元璋 1368 称帝
      '元史|世祖',   // 忽必烈 1260 即位，1271 建元
    ]);
    const isFounder = [...FOUNDERS].some((k) => {
      const [book, name] = k.split('|');
      return meta.title.includes(book) && meta.volume.includes(`${name}本纪`);
    });

    const earlyOk = isFounder && year >= from - 30 && year < from;

    if (year < from - 3 && !earlyOk) {
      issues.push({
        level: 'error',
        where: `events/${id}`,
        message:
          `引用了《${meta.title}·${meta.volume}》但事件在 ${year} 年，` +
          `${reign.name}在位 ${from}–${to} 年，时代不符。请确认是否引错本纪`,
      });
    } else if (year > to + 3) {
      issues.push({
        level: 'error',
        where: `events/${id}`,
        message:
          `引用了《${meta.title}·${meta.volume}》但事件在 ${year} 年，` +
          `${reign.name}在位 ${from}–${to} 年，时代不符。请确认是否引错本纪`,
      });
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
