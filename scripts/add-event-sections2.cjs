/**
 * 第二遍：给「正文没有粗体分段」的事件按段落位置插入三个小节标题。
 *
 * 配置为 [bg, act, inf]，指向**正文段落**（空行分隔，不数标题、列表、引文块）的序号。
 * 同样只插入标题，不改动正文。
 */
const { readFileSync, writeFileSync } = require('fs');

const CONFIG = {
  saerhu: [0, 2, 6],
  sanfan: [0, 3, 9],
  'shizong-reform': [0, 1, 6],
  'shoushi-calendar': [0, 1, 3],
  'taicheng-starve': [0, 1, 5],
  'taiwan-conquest': [0, 2, 6],
  'tumu-fort': [0, 3, 8],
  'wu-chu-rebellion': [0, 1, 2],
  wuxu: [0, 2, 6],
  wuzhangyuan: [0, 1, 7],
  'beifa-liuyu': [0, 1, 4],
  taiping: [0, 1, 7],
};

let ok = 0;
const skipped = [];

for (const [id, [bg, act, inf]] of Object.entries(CONFIG)) {
  const p = `src/content/events/${id}.md`;
  const raw = readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  if (/^##\s*(背景|经过|影响)/m.test(raw)) {
    skipped.push(`${id}（已有小节）`);
    continue;
  }
  if (!(bg < act && act < inf)) {
    skipped.push(`${id}（索引不递增）`);
    continue;
  }

  const lines = raw.split('\n');
  let fmEnd = 1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      fmEnd = i;
      break;
    }
  }

  // 段落起点：非空、且上一行为空（或紧接 frontmatter）
  const starts = [];
  for (let i = fmEnd + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    const prev = i === fmEnd + 1 ? '' : lines[i - 1];
    if (prev.trim() === '') starts.push(i);
  }

  if (starts.length <= Math.max(bg, act, inf)) {
    skipped.push(`${id}（段落数不足：${starts.length}）`);
    continue;
  }

  const inserts = [
    [starts[inf], '## 影响'],
    [starts[act], '## 经过'],
    [starts[bg], '## 背景'],
  ].sort((a, b) => b[0] - a[0]);

  for (const [idx, title] of inserts) lines.splice(idx, 0, title, '');
  writeFileSync(p, lines.join('\n'), 'utf8');
  ok++;
}

console.log(`已补小节标题：${ok} 篇`);
if (skipped.length) console.log('跳过：\n  ' + skipped.join('\n  '));
