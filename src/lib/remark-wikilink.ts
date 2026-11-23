/**
 * Remark 插件：把正文里的 `[[type:id|文字]]` 编译成站内链接。
 *
 * 为什么自己写而不装 remark-wiki-link：
 * - 需要按集合路由（person/event/polity/source 四种前缀，各走不同 URL）
 * - 必须使用 lib/url.ts 的 url() 拼前缀，否则 GitHub Pages 子路径部署 404
 * - 写错 id 时要让**构建失败**并指出位置，而不是静默渲染成纯文本
 *
 * 语法：
 *   [[person:zhuge-liang]]            → 诸葛亮（自动取 name）
 *   [[person:zhuge-liang|孔明]]        → 孔明（自定义文字）
 *   [[event:chibi]]                   → 赤壁之战
 *   [[polity:tang]]                   → 唐
 *   [[source:sanguozhi-chibi]]        → 渲染为行内引用标记，不跳转
 *
 * 注意：这个插件在构建期运行，可以同步读到内容索引。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** 支持的实体类型 */
const ENTITY_TYPES = ['person', 'event', 'polity', 'source'] as const;
type EntityType = (typeof ENTITY_TYPES)[number];

interface EntityIndex {
  /** "person:zhuge-liang" → 显示名 */
  labels: Map<string, string>;
}

/**
 * 内容根目录。
 *
 * 注意：不能用 `import.meta.dirname` —— astro.config.mjs 会被 Astro 打包到
 * 临时目录，那个值指向缓存路径而不是仓库根。用 cwd 最可靠（npm scripts
 * 总是从仓库根执行）。
 */
const ROOT = join(process.cwd(), 'src', 'content');

/** 极简 frontmatter 取值：只取 name / title / id 三个键 */
function pickScalar(raw: string, key: string): string | null {
  const m = raw.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/g, '');
}

function buildIndex(): EntityIndex {
  const labels = new Map<string, string>();
  const dirs: Array<[EntityType, string]> = [
    ['person', 'people'],
    ['event', 'events'],
    ['polity', 'polities'],
    ['source', 'sources'],
  ];
  for (const [type, dir] of dirs) {
    const abs = join(ROOT, dir);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) {
      if (!f.endsWith('.md') && !f.endsWith('.yaml')) continue;
      const text = readFileSync(join(abs, f), 'utf8');
      // .yaml 整份都是数据；.md 取 frontmatter
      const body = f.endsWith('.yaml')
        ? text
        : (text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '');
      const id = pickScalar(body, 'id');
      const label = pickScalar(body, 'name') ?? pickScalar(body, 'title');
      if (id && label) labels.set(`${type}:${id}`, label);
    }
  }
  return { labels };
}

let cachedIndex: EntityIndex | null = null;
function getIndex(): EntityIndex {
  if (!cachedIndex) cachedIndex = buildIndex();
  return cachedIndex;
}

/** 实体类型 → 站内路由段。source 暂无详情页，返回 null */
function routeOf(type: EntityType, id: string): string | null {
  switch (type) {
    case 'person':
      return `people/${id}`;
    case 'event':
      return `events/${id}`;
    case 'polity':
      return `dynasties/${id}`;
    case 'source':
      return null;
  }
}

/**
 * 拼 BASE_PATH 前缀。
 *
 * 不能用 lib/url.ts 的 url()：那个函数读 `import.meta.env.BASE_URL`，
 * 而本插件运行在 astro.config.mjs 的打包上下文里，读不到 Vite 注入的环境。
 * 直接用构建时传入的 process.env.BASE_PATH（与 astro.config 里同一来源）。
 */
function withBase(path: string): string {
  const base = (process.env.BASE_PATH ?? '/').replace(/\/+$/, '');
  const clean = path.replace(/^\/+/, '');
  return base === '' ? `/${clean}` : `${base}/${clean}`;
}

const PATTERN = /\[\[([a-z]+):([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g;

/**
 * 只处理文本节点。AST 遍历采用「递归找 children」的最小实现，
 * 避免为这一个插件引入 unist-util-visit。
 */
function visit(node: any, fn: (n: any) => void): void {
  fn(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) visit(child, fn);
  }
}

export default function remarkWikilink() {
  return (tree: any, file: any) => {
    const index = getIndex();
    const sourcePath: string = file?.path ?? '<unknown>';

    visit(tree, (node) => {
      if (node.type !== 'text' || typeof node.value !== 'string') return;
      if (!node.value.includes('[[')) return;

      const text: string = node.value;
      const replacements: any[] = [];
      let lastEnd = 0;
      PATTERN.lastIndex = 0;

      let m: RegExpExecArray | null;
      while ((m = PATTERN.exec(text))) {
        const [raw, rawType, id, explicitLabel] = m;
        const type = rawType as EntityType;

        if (!ENTITY_TYPES.includes(type)) {
          throw new Error(
            `[wikilink] 未知实体类型 "${rawType}"：${raw}\n` +
              `  位置：${sourcePath}\n` +
              `  可用类型：${ENTITY_TYPES.join(' / ')}`,
          );
        }

        const key = `${type}:${id}`;
        const autoLabel = index.labels.get(key);
        if (!autoLabel) {
          throw new Error(
            `[wikilink] 引用了不存在的条目 "${key}"\n` +
              `  位置：${sourcePath}\n` +
              `  请检查 src/content/ 下是否有对应 id 的文件`,
          );
        }

        // 前面的普通文本原样保留
        if (m.index > lastEnd) {
          replacements.push({ type: 'text', value: text.slice(lastEnd, m.index) });
        }

        const label = explicitLabel?.trim() || autoLabel;
        const route = routeOf(type, id);

        if (route === null) {
          // 史料无详情页：渲染成行内标记，等有独立页再改成链接
          replacements.push({
            type: 'emphasis',
            data: { hName: 'cite', hProperties: { className: ['wikilink-source'] } },
            children: [{ type: 'text', value: `《${label}》` }],
          });
        } else {
          replacements.push({
            type: 'link',
            // 关键：必须带 BASE_PATH，否则子路径部署会跳到域名根
            url: withBase(route),
            children: [{ type: 'text', value: label }],
          });
        }

        lastEnd = m.index + raw.length;
      }

      if (lastEnd === 0) return;
      if (lastEnd < text.length) {
        replacements.push({ type: 'text', value: text.slice(lastEnd) });
      }

      // 把当前 text 节点替换为一组节点：用父节点做替换
      node.__wikilinkReplacements = replacements;
    });

    // 第二遍：把带 __wikilinkReplacements 的文本节点替换掉
    (function replace(parent: any) {
      if (!Array.isArray(parent.children)) return;
      const next: any[] = [];
      for (const child of parent.children) {
        if (child.__wikilinkReplacements) {
          const repl = child.__wikilinkReplacements;
          delete child.__wikilinkReplacements;
          next.push(...repl);
        } else {
          replace(child);
          next.push(child);
        }
      }
      parent.children = next;
    })(tree);
  };
}
