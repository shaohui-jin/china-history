import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const EVALS = [
  // ── 明初 ──
  { id: 'zhu-yuanzhang', claim: '洪武朝的政治遗产在《明史》中被反复追溯。世宗以后「纲纪日以委颓」的评价，反过来说明洪武所立的制度（废相、锦衣卫、祖训）在最初确实维持了强势的中央集权。', sourceId: 'mingshi-xizong-zan', kind: 'influence' },
  { id: 'zhu-di', claim: '永乐朝的另一面是士人的恐惧。方孝孺被诛十族、景清被「瓜蔓抄」，这些记载与「永乐盛世」并存——同一时期，既有下西洋的壮举，也有对建文旧臣的彻底清算。', sourceId: 'mingshi-yangjisheng', kind: 'dispute' },
  { id: 'jianwen', claim: '建文帝的下落成为明史一大疑案，《明史》本纪只记「宫中火起，帝不知所终」。这一空白使永乐朝的合法性始终存在裂缝，也是此后数十年间不断有人冒称建文帝的原因。', sourceId: 'mingshi-xizong-zan', kind: 'dispute' },
  { id: 'liu-bowen', claim: '刘基的死后哀荣与明初功臣的整体命运一致：洪武朝封爵者多不得善终，唯有「不掌兵、不结党」者能保全。刘基虽已致仕，仍被胡惟庸一案牵连。', sourceId: 'mingshi-xizong-zan', kind: 'dispute' },
  { id: 'hu-weiyong', claim: '胡惟庸案的本质在《明史》的叙述中很清楚：以一人之罪废千年之制。中书省与丞相被永久废除，六部直隶皇帝——这一制度变更的实际执行者是朱元璋，胡惟庸只是契机。', sourceId: 'mingshi-zhangjuzheng-2', kind: 'dispute' },
  { id: 'yongle-dadian', claim: '《永乐大典》的编纂与下西洋同属永乐朝的国家工程。《明史》记此类事的篇幅极简，评价也集中于耗费，而非文化价值。', sourceId: 'mingshi-yangjisheng', kind: 'dispute' },
  // ── 明中期 ──
  { id: 'yu-qian', claim: '土木之变后的北京保卫战，是在「纲纪日以委颓」的背景下完成的。《明史》把于谦的功业放在这一长时段的衰颓趋势中，更显出他的孤绝：不是制度在支撑他，而是他一个人在支撑制度。', sourceId: 'mingshi-xizong-zan', kind: 'evaluation' },
  { id: 'wang-zhen', claim: '王振专权是明代宦官干政的开端。此后汪直、刘瑾、魏忠贤相继而起，《明史》把这条线索与「纲纪日以委颓」连在一起——宦祸不是偶发的，而是制度失效的表现。', sourceId: 'mingshi-xizong-zan', kind: 'influence' },
  { id: 'wanli', claim: '《熹宗本纪》赞语把明亡的责任上溯至「神宗末，废坏极矣」。这一判断与《神宗本纪》赞语的「明之亡，实亡于神宗」完全一致——两篇赞语互相印证。', sourceId: 'mingshi-xizong-zan', kind: 'evaluation' },
  { id: 'zhang-juzheng', claim: '张居正执政的核心是行政效率：「以尊主权、课吏职、信赏罚、一号令为主，虽万里外，朝下而夕奉行。」这一描述比「改革家」的标签更准确——他改的不是制度框架，而是执行力度。', sourceId: 'mingshi-zhangjuzheng-2', quote: '居正之为政，以尊主权、课吏职、信赏罚、一号令为主。', kind: 'evaluation' },
  { id: 'qi-jiguang', claim: '戚继光的军事改革能够得到支持，前提是张居正主政时期的行政效率。张居正死后他被目为「张党」而罢归——个人的功业，依托于一个特定的政治环境。', sourceId: 'mingshi-zhangjuzheng-2', kind: 'dispute' },
  { id: 'wang-yangming', claim: '王阳明平宁王之乱，正是正德朝政治混乱中的异数。《明史》把这类「以文臣而能定乱」的事迹单独标出，作为对「纲纪委颓」的一种反证。', sourceId: 'mingshi-xizong-zan', kind: 'dispute' },
  { id: 'zhu-chenhao', claim: '宁王之乱四十三日而平，说明明代藩王体制早已失效：藩王既无兵权也无地方行政权，一旦起事便孤立无援。这一结局反证了永乐削藩的成功。', sourceId: 'mingshi-yangjisheng', kind: 'influence' },
  { id: 'zhengde', claim: '正德朝的荒嬉与宦祸并存：刘瑾专权五年，朝政紊乱。《明史》把正德、嘉靖两朝的转折与「大礼议」相连，视为明代君臣关系破裂的开端。', sourceId: 'mingshi-liushan', kind: 'dispute' },
  { id: 'jiajing', claim: '嘉靖朝的「大礼议」在《明史》中被视为转折：「顾迭议大礼，舆论沸腾，幸臣假托，寻兴大狱。」一场关于父母名分的礼制之争，演变为持续二十年的政治清洗。', sourceId: 'mingshi-liushan', quote: '顾迭议大礼，舆论沸腾，幸臣假托，寻兴大狱。', kind: 'evaluation' },
  { id: 'hai-rui', claim: '海瑞上《治安疏》前「市一棺，诀妻子」，嘉靖读后「默然」。这一幕是明代谏诤传统的顶点：以必死之心进言，反而使皇帝无从下手——制度失效之后，只剩个人的道德勇气。', sourceId: 'mingshi-hai-rui', quote: '闻其上疏时，自知触忤当死，市一棺，诀妻子，待罪于朝。', kind: 'evaluation' },
  { id: 'yan-song', claim: '严嵩专权二十年，杨继盛弹劾其「十大罪五奸」而被杀。《明史》把严嵩与后来的魏忠贤并置，说明明代权臣与宦官的交替专权，是同一种制度缺陷的不同表现。', sourceId: 'mingshi-yangjisheng', kind: 'influence' },
  { id: 'yang-jisheng', claim: '杨继盛临刑诗「浩气还太虚，丹心照千古」，与于谦的《石灰吟》构成明代士人气节的两个坐标。他们的共同点是：都以生命为代价，对抗一个已经失效的制度。', sourceId: 'mingshi-yangjisheng', quote: '浩气还太虚，丹心照千古；生平未报恩，留作忠魂补。', kind: 'evaluation' },
  { id: 'xu-jie', claim: '徐阶扳倒严嵩，靠的是长期的隐忍与精确的政治计算，而非杨继盛式的正面冲突。明代中后期的政治斗争，两种方式并存——激烈者成仁，隐忍者成事。', sourceId: 'mingshi-yangjisheng', kind: 'dispute' },
  { id: 'gao-gong', claim: '高拱与张居正的权力交替，是隆庆到万历过渡的关键。《明史》把张居正的执政风格记为「一号令」，正说明他接手的是一套需要强力推动的行政体系。', sourceId: 'mingshi-zhangjuzheng-2', kind: 'influence' },
  // ── 明末 ──
  { id: 'chongzhen', claim: '《明史》对崇祯的评价是「非亡国之君，而当亡国之运」，但同时把亡国的根源上溯至神宗、熹宗两朝。这一双重判断，使崇祯既是责任者也是承受者。', sourceId: 'mingshi-xizong-zan', kind: 'dispute' },
  { id: 'wei-zhongxian', claim: '魏忠贤专权是明代宦祸的顶点。《熹宗本纪》赞语「妇寺窃柄，滥赏淫刑，忠良惨祸，亿兆离心」十六字，正是对天启一朝的总括。', sourceId: 'mingshi-xizong-zan', quote: '重以帝之庸懦，妇寺窃柄，滥赏淫刑，忠良惨祸，亿兆离心。', kind: 'evaluation' },
  { id: 'yuan-chonghuan', claim: '袁崇焕之死发生在「纲纪日以委颓」的末期：朝廷已无力辨别忠奸，只能以杀止疑。《明史》把他的死与「边事益无人」直接相连，作为明亡链条上的一环。', sourceId: 'mingshi-xizong-zan', kind: 'dispute' },
  { id: 'hong-chengchou', claim: '洪承畴降清，发生在明朝制度全面失效之后。松锦之战明军十三万覆没，其根源在于朝廷催战、粮饷不继——这是「纲纪委颓」在军事上的直接后果。', sourceId: 'mingshi-xizong-zan', kind: 'influence' },
  { id: 'li-zicheng', claim: '李自成的「均田免赋」之所以有效，是因为明末的加派（三饷）已使农民负担增至数倍。《明史》把崇祯朝的财政崩溃视为流寇四起的直接原因。', sourceId: 'mingshi-xizong-zan', kind: 'influence' },
  { id: 'zheng-chenggong', claim: '郑成功反清复明的基础，是南明残余势力与海上贸易集团的结合。《明史》记明末事时，把郑氏视为「海寇」而非政权，这一立场与台湾地位的历史叙述直接相关。', sourceId: 'mingshi-xizong-zan', kind: 'dispute' },
  { id: 'shi-kefa', claim: '史可法守扬州，是南明弘光朝最有象征意义的一战。《明史》把他的死与「纲纪委颓」的终局相连：制度已坏，唯剩个人的殉节。', sourceId: 'mingshi-xizong-zan', kind: 'dispute' },
  { id: 'xiaozong', claim: '弘治朝被称为「中兴」，在《明史》的叙述中是世宗以后「纲纪日以委颓」之前最后一段相对的清明。这一对照，使弘治的评价被后世不断抬高。', sourceId: 'mingshi-liushan', kind: 'evaluation' },
  { id: 'liu-jin', claim: '刘瑾专权五年，是正德朝政治紊乱的核心。《明史》把宦官干政视为制度性病症：从王振到刘瑾再到魏忠贤，同一种机制反复发作。', sourceId: 'mingshi-liushan', kind: 'influence' },
  { id: 'zhang-juzheng-mu', claim: '张居正死后被抄家，长子自尽、家人饿死。这一结局说明：他的改革建立在个人权威之上，一旦人亡，制度立即反转——「一号令」的效率与脆弱是同一件事。', sourceId: 'mingshi-zhangjuzheng-2', kind: 'dispute' },
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
