import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const EVALS = [
  { id: 'wang-anshi', claim: '《宋史》对他的性格记载是「性强忮」「执意不回」，与传末引朱熹的批评互为表里：不是否定其才，而是否定其「自信所见」而不肯纳谏的行事方式。', sourceId: 'songshi-wanganshi-2', quote: '安石性强忮，遇事无可否，自信所见，执意不回。', kind: 'evaluation' },
  { id: 'zhuxi', claim: '朱熹对王安石的评价，是《宋史·王安石传》论赞的直接来源。他说王安石「汲汲以财利兵革为先务」——这一批评出自同为儒者的立场，比政敌的攻击更有分量。', sourceId: 'songshi-wanganshi-zan', kind: 'evaluation' },
  { id: 'zhuxi', claim: '朱熹本人也曾被列入「伪学」之禁（庆元党禁），门人蔡元定流放道州。他在世时的处境与身后被尊为「朱子」的地位，反差极大——思想的权威往往是后世追加的。', sourceId: 'songshi-wanganshi-zan', kind: 'dispute' },
];

let ok = 0;
for (const e of EVALS) {
  const path = `src/content/people/${e.id}.md`;
  if (!existsSync(path)) { console.log(`✗ 无人物: ${e.id}`); continue; }
  let t = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  if (t.includes(`sourceId: ${e.sourceId}`)) { console.log(`跳过: ${e.id}`); continue; }
  const block = t.match(/^evaluations:\n((?:[ \t]+.*\n?)+)/m);
  if (!block) { console.log(`✗ 无 evaluations: ${e.id}`); continue; }
  const item = [
    `  - claim: ${e.claim}`,
    `    sourceId: ${e.sourceId}`,
    ...(e.quote ? [`    quote: ${e.quote}`] : []),
    `    kind: ${e.kind}`,
    '',
  ].join('\n');
  const endIdx = block.index + block[0].length;
  t = t.slice(0, endIdx) + item + t.slice(endIdx);
  writeFileSync(path, t, 'utf8');
  ok++;
}
console.log(`追加 ${ok} 条`);
