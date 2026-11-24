/**
 * 给已有 **粗体分段** 的事件补上「背景 / 经过 / 影响」三级小节标题。
 *
 * 只做「插入标题」，不改动任何正文文字——所有原段落原样保留，
 * 因此不会引入新的论断或改写史料引文。
 *
 * 配置为 [bg, act, inf]，指向第 n 个 **粗体分段**（0 起）：
 *   bg  → 在此段前插入 `## 背景`
 *   act → 在此段前插入 `## 经过`
 *   inf → 在此段前插入 `## 影响`
 * 要求 bg < act < inf，否则脚本跳过并报告（那几篇需要人工补背景段）。
 */
const { readFileSync, writeFileSync } = require('fs');

const CONFIG = {
  baideng: [0, 2, 6],
  'baidi-tuogu': [0, 1, 4],
  'beiwei-split': [0, 1, 4],
  'cai-lun': [0, 2, 4],
  'diaoyu-fortress': [0, 1, 3],
  'east-tujue-fall': [0, 2, 6],
  'gaoping-battle': [0, 1, 5],
  guangwu: [0, 1, 4],
  kaiyuan: [0, 1, 8],
  'later-zhao-founded': [0, 1, 7],
  'liu-bei-emperor': [0, 2, 4],
  mawei: [0, 1, 4],
  mobei: [0, 1, 5],
  modu: [0, 1, 5],
  'qianqin-unify-north': [0, 1, 5],
  'qianyan-rise-fall': [0, 1, 4],
  'shu-fall': [0, 1, 5],
  'six-garrisons': [0, 3, 5],
  'taichu-calendar': [0, 2, 5],
  'three-korea-campaigns': [0, 1, 4],
  'tujue-founded': [0, 2, 5],
  'wagang-rebellion': [0, 1, 4],
  wencheng: [0, 1, 4],
  'wudi-miefo': [0, 2, 5],
  'xuanwu-gate-tang': [0, 2, 4],
  'yellow-turban': [0, 2, 3],
  yiling: [0, 1, 4],
  'zhou-reunify-north': [0, 1, 6],
  feishui: [0, 2, 5],
  'zhang-qian': [0, 1, 3],
  dazexiang: [0, 2, 4],
  julu: [0, 2, 5],
};

let ok = 0;
const skipped = [];

for (const [id, [bg, act, inf]] of Object.entries(CONFIG)) {
  const p = `src/content/events/${id}.md`;
  let raw = readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  if (/^##\s*(背景|经过|影响)/m.test(raw)) {
    skipped.push(`${id}（已有小节标题）`);
    continue;
  }
  if (!(bg < act && act < inf)) {
    skipped.push(`${id}（索引不递增）`);
    continue;
  }

  const lines = raw.split('\n');
  // frontmatter 结束行
  let fmEnd = 1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      fmEnd = i;
      break;
    }
  }

  // 找出所有以 ** 开头的段落行号
  const heads = [];
  for (let i = fmEnd + 1; i < lines.length; i++) {
    if (/^\*\*.+\*\*/.test(lines[i])) heads.push(i);
  }

  const need = Math.max(bg, act, inf);
  if (heads.length <= need) {
    skipped.push(`${id}（粗体分段不足 ${need + 1} 个）`);
    continue;
  }

  // 从后往前插入，避免行号偏移
  const inserts = [
    [heads[inf], '## 影响'],
    [heads[act], '## 经过'],
    [heads[bg], '## 背景'],
  ].sort((a, b) => b[0] - a[0]);

  for (const [idx, title] of inserts) {
    lines.splice(idx, 0, title, '');
  }

  writeFileSync(p, lines.join('\n'), 'utf8');
  ok++;
}

console.log(`已补小节标题：${ok} 篇`);
if (skipped.length) console.log('跳过：\n  ' + skipped.join('\n  '));
