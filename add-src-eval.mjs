import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const SRC = 'src/content/sources';

/** 新增史料（id、书名、卷、引文、说明） */
const SOURCES = [
  {
    id: 'hanshu-hanxin',
    title: '汉书',
    volume: '卷三十四·韩彭英卢吴传',
    author: '班固',
    composed: '约公元 82 年',
    quote:
      '信之初起，非有土人之资也，徒以权谋取天下。……夫乘时以徼利者，市井之志也；醻功而报德者，士君子之心也。信以市井之志利其身，而以士君子之心望于人，不亦难哉！',
    note:
      '《汉书》对韩信的评语与《史记》不同：司马迁惜其「不学道谦让」，班固则用「市井之志」与「士君子之心」的错位来解释其败亡，立场更倾向于批评。',
  },
  {
    id: 'hanshu-zhangliang',
    title: '汉书',
    volume: '卷四十·张陈王周传',
    author: '班固',
    composed: '约公元 82 年',
    quote:
      '良从上入关，性多病，未尝特将也，常为画策臣，时时从汉王。……高帝曰：「运筹帷幄之中，决胜千里之外，子房功也。」',
    note:
      '《汉书·张良传》补充了《史记》未详的一点：「未尝特将也，常为画策臣」——张良始终不掌兵，这是他能善终的结构性原因。',
  },
  {
    id: 'hanshu-xiaohe-ping',
    title: '汉书',
    volume: '卷三十九·萧何曹参传',
    author: '班固',
    composed: '约公元 82 年',
    quote:
      '何薨，参代何为相国，举事无所变更，一遵何之约束。……百姓歌之曰：「萧何为法，较若画一；曹参代之，守而勿失。载其清净，民以宁一。」',
    note:
      '「萧规曹随」一节出《汉书》，与《史记·萧相国世家》所记互补：萧何的真正遗产不是某项政策，而是一套可以「守而勿失」的成法。',
  },
];

for (const s of SOURCES) {
  const path = `${SRC}/${s.id}.yaml`;
  if (existsSync(path)) {
    console.log(`跳过（已存在）: ${s.id}`);
    continue;
  }
  const body = [
    `id: ${s.id}`,
    `title: ${s.title}`,
    `volume: ${s.volume}`,
    `author: ${s.author}`,
    `composed: ${s.composed}`,
    `quote: ${s.quote}`,
    `note: ${s.note}`,
    '',
  ].join('\n');
  writeFileSync(path, body, 'utf8');
  console.log(`✓ 史料 ${s.id}`);
}

/** 给人物追加一条评价 */
const EVALS = [
  {
    id: 'han-xin',
    claim:
      '班固的解释与司马迁不同：他认为韩信的败亡源于一种错位——「以市井之志利其身，而以士君子之心望于人」。韩信以权谋取利，却期待刘邦以道义回报，这在帝王政治中不成立。',
    sourceId: 'hanshu-hanxin',
    kind: 'dispute',
  },
  {
    id: 'zhang-liang',
    claim:
      '张良终身「未尝特将」，始终以画策臣的身份随侍刘邦左右。这一细节是理解他善终的关键：无兵权、无封地之外的势力，也就不构成对皇权的威胁。',
    sourceId: 'hanshu-zhangliang',
    kind: 'influence',
  },
  {
    id: 'xiao-he',
    claim:
      '萧何的遗产不是某项具体政策，而是一套「守而勿失」的成法。曹参代相后「举事无所变更，一遵何之约束」，百姓歌曰「萧何为法，较若画一」——汉初的休养生息，靠的正是这种制度上的连续性。',
    sourceId: 'hanshu-xiaohe-ping',
    quote: '萧何为法，较若画一；曹参代之，守而勿失。载其清净，民以宁一。',
    kind: 'influence',
  },
];

for (const e of EVALS) {
  const path = `src/content/people/${e.id}.md`;
  let t = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  const block = t.match(/^evaluations:\n((?:[ \t]+.*\n?)+)/m);
  if (!block) {
    console.log(`✗ 无 evaluations: ${e.id}`);
    continue;
  }
  const item = [
    `  - claim: ${e.claim}`,
    `    sourceId: ${e.sourceId}`,
    ...(e.quote ? [`    quote: ${e.quote}`] : []),
    `    kind: ${e.kind}`,
    '',
  ].join('\n');
  // 追加到 evaluations 块末尾
  const endIdx = block.index + block[0].length;
  t = t.slice(0, endIdx) + item + t.slice(endIdx);
  writeFileSync(path, t, 'utf8');
  console.log(`✓ 评价 ${e.id}`);
}
