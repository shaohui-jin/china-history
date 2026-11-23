/**
 * Remark 插件：把正文里的 `[^source-id]` 编译为**页内脚注**。
 *
 * 为什么不用 GFM 的脚注语法：
 * - GFM 脚注的注释文本要写在正文里（`[^1]: 内容`），而本站史料已经
 *   结构化存在 `src/content/sources/*.yaml`（书名、卷次、作者、原文）。
 *   让作者在正文和 yaml 里各写一遍，必然漂移。
 * - GFM 一旦认领这个语法，remarkRehype 会用自带 handler 抢先输出
 *   `<div class="footnotes">`，样式与结构都不受控。
 *
 * 本站做法是「引用式脚注」：
 *   正文写 `[^sanguozhi-chibi]` → 渲染为 <sup>[1]</sup>
 *   文末自动生成 1 → 《三国志》卷五十四 + 原文
 * 一条史料只写一次（在 yaml 里），正文只写 id。
 *
 * 实现要点（踩过的坑）：本插件运行在 **mdast 阶段**，因此
 * **不能**用 hast 的 `type: 'element' / tagName` —— remarkRehype 不认，
 * 会落到默认 handler 上（表现为输出一堆没样式的 <div>）。
 * 正确写法是 mdast 原生节点 + `data.hName` 指定最终标签。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** 史料条目（与 content.config.ts 的 sources schema 对应） */
interface SourceEntry {
  id: string;
  title: string;
  volume?: string;
  author?: string;
  composed?: string;
  quote?: string;
  note?: string;
}

/**
 * 内容根目录。用 cwd 而非 import.meta.dirname：
 * 插件运行在 astro.config 的打包上下文，后者会指向缓存目录。
 */
const ROOT = join(process.cwd(), 'src', 'content');

/** 极简 YAML 取值：单行标量 + 折叠块（| 或 >） */
function parseSource(raw: string): Partial<SourceEntry> {
  const out: Record<string, string> = {};
  for (const key of ['id', 'title', 'volume', 'author', 'composed', 'quote', 'note']) {
    const inline = raw.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    if (inline && !/^[|>]/.test(inline[1].trim())) {
      out[key] = inline[1].trim().replace(/^["']|["']$/g, '');
      continue;
    }
    const block = raw.match(new RegExp(`^${key}:\\s*[|>][-+]?\\s*\\n((?:[ \\t]+.*\\n?)+)`, 'm'));
    if (block) {
      out[key] = block[1]
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .join(' ');
    }
  }
  return out as Partial<SourceEntry>;
}

let cachedSources: Map<string, SourceEntry> | null = null;

function getSources(): Map<string, SourceEntry> {
  if (cachedSources) return cachedSources;
  const map = new Map<string, SourceEntry>();
  const dir = join(ROOT, 'sources');
  if (existsSync(dir)) {
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.yaml') && !f.endsWith('.yml')) continue;
      const parsed = parseSource(readFileSync(join(dir, f), 'utf8'));
      if (parsed.id) map.set(parsed.id, parsed as SourceEntry);
    }
  }
  cachedSources = map;
  return map;
}

/* ------------------------------------------------------------------ *
 * mdast 节点构造
 *
 * 统一用 mdast 原生类型 + data.hName 覆盖输出标签。
 * - 行内用 type:'emphasis'（可承载 hName）+ hProperties
 * - 块级用 type:'paragraph' / 'list' / 'listItem'，同样加 hName
 * ------------------------------------------------------------------ */

/** 行内片段：<span class="x">文本</span> */
function span(className: string, value: string): any {
  return {
    type: 'emphasis',
    data: { hName: 'span', hProperties: { className: [className] } },
    children: [{ type: 'text', value }],
  };
}

/** 行内上标引用：<sup class="footnote-ref"><a href="#fn-id" id="fnref-id" title="…">n</a></sup> */
function buildRef(id: string, title: string, label: string): any {
  return {
    type: 'emphasis',
    data: { hName: 'sup', hProperties: { className: ['footnote-ref'] } },
    children: [
      {
        type: 'link',
        url: `#fn-${id}`,
        data: {
          hProperties: { id: `fnref-${id}`, title },
        },
        children: [{ type: 'text', value: label }],
      },
    ],
  };
}

/** 一条参考文献：<li id="fn-id"> [n] 《书名》卷次 / 作者 / 引文 / 备注 </li> */
function buildItem(n: number, s: SourceEntry): any {
  const children: any[] = [
    span('footnote__num', `[${n}]`),
    { type: 'text', value: ' ' },
    span('footnote__cite', `《${s.title}》${s.volume ?? ''}`),
  ];

  if (s.author) {
    children.push({ type: 'text', value: ' ' });
    children.push(span('footnote__meta', `${s.author}${s.composed ? ` · ${s.composed}` : ''}`));
  }

  if (s.quote) {
    children.push({
      type: 'blockquote',
      // 让 blockquote 落到自定义类名上，避免继承正文引文的样式
      data: { hName: 'blockquote', hProperties: { className: ['footnote__quote'] } },
      children: [{ type: 'paragraph', children: [{ type: 'text', value: s.quote }] }],
    });
  }

  if (s.note) {
    children.push({
      type: 'paragraph',
      data: { hName: 'p', hProperties: { className: ['footnote__note'] } },
      children: [{ type: 'text', value: s.note }],
    });
  }

  return {
    type: 'listItem',
    data: { hProperties: { id: `fn-${s.id}` } },
    children,
  };
}

/** 脚注引用语法 */
const PATTERN = /\[\^([a-z0-9-]+)(?:\|([^\]]+))?\]/g;

