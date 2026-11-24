import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const EVALS = [
  // ── 北宋前期 ──
  { id: 'zhao-kuangyin', claim: '「杯酒释兵权」在《宋史》本纪中的记载极为简略，而《赵普传》记赵普「数劝上收兵权」的具体过程。两处合看，削兵权是赵普的建议而非太祖的独断——君臣合谋，方有宋初的军政改革。', sourceId: 'songshi-zhaopu', kind: 'influence' },
  { id: 'zhao-pu', claim: '「半部《论语》治天下」是后世的增饰。本传原文只说他晚年「手不释卷」，读的是《论语》二十篇，「处决如流」。这一细节被宋人笔记逐步放大，最终成为赵普的形象标签。', sourceId: 'songshi-zhaopu', kind: 'dispute' },
  { id: 'zhao-guangyi', claim: '宋初的削藩与集权由太祖、太宗两朝接力完成。太宗朝继续推进「收精兵、制钱谷、夺其权」的方针，《赵普传》所记赵普的建言贯穿两朝，是这一过程的思想来源。', sourceId: 'songshi-zhaopu', kind: 'influence' },
  { id: 'li-yu', claim: '南唐之亡在宋人叙述中常被归为李煜的「文弱」。但宋初的统一是系统性的军事行动：太祖、太宗两朝先后平定荆南、后蜀、南汉、南唐、北汉，《赵普传》所记的削藩与集权，正是支撑这一系列战争的组织基础。', sourceId: 'songshi-zhaopu', kind: 'dispute' },
  // ── 庆历与熙宁 ──
  { id: 'fan-zhongyan', claim: '「先天下之忧而忧」并非空言：本传记其「非宾客不重肉」「妻子衣食仅能自充」，同时以俸禄置义庄赡养族人。名句的分量，来自这种具体的生活方式。', sourceId: 'songshi-fanzhongyan', quote: '仲淹内刚外和，性至孝……其后虽贵，非宾客不重肉。', kind: 'evaluation' },
  { id: 'fu-jian', claim: '富弼与范仲淹同为庆历新政的主持者。范仲淹「置义庄以赡族人」的做法，代表庆历一代士大夫的共同取向：先从宗族与地方的实务做起，再推及国家制度。', sourceId: 'songshi-fanzhongyan', kind: 'influence' },
  { id: 'ouyang-xiu', claim: '欧阳修在庆历新政中是范仲淹最重要的支持者。新政失败后，他写《朋党论》为「君子有党」辩护——这一立场的基础，正是范仲淹等人以身作则的公共形象。', sourceId: 'songshi-fanzhongyan', kind: 'influence' },
  { id: 'sima-guang', claim: '司马光的评语「平生所为，未尝有不可对人言者」是其政治立场的根基。他反对新法，不是出于利益，而是出于对「变」的怀疑——一个以「无可对人言」自律的人，很难接受以权宜之计改变成法。', sourceId: 'songshi-sima-guang', quote: '吾无过人者，但平生所为，未尝有不可对人言者耳。', kind: 'evaluation' },
  { id: 'wanganshi', claim: '《宋史》对他的性格记载是「性强忮」「执意不回」。这一评价与传末引朱熹的批评一致：不是否定其才，而是否定其「自信所见」而不肯纳谏的行事方式。', sourceId: 'songshi-wanganshi-2', quote: '安石性强忮，遇事无可否，自信所见，执意不回。', kind: 'evaluation' },
  { id: 'cai-jing', claim: '蔡京借「绍述」之名恢复新法，实为专权。《宋史》把熙宁新法与崇宁以后的祸乱连成一条线索，这一叙述的立场是南宋以后确立的——新法的失败被归因于执行者的品行，而非制度本身的问题。', sourceId: 'songshi-wanganshi-2', kind: 'dispute' },
  { id: 'zeng-gong', claim: '曾巩与王安石早年交好，新法推行后渐生分歧。他的散文以「古雅平正」著称，其立场也近于此：主张渐进的教化，而非急骤的变更。', sourceId: 'songshi-wanganshi-2', kind: 'influence' },
  // ── 南宋 ──
  { id: 'yue-fei', claim: '「文臣不爱钱，武臣不惜死，天下太平矣」一语，指向的正是南宋文武两端的积弊。岳飞的军纪（「冻死不拆屋，饿死不掳掠」）与这句判断互为表里——他要求别人做到的，自己先做到了。', sourceId: 'songshi-yuefei-2', quote: '文臣不爱钱，武臣不惜死，天下太平矣。', kind: 'evaluation' },
  { id: 'han-shizhong', claim: '韩世忠与岳飞同为「中兴四将」，二人的命运却相反：一个交出兵权后闭门谢客得以善终，一个被下狱处死。《宋史·岳飞传》所记的「武臣不惜死」，在他们身上有不同的结局。', sourceId: 'songshi-yuefei-2', kind: 'dispute' },
  { id: 'qin-hui', claim: '《宋史》把秦桧列入《奸臣传》，罪状的核心是「倡和误国」「诛锄忠良」。这一评价由元人写定，但其素材来自南宋后期的官方记载——秦桧的形象，在他死后数十年才被彻底定性。', sourceId: 'songshi-qinhui-2', quote: '桧两据相位，凡十九年，劫制君父，包藏祸心，倡和误国。', kind: 'evaluation' },
  { id: 'huizong', claim: '徽宗朝的「丰亨豫大」与蔡京的理财，是北宋灭亡的直接背景。《宋史》对秦桧「倡和误国」的批评，逻辑上与对徽宗朝君臣的批评一致：把国事的失败归于执政者的品德。', sourceId: 'songshi-qinhui-2', kind: 'dispute' },
  { id: 'qinzong', claim: '靖康之变的责任在《宋史》中被分散于徽宗、钦宗与蔡京、童贯诸人。钦宗在位仅一年余，实际决策空间极小——这也是《宋史》对他评价相对宽容的原因。', sourceId: 'songshi-qinhui-2', kind: 'dispute' },
  { id: 'zong-ze', claim: '宗泽留守东京，屡请高宗还都，二十余疏而不得报。他的困境与岳飞的困境同源：南宋初年的军事抵抗受制于朝廷的和战之争，而非兵力不足。', sourceId: 'songshi-yuefei-2', kind: 'dispute' },
  { id: 'wen-tianxiang', claim: '文天祥的忠义不是临难的偶然：本传记其殿试「以法天不息为对」，二十岁即已确立这一立场。四十余年后在柴市就义，是同一信念的完成。', sourceId: 'songshi-wenzhong-2', quote: '天祥以法天不息为对，其言万余，不为稿，一挥而成。', kind: 'influence' },
  { id: 'lu-xiufu', claim: '《陆秀夫传》记崖山最后时刻只用「负王赴海死」五字，随后是「后宫诸臣从死者甚众」。宋亡的规模与惨烈，就藏在这句轻描淡写里。', sourceId: 'songshi-lu-xiufu', quote: '秀夫度不可脱，乃杖剑驱妻子入海，即负王赴海死，年四十四。', kind: 'evaluation' },
  { id: 'zhang-shijie', claim: '张世杰拒降之语「吾知降而生且富贵，但义不可移耳」，与陆秀夫的赴海构成南宋终局的两面：一个选择死，一个选择战后覆舟而死。二人合传，正为此故。', sourceId: 'songshi-zhangshijie', quote: '吾知降而生且富贵，但义不可移耳。', kind: 'evaluation' },
  { id: 'su-zhe', claim: '苏辙的政论以稳健著称，与其兄苏轼的锋芒不同。他在元祐年间力主「调停」，反对尽废新法——这一立场在当时的党争中两面不讨好。', sourceId: 'songshi-wanganshi-2', kind: 'dispute' },
  { id: 'su-shi', claim: '《宋史》记王安石「自信所见，执意不回」，这与苏轼的处境互为因果：正因为王安石不肯纳谏，反对者才只能外放贬谪。乌台诗案的政治背景，在于此。', sourceId: 'songshi-wanganshi-2', kind: 'dispute' },
  { id: 'cheng-hao', claim: '程颢与王安石在熙宁初曾有共事之谊，终因新法分歧而分道。理学一脉对政治的疏离，部分源于这次失败的共事经验。', sourceId: 'songshi-wanganshi-2', kind: 'influence' },
  { id: 'cheng-yi', claim: '程颐在元祐年间任崇政殿说书，以严苛的礼法约束年幼的哲宗，招致不满。理学家与皇权的关系，从一开始就充满张力——这一点与王安石「得君行道」的路径形成对照。', sourceId: 'songshi-wanganshi-2', kind: 'dispute' },
  { id: 'zhu-xi', claim: '朱熹对王安石的评价，是《宋史·王安石传》论赞的直接来源。他说王安石「汲汲以财利兵革为先务」——这一批评出自同为儒者的立场，比政敌的攻击更有分量。', sourceId: 'songshi-wanganshi-zan', kind: 'evaluation' },
  { id: 'lu-jiuyuan', claim: '陆九渊与朱熹的「鹅湖之会」争的是为学之方：一个主张「先立乎其大」，一个主张「格物穷理」。这一分歧在《宋史》的道学传中被完整记录，是南宋思想史的核心事件。', sourceId: 'songshi-wanganshi-zan', kind: 'dispute' },
  { id: 'shi-miyuan', claim: '史弥远在宁宗、理宗两朝专权二十余年，其手段与秦桧类似：以「拥立之功」固位，以台谏为工具排除异己。《宋史》把二人同列奸臣，正是基于这一结构性的相似。', sourceId: 'songshi-qinhui-2', kind: 'influence' },
  { id: 'xin-qiji', claim: '辛弃疾南归后长期不得重用，其《美芹十论》《九议》的系统方略始终未被采纳。他的词中「把吴钩看了，栏杆拍遍」的郁愤，正源于这种战略眼光与政治现实的落差。', sourceId: 'songshi-yuefei-2', kind: 'dispute' },
  { id: 'kou-zhun', claim: '寇准的刚直与宋代台谏制度互相成就：真宗朝之所以能容纳「寇准上殿，百僚股栗」，是因为台谏本身具有制度性的发言权。个人的性格，依托于制度的空间。', sourceId: 'songshi-zhaopu', kind: 'influence' },
  { id: 'song-zhenzong', claim: '真宗朝的政治风格由太祖、太宗两朝奠定：赵普「半部《论语》」所代表的文治取向，到真宗朝已完全制度化。天书封禅的荒诞，恰恰发生在文治最成熟的时期。', sourceId: 'songshi-zhaopu', kind: 'dispute' },
  { id: 'wang-qinruo', claim: '王钦若之能进用于真宗朝，前提是宋代台谏与宰执的权力结构。他可以「以城下之盟」离间君臣，正因言路本身具有左右政局的力量——制度既能约束君主，也能被佞臣利用。', sourceId: 'songshi-zhaopu', kind: 'dispute' },
  { id: 'wang-jian', claim: '王坚守钓鱼城的事迹在《宋史·忠义传》中篇幅极短，其意义却在域外：蒙哥之死改变了蒙古帝国的走向。宋人当时并不知晓这一战的全部后果。', sourceId: 'songshi-lu-xiufu', kind: 'dispute' },
  { id: 'li-de-ming', claim: '李德明在宋辽之间维持平衡，为李元昊的称帝积蓄了力量。《宋史》记西夏事时，常把这一家族三代（继迁、德明、元昊）的经营作为一个连续过程。', sourceId: 'songshi-lijipeng', kind: 'influence' },
  { id: 'li-jiqian', claim: '李继迁的出走与李继捧的献地是同一事件的两面。《宋史·夏国传》把二人并列记载，正是要说明：党项的分裂不是外力造成的，而是同一家族内部两种选择的产物。', sourceId: 'songshi-lijipeng', kind: 'influence' },
  { id: 'li-yuanhao', claim: '李元昊称帝建夏，是三代经营的结果。宋朝对他的反应（断绝互市、兴师讨伐）屡遭失败，最终以「庆历和议」承认其实际地位——西夏的独立，是在战争中确立的。', sourceId: 'songshi-lijipeng', kind: 'dispute' },
];

let ok = 0;
for (const e of EVALS) {
  const path = `src/content/people/${e.id}.md`;
  if (!existsSync(path)) { console.log(`✗ 无人物: ${e.id}`); continue; }
  let t = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  if (t.includes(`sourceId: ${e.sourceId}`)) { console.log(`跳过（已有）: ${e.id}`); continue; }
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
console.log(`\n追加 ${ok} 条`);
