import { writeFileSync, existsSync } from 'node:fs';

const SRC = 'src/content/sources';

const SOURCES = [
  {
    id: 'mingshi-liushan',
    title: '明史',
    volume: '卷十七·世宗本纪·赞',
    author: '张廷玉等',
    composed: '公元 1739 年',
    quote:
      '世宗御极之初，力除一切弊政，天下翕然称治。顾迭议大礼，舆论沸腾，幸臣假托，寻兴大狱。夫天性至情，君亲无将，追崇之典，岂易言哉！',
    note:
      '《世宗本纪》赞语指出嘉靖朝由「天下翕然称治」到「舆论沸腾」的转折，关键在于「大礼议」。这是理解明代中期君臣关系破裂的起点。',
  },
  {
    id: 'mingshi-xizong-zan',
    title: '明史',
    volume: '卷二十二·熹宗本纪·赞',
    author: '张廷玉等',
    composed: '公元 1739 年',
    quote:
      '明自世宗而后，纲纪日以委颓；神宗末，废坏极矣。虽有刚明英武之君，已难复振。而重以帝之庸懦，妇寺窃柄，滥赏淫刑，忠良惨祸，亿兆离心，虽欲不亡，何可得哉！',
    note:
      '《熹宗本纪》赞语把明亡的责任串成一条线：世宗以后纲纪日颓、神宗末年废坏、熹宗时「妇寺窃柄」。这是《明史》对明亡原因最系统的表述。',
  },
  {
    id: 'mingshi-yangjisheng',
    title: '明史',
    volume: '卷二〇九·杨继盛传',
    author: '张廷玉等',
    composed: '公元 1739 年',
    quote:
      '继盛乃草疏劾严嵩十大罪五奸，曰：「臣与嵩势不两立，不共戴天。」……疏入，帝大怒，下诏狱，杖一百，坐诈传亲王令旨，斩于西市。临刑，赋诗曰：「浩气还太虚，丹心照千古；生平未报恩，留作忠魂补。」',
    note:
      '《杨继盛传》是明中叶士人反抗权臣最悲壮的一篇。他弹劾严嵩而不成，受杖下狱三年，终被杀。此传所记的「浩气还太虚」诗，为明代士人气节的代表。',
  },
  {
    id: 'mingshi-hai-rui',
    title: '明史',
    volume: '卷二二六·海瑞传',
    author: '张廷玉等',
    composed: '公元 1739 年',
    quote:
      '瑞生平为学，以刚为主，因自号刚峰，天下称刚峰先生。……帝得疏，大怒，抵之地，顾左右曰：「趣执之，无使得遁！」宦官黄锦在侧曰：「此人素有痴名。闻其上疏时，自知触忤当死，市一棺，诀妻子，待罪于朝。」帝默然。',
    note:
      '《海瑞传》记其上《治安疏》后「市一棺，诀妻子」的细节，是明代谏臣最极端的例子。嘉靖「默然」的反应，说明连皇帝也被这种做法震住。',
  },
  {
    id: 'mingshi-zhangjuzheng-2',
    title: '明史',
    volume: '卷二百十三·张居正传',
    author: '张廷玉等',
    composed: '公元 1739 年',
    quote:
      '居正之为政，以尊主权、课吏职、信赏罚、一号令为主。虽万里外，朝下而夕奉行。黔国公沐朝弼数犯法，当逮，朝议难之。居正擢用其子，驰使缚之，不敢动。',
    note:
      '《张居正传》正文记其执政风格「以尊主权、课吏职、信赏罚、一号令为主」，这一描述比传末赞语更直接：他的改革本质是行政效率的提升。',
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