function visit(node: any, fn: (n: any) => void): void {
  fn(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) visit(child, fn);
  }
}

export default function remarkFootnote() {
  return (tree: any, file: any) => {
    const sources = getSources();
    const sourcePath: string = file?.path ?? '<unknown>';

    /** 本文引用过的史料：按首次出现顺序去重 */
    const order: string[] = [];
    const numOf = new Map<string, number>();

    const numberFor = (id: string): number => {
      let n = numOf.get(id);
      if (n === undefined) {
        order.push(id);
        n = order.length;
        numOf.set(id, n);
      }
      return n;
    };

    const requireSource = (id: string): SourceEntry => {
      const src = sources.get(id);
      if (!src) {
        throw new Error(
          `[footnote] 引用了不存在的史料 "${id}"\n` +
            `  位置：${sourcePath}\n` +
            `  请检查 src/content/sources/ 下是否有 id 为 ${id} 的 yaml`,
        );
      }
      return src;
    };

    visit(tree, (node) => {
      if (node.type !== 'text' || typeof node.value !== 'string') return;
      if (!node.value.includes('[^')) return;

      const text: string = node.value;
      const replacements: any[] = [];
      let lastEnd = 0;
      PATTERN.lastIndex = 0;

      let m: RegExpExecArray | null;
      while ((m = PATTERN.exec(text))) {
        const [raw, id, customLabel] = m;
        const src = requireSource(id);
        const n = numberFor(id);

        if (m.index > lastEnd) {
          replacements.push({ type: 'text', value: text.slice(lastEnd, m.index) });
        }

        replacements.push(
          buildRef(id, `《${src.title}》${src.volume ?? ''}`, customLabel?.trim() || String(n)),
        );

        lastEnd = m.index + raw.length;
      }

      if (lastEnd === 0) return;
      if (lastEnd < text.length) {
        replacements.push({ type: 'text', value: text.slice(lastEnd) });
      }

      node.__footnoteReplacements = replacements;
    });

    (function replace(parent: any) {
      if (!Array.isArray(parent.children)) return;
      const next: any[] = [];
      for (const child of parent.children) {
        if (child.__footnoteReplacements) {
          const repl = child.__footnoteReplacements;
          delete child.__footnoteReplacements;
          next.push(...repl);
        } else {
          replace(child);
          next.push(child);
        }
      }
      parent.children = next;
    })(tree);

    if (order.length === 0) return;

    // 文末「史料出处」：默认收起，点开看原文
    tree.children.push({
      type: 'blockquote',
      data: {
        hName: 'details',
        hProperties: { className: ['footnotes'] },
      },
      children: [
        {
          type: 'paragraph',
          data: {
            hName: 'summary',
            hProperties: { className: ['footnotes__summary'] },
          },
          children: [{ type: 'text', value: `史料出处 · ${order.length} 条` }],
        },
        {
          type: 'list',
          ordered: true,
          spread: false,
          data: {
            hName: 'ol',
            hProperties: { className: ['footnotes__list'] },
          },
          children: order.map((id, i) => buildItem(i + 1, sources.get(id)!)),
        },
      ],
    });
  };
}
