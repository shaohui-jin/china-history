import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const SRC = 'src/content/sources';

const SOURCES = [
  {
    id: 'hanshu-wudi-jiao-si',
    title: '汉书',
    volume: '卷六·武帝纪·赞',
    author: '班固',
    composed: '约公元 82 年',
    quote:
      '汉承百王之弊，高祖拨乱反正，文景务在养民，至于稽古礼文之事，犹多阙焉。孝武初立，卓然罢黜百家，表章《六经》。遂畴咨海内，举其俊茂，与之立功。兴太学，修郊祀，改正朔，定历数，协音律，作诗乐，建封禅，礼百神，绍周后，号令文章，焕焉可述。',
    note:
      '《汉书·武帝纪》赞语历数其文治举措：罢黜百家、兴太学、改正朔、定历数、建封禅。与《史记》重在记其武功不同，班固更重视制度与文化建设的部分。',
  },
  {
    id: 'hanshu-dongzhongshu-2',
    title: '汉书',
    volume: '卷五十六·董仲舒传·赞',
    author: '班固',
    composed: '约公元 82 年',
    quote:
      '刘向称「董仲舒有王佐之材，虽伊吕亡以加，筦晏之属，伯者之佐，殆不及也」。至向子歆以为「伊吕乃圣人之耦，王者不得则不兴。故颜渊死，孔子曰『噫！天丧余』。唯此一人为能当之，自宰我、子赣、子游、子夏不与焉。仲舒遭汉承秦灭学之后，六经离析，下帷发愤，潜心大业，令后学者有所统壹，为群儒首」。',
    note:
      '班固引用刘向、刘歆父子的两代评价：刘向许以「王佐之材」，刘歆则降一等，只承认其「为群儒首」。这一分歧本身说明董仲舒的历史定位在当时即有争议。',
  },
  {
    id: 'hanshu-jia-yi',
    title: '汉书',
    volume: '卷四十八·贾谊传',
    author: '班固',
    composed: '约公元 82 年',
    quote:
      '谊以为汉兴二十余年，天下和洽，宜当改正朔，易服色制度，定官名，兴礼乐。乃草具其仪法，色上黄，数用五，为官名悉更，奏之。文帝谦让未皇也。',
    note:
      '《贾谊传》记其改制主张与文帝的反应，是理解汉初「改正朔、易服色」这一政治议题的原始材料，可与《武帝纪》所记太初改历对读。',
  },
];

for (const s of SOURCES) {
  const path = `${SRC}/${s.id}.yaml`;
  if (existsSync(path)) { console.log(`跳过: ${s.id}`); continue; }
  writeFileSync(path, [
    `id: ${s.id}`, `title: ${s.title}`, `volume: ${s.volume}`,
    `author: ${s.author}`, `composed: ${s.composed}`,
    `quote: ${s.quote}`, `note: ${s.note}`, '',
  ].join('\n'), 'utf8');
  console.log(`✓ 史料 ${s.id}`);
}

const EVALS = [
  { id: 'liu-che', claim: '班固的赞语把汉武帝的功业落在文治上：罢黜百家、兴太学、改正朔、定历数、建封禅。与《史记》重在记其征伐不同，这一评价强调的是制度与文化的奠基，而非疆域的扩张。', sourceId: 'hanshu-wudi-jiao-si', kind: 'evaluation' },
  { id: 'liu-che', claim: '同一段赞语也留下一个反问：「如武帝之雄材大略，不改文景之恭俭以济斯民，虽《诗》《书》所称，何有加焉！」——以「不改」二字暗指其奢靡伤民，褒中带贬。', sourceId: 'hanshu-wudi-zan', kind: 'dispute' },
  { id: 'dong-zhongshu', claim: '刘向称其「有王佐之材，虽伊吕亡以加」，其子刘歆则降一等，只承认「为群儒首」。父子两代的评价分歧，恰好说明董仲舒的历史定位在当时即有争议：是治国的王佐，还是儒学的宗师？', sourceId: 'hanshu-dongzhongshu-2', kind: 'dispute' },
  { id: 'chao-cuo', claim: '晁错的削藩主张并非孤例。贾谊在文帝时已提出「改正朔、易服色、定官名、兴礼乐」，同样试图以制度变更解决王国问题，而文帝「谦让未皇」，未予采纳。两代人的方案都指向同一件事：中央必须收回诸王的权力。', sourceId: 'hanshu-jia-yi', kind: 'influence' },
  { id: 'jia-yi', claim: '贾谊的改制方案（改正朔、易服色、定官名、兴礼乐）在文帝时被搁置，却在武帝朝由董仲舒、司马迁等人接力完成。一个时代的「迂阔之论」，往往是下一个时代的施政纲领。', sourceId: 'hanshu-wudi-jiao-si', kind: 'influence' },
];

for (const e of EVALS) {
  const path = `src/content/people/${e.id}.md`;
  if (!existsSync(path)) { console.log(`✗ 无人物: ${e.id}`); continue; }
  let t = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  const block = t.match(/^evaluations:\n((?:[ \t]+.*\n?)+)/m);
  if (!block) { console.log(`✗ 无 evaluations: ${e.id}`); continue; }
  // 避免重复
  if (t.includes(`sourceId: ${e.sourceId}`)) { console.log(`跳过（已有该出处）: ${e.id}`); continue; }
  const item = [`  - claim: ${e.claim}`, `    sourceId: ${e.sourceId}`, `    kind: ${e.kind}`, ''].join('\n');
  const endIdx = block.index + block[0].length;
  t = t.slice(0, endIdx) + item + t.slice(endIdx);
  writeFileSync(path, t, 'utf8');
  console.log(`✓ 评价 ${e.id}`);
}
