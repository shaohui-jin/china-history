/**
 * Remark 插件：把正文里的 `{文言原文|白话译文}` 编译为行内注释。
 *
 * 为什么需要它：
 * 本站正文是浅近文言，且 61% 的事件含大段古籍引文。直接读会有门槛，
 * 但整段改写成白话又会丢掉史料的原始语气。折中做法是**原文保留、译文旁注**，
 * 与古籍译注的阅读体验一致。
 *
 * 语法：
 *   黄盖曰：{今寇众我寡，难与持久|现在敌多我寡，难以持久}[^sanguozhi-chibi]
 *
 * 输出（mdast → hast）：
 *   <span class="gloss" tabindex="0" data-gloss="现在敌多我寡，难以持久">今寇众我寡，难与持久</span>
 *
 * 为什么用「浮层」而不是 <ruby>：
 * 中文白话译文往往比原文长数倍（「寇众我寡」→「敌多我寡」还算短，
 * 「实以薪草，膏油灌其中」→「用干柴填满船腹，再灌进膏油」就是两倍多），
 * ruby 会把行高撑坏。浮层只在需要时出现，不影响正文排版。
 *
 * 交互（在 global.css 中定义）：
 *   - 桌面：hover 显示
 *   - 键盘：focus 显示
 *   - 触屏：点击切换 data-open
 *
 * 与 wikilink 的顺序：必须在 wikilink **之前**跑。
 * wikilink 会把文本节点替换成链接节点，之后 gloss 就扫不到了。
 * 与 footnote 的顺序：必须在 footnote **之后**。
 * 因为脚注会切分文本节点，先跑 footnote 能保证 gloss 扫到的是完整的文本片段。
 */
import type { Plugin } from 'unified';

/** `{原文|译文}`。原文与译文都不允许跨行，也不允许嵌套括号 */
const PATTERN = /\{([^{}|\n]+)\|([^{}|\n]+)\}/g;

function visit(node: any, fn: (n: any) => void): void {
  fn(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) visit(child, fn);
  }
}

/** 构造一个 gloss 节点 */
function buildGloss(original: string, gloss: string): any {
  return {
    type: 'emphasis',
    data: {
      hName: 'span',
      hProperties: {
        className: ['gloss'],
        // tabindex 让键盘用户也能 Tab 到，触发 :focus 显示
        tabIndex: 0,
        'data-gloss': gloss,
      },
    },
    children: [{ type: 'text', value: original }],
  };
}

const remarkGloss: Plugin = () => {
  return (tree: any) => {
    visit(tree, (node) => {
      if (node.type !== 'text' || typeof node.value !== 'string') return;
      if (!node.value.includes('{')) return;

      const text: string = node.value;
      const replacements: any[] = [];
      let lastEnd = 0;

      PATTERN.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = PATTERN.exec(text))) {
        const [raw, original, gloss] = m;

        if (m.index > lastEnd) {
          replacements.push({ type: 'text', value: text.slice(lastEnd, m.index) });
        }

        replacements.push(buildGloss(original.trim(), gloss.trim()));

        lastEnd = m.index + raw.length;
      }

      if (lastEnd === 0) return;
      if (lastEnd < text.length) {
        replacements.push({ type: 'text', value: text.slice(lastEnd) });
      }

      // 与 footnote 用同一套「先标记、后统一替换」手法：
      // 在遍历中途改 children 会让 visit 陷入不确定状态
      node.__glossReplacements = replacements;
    });

    (function replace(parent: any) {
      if (!Array.isArray(parent.children)) return;
      const next: any[] = [];
      for (const child of parent.children) {
        if (child.__glossReplacements) {
          const repl = child.__glossReplacements;
          delete child.__glossReplacements;
          next.push(...repl);
        } else {
          replace(child);
          next.push(child);
        }
      }
      parent.children = next;
    })(tree);
  };
};

export default remarkGloss;
