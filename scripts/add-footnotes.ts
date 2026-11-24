/**
 * 给 sig≥4 的事件批量补脚注。
 *
 * 为什么用脚本而不是手写：
 * 93 个事件 × 1–2 条脚注，手写容易漏、也容易写错 id。
 * 这里按「文件里已声明的 sources」生成脚注，保证：
 *   1. 只引用真实存在的史料（不新造 id，避免构建失败）
 *   2. 每条事件至少落在它的第一条 source 上
 *   3. 已有脚注的文件跳过，不重复
 *
 * 插入位置：正文最后一段完整段落的末尾（不打断句子）。
 * 只给「有实质正文」的事件加，空壳事件跳过。
 *
 * 运行：node scripts/add-footnotes.ts [--dry]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'src/content/events';
const DRY = process.argv.includes('--dry');

interface Parsed {
  file: string;
  sig: number;
  sources: string[];
  body: string;
  hasFootnote: boolean;
}

function parse(file: string): Parsed | null {
  const raw = readFileSync(join(DIR, file), 'utf8').replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;

  const [, front, body] = m;
  const sigM = front.match(/significance:\s*(\d)/);
  if (!sigM) return null;

  // sources 是 YAML 列表：sources:\n  - id\n  - id
  const srcM = front.match(/sources:[ ]*\n((?:[ ]*-[ ]*\S+[ ]*\n?)+)/);
  const sources = srcM
    ? srcM[1]
        .split('\n')
        .map((l) => l.replace(/^[ ]*-[ ]*/, '').trim())
        .filter(Boolean)
    : [];

  return {
    file,
    sig: Number(sigM[1]),
    sources,
    body,
    hasFootnote: /\[\^[^\]]+\]/.test(body),
  };
}

/**
 * 找出正文最后一个「有实质内容」的段落，返回其结束位置。
 * 跳过列表项、标题、空行——脚注挂在段落末尾读起来最自然。
 */
function lastParagraphEnd(body: string): number {
  const paragraphs = body.split(/\n{2,}/);
  // 从后往前找一个不像标题/列表/分隔符的段落
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    const p = paragraphs[i].trim();
    if (!p) continue;
    if (p.startsWith('#') || p.startsWith('-') || p.startsWith('>') || p.startsWith('|')) continue;
    // 找到这一段在 body 中的结束位置
    const idx = body.lastIndexOf(p);
    if (idx >= 0) return idx + p.length;
  }
  return -1;
}

let changed = 0;
let skipped = 0;
let noSource = 0;

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.md'))) {
  const p = parse(file);
  if (!p) continue;

  if (p.sig < 4) {
    skipped++;
    continue;
  }
  if (p.hasFootnote) {
    skipped++;
    continue;
  }
  if (p.sources.length === 0) {
    noSource++;
    console.log(`  ! ${file} 无 sources，跳过`);
    continue;
  }

  const pos = lastParagraphEnd(p.body);
  if (pos < 0) {
    skipped++;
    continue;
  }

  // 主史料挂最后一段；若有第二条史料，挂到倒数第二个可挂段落
  const primary = p.sources[0];
  const footnote = `[^${primary}]`;

  let newBody = p.body.slice(0, pos) + footnote + p.body.slice(pos);

  if (p.sources.length > 1) {
    const second = p.sources[1];
    const secondPos = lastParagraphEnd(newBody.slice(0, pos));
    if (secondPos > 0) {
      newBody = newBody.slice(0, secondPos) + `[^${second}]` + newBody.slice(secondPos);
    }
  }

  const out = `---\n${readFileSync(join(DIR, file), 'utf8').replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n/)![1]}\n---\n${newBody}`;

  if (DRY) {
    console.log(`  ~ ${file}  sig=${p.sig}  +[^${primary}]${p.sources[1] ? ` +[^${p.sources[1]}]` : ''}`);
  } else {
    writeFileSync(join(DIR, file), out, 'utf8');
  }
  changed++;
}

console.log('');
console.log(`${DRY ? '[dry-run] ' : ''}补脚注 ${changed} 个，跳过 ${skipped} 个，无史料 ${noSource} 个`);
