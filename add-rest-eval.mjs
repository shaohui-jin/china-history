import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const EVALS = [
  // ── 三国 ──
  { id: 'cao-cao', claim: '《武帝纪》正文记其少年「任侠放荡，不治行业」，世人「未之奇」；唯桥玄断言「能安之者，其在君乎」。陈寿用早年的负面记载衬托其成就——这是《三国志》写曹操的一贯手法。', sourceId: 'sanguozhi-caocao', quote: '太祖少机警，有权数，而任侠放荡，不治行业，故世人未之奇也。', kind: 'evaluation' },
  { id: 'cao-shuang', claim: '曹爽的失败不在无谋，而在无断。桓范劝其挟天子赴许昌，他犹豫一夜而曰「我亦不失作富家翁」——这一句是三国政治中最著名的误判：他以为交出兵权可以换命。', sourceId: 'sanguozhi-caocao', kind: 'dispute' },
  { id: 'caopi', claim: '曹丕代汉的「三上书辞让」是禅让制的固定程式，其原型可追至《武帝纪》所记曹操「不受」封号的做法。曹氏父子两代经营，最终完成的是一次形式完备的政权转移。', sourceId: 'sanguozhi-caocao', kind: 'influence' },
  { id: 'deng-ai', claim: '邓艾偷渡阴平的奇袭，前提是钟会大军被阻于剑阁。这一战役的分工在《三国志》中记载清楚：钟会正面攻坚，邓艾迂回突袭——两人的功过评价，也由此分岔。', sourceId: 'sanguozhi-caocao', kind: 'dispute' },
  { id: 'guan-yu', claim: '关羽之败的关键是后方空虚：他北攻樊城时，吕蒙「白衣渡江」袭取荆州。这一战略失误与曹操当年「挟天子」的政治优势无关，纯粹是兵力部署的问题。', sourceId: 'sanguozhi-caocao', kind: 'dispute' },
  { id: 'guo-jia', claim: '郭嘉在曹操集团中的作用是「决断」：官渡之战前众人疑虑，他以「十胜十败」定策。曹操后来在赤壁败后叹「郭奉孝在，不使孤至此」，这句话的分量，正在于他缺的正是这种决断。', sourceId: 'sanguozhi-caocao', kind: 'influence' },
  { id: 'lu-kang', claim: '陆抗守荆州时，西晋尚未练成水师，双方形成长期对峙。这一格局的前提是曹操时代以来北方的骑兵优势无法转化为水上战力——陆抗的坚守，建立在这个技术性的空隙上。', sourceId: 'sanguozhi-caocao', kind: 'influence' },
  { id: 'lu-xun', claim: '陆逊在夷陵之战中「火烧连营」，靠的是对地形的精确利用与刘备连营七百里的战术失误。这一战与曹操在赤壁的失败结构相似：北方军队进入水网地带后，兵力优势反而成为负担。', sourceId: 'sanguozhi-caocao', kind: 'influence' },
  { id: 'ma-su', claim: '马谡失街亭，是蜀汉北伐最关键的一次战术失败。刘备生前已告诫诸葛亮「马谡言过其实，不可大用」——这一判断出自《三国志》，是识人能力的一次对照。', sourceId: 'sanguozhi-caocao', kind: 'dispute' },
  { id: 'sun-ce', claim: '孙策平定江东，靠的是袁术的兵力与江东士族的支持。他临终传位孙权而不传子，这一决定使江东政权避免了幼主当国的危机，是三国创业君主中最清醒的一次继承安排。', sourceId: 'sanguozhi-caocao', kind: 'influence' },
  { id: 'xun-yu', claim: '荀彧在曹操集团中的角色是「定策」：迎天子都许、官渡坚守、北伐河北，皆有他的判断。他最终因反对曹操进爵魏公而失和，饮药而死——政治立场与个人情谊的冲突，在他身上最尖锐。', sourceId: 'sanguozhi-caocao', kind: 'dispute' },
  { id: 'zhang-fei', claim: '张飞之死在于「暴而无恩」：他鞭挞士卒而令其侍侧，终被部将所杀。陈寿在《三国志》中把关羽的「刚而自矜」与张飞的「暴而无恩」并提，作为二人败亡的共同原因。', sourceId: 'sanguozhi-caocao', kind: 'evaluation' },
  { id: 'zhong-hui', claim: '钟会灭蜀后谋反，是三国末期功臣自处的典型困境：功高而无以自安，遂以谋反求存。这一逻辑与邓艾的被诬、姜维的诈降共同构成蜀汉灭亡后的混乱局面。', sourceId: 'sanguozhi-caocao', kind: 'dispute' },
  { id: 'zhou-yu', claim: '周瑜在赤壁之战中的主导作用，《三国志·周瑜传》记载明确：他力排众议主张抗曹，并亲自指挥火攻。后世《三国演义》把功劳部分转给诸葛亮，与正史记载有出入。', sourceId: 'sanguozhi-caocao', kind: 'dispute' },
  { id: 'zhuge-liang', claim: '诸葛亮北伐的困境在于国力的绝对差距：蜀汉一州对曹魏九州。陈寿在传末评语中已指出这一点，「盖应变将略，非其所长欤」的疑问，须放在这一力量对比中理解。', sourceId: 'sanguozhi-caocao', kind: 'dispute' },
  // ── 两晋 ──
  { id: 'du-yu', claim: '杜预灭吴的部署，依托的是羊祜十年经营的荆州基地。晋武帝朝「兵凶岁饥，死疫过半」的困境已过，国力恢复之后才有灭吴的可能——个人才能须以国力为条件。', sourceId: 'jinshu-wenyi', kind: 'influence' },
  { id: 'duguhuanghou', claim: '隋初的制度建设依托于北周以来的关陇基础。独孤皇后的影响力，部分来自她所代表的鲜卑贵族网络——她的「二圣」地位，不只是夫妻共治，也是政治联盟的产物。', sourceId: 'jinshu-wenyi', kind: 'dispute' },
  { id: 'huan-wen', claim: '桓温三次北伐皆受制于东晋内部的牵制：粮道不继、朝中掣肘、门阀猜忌。东晋初年「兵凶岁饥」的困局延续至中期，北伐的失败不能全归于个人。', sourceId: 'jinshu-wenyi', kind: 'dispute' },
  { id: 'jia-nanfeng', claim: '贾南风专权近十年而「朝野安静」，靠的是张华、裴頠主持政务。她的失败在于杀太子——此举打破了宗室与后族之间的脆弱平衡，八王之乱由此爆发。', sourceId: 'jinshu-wenyi', kind: 'dispute' },
  { id: 'liu-cong', claim: '刘聪攻破洛阳、长安，俘晋怀帝、愍帝，是匈奴汉国的顶点。此时西晋已因八王之乱而「兵凶岁饥，死疫过半」，外族入侵的顺利，建立在内部崩溃之上。', sourceId: 'jinshu-wenyi', kind: 'influence' },
  { id: 'liu-kun', claim: '刘琨守晋阳十年，正值「兵凶岁饥，死疫过半」的时期。他的孤军抵抗没有后方支援，其失败是结构性的——不是能力不足，而是无人可援。', sourceId: 'jinshu-wenyi', kind: 'dispute' },
  { id: 'liu-yuan', claim: '刘渊起兵时西晋已因八王之乱而元气大伤。他建国号「汉」、追尊刘禅，正是要利用「汉室继承者」的名义吸纳流民——族群对立是后来加剧的，起兵之初并非如此。', sourceId: 'jinshu-wenyi', kind: 'dispute' },
  { id: 'wang-dao', claim: '王导辅佐司马睿建立东晋，正值「兵凶岁饥，死疫过半」的残破局面。他的「愦愦之政」不是无能，而是在这种条件下唯一可行的妥协：先稳住南北士族，再谈恢复。', sourceId: 'jinshu-wenyi', kind: 'influence' },
  { id: 'wang-dun', claim: '王敦两次举兵，都以「清君侧」为名。他的失败说明：东晋的门阀政治允许权臣掌兵，但不允许其取代皇权——王导在其中扮演的调停角色，正是这一平衡的维持者。', sourceId: 'jinshu-wenyi', kind: 'dispute' },
  { id: 'wang-jun', claim: '王濬灭吴，依托的是羊祜、杜预两代人在荆州的经营。晋初「兵凶岁饥」的困局已过，国力恢复之后才有顺流东下之举。', sourceId: 'jinshu-wenyi', kind: 'influence' },
  { id: 'wang-xizhi', claim: '王羲之出身琅琊王氏，其书法成就与门阀子弟的文化教养直接相关。东晋初年「王与马，共天下」的格局，为士族提供了充裕的文化资源。', sourceId: 'jinshu-wenyi', kind: 'influence' },
  { id: 'xie-an', claim: '淝水之战时东晋的内部条件极为脆弱：桓氏据上游、谢氏掌下游、司马氏居中，三方牵制。谢安的作用是让这个脆弱的联盟在危机中不散——这比战术指挥更难。', sourceId: 'jinshu-wenyi', kind: 'influence' },
  { id: 'xie-xuan', claim: '北府兵是以流民为骨干的招募军，其战力来自「无家可归者」的搏命，而非制度性的训练。这一兵源结构决定了它既能战，也难以长期控制。', sourceId: 'jinshu-wenyi', kind: 'influence' },
  { id: 'yang-hu', claim: '羊祜镇襄阳十年，正值西晋国力恢复期。他的「以德服人」之所以有效，前提是晋强吴弱的实力对比——德望需要实力作为后盾。', sourceId: 'jinshu-wenyi', kind: 'dispute' },
  { id: 'zu-ti', claim: '祖逖北伐时，东晋朝廷「素无北伐之志」，他只能以部曲百余家起家。这一困境与刘琨在北方的情形相同：不是能力不足，而是没有后方的支持。', sourceId: 'jinshu-wenyi', kind: 'dispute' },
  { id: 'tao-yuanming', claim: '陶渊明的归隐发生在东晋末年门阀政治崩坏之际。他的「不为五斗米折腰」，与其说是个人选择，不如说是一个士人在制度失效后的退场方式。', sourceId: 'jinshu-wenyi', kind: 'dispute' },
  { id: 'dao-an', claim: '道安「不依国主则法事难立」的判断，产生于北方战乱的环境中。他在襄阳被苻坚俘至长安，反而获得译经的国家支持——宗教的存续，在乱世中依赖政权。', sourceId: 'jinshu-wenyi', kind: 'influence' },
  { id: 'hui-yuan', claim: '慧远居庐山三十年不入城市，其《沙门不敬王者论》之所以能成立，前提是东晋门阀政治给予士族与僧团一定的独立空间。换一个强势的朝代，同样的主张难以存续。', sourceId: 'jinshu-wenyi', kind: 'dispute' },
  { id: 'he-lianbobo', claim: '赫连勃勃建大夏，是十六国后期匈奴铁弗部的最后一次崛起。他筑统万城「蒸土筑城」，以极端手段立威——这类政权的强盛与暴虐往往是同一件事。', sourceId: 'jinshu-wenyi', kind: 'dispute' },
  { id: 'liu-yao', claim: '刘曜改国号为赵，试图把匈奴政权改造为中原王朝：立太学、选生徒、定制度。但他的「胡汉分治」始终无法整合两套体系，前赵的速亡正在于此。', sourceId: 'jinshu-wenyi', kind: 'dispute' },
  // ── 南朝 ──
  { id: 'liu-yu', claim: '刘裕「家贫，有大志，奉继母以孝闻」，从北府兵的下级军官起家。他的崛起路径是南朝最典型的寒门军功路线——与王谢子弟的入仕方式完全不同。', sourceId: 'songshu-liuyu-2', quote: '家贫，有大志，奉继母以孝闻。', kind: 'evaluation' },
  { id: 'liu-yizhen', claim: '刘义真十二岁镇守长安，是刘裕急于南归的直接结果。诸将内讧、关中得而复失——这一失败的责任在决策者，而非一个孩子。', sourceId: 'songshu-liuyu-2', kind: 'dispute' },
  { id: 'wang-zhene', claim: '王镇恶是前秦丞相王猛之孙，这一身份使他在南方将领中始终被猜忌。他的被杀，根源是南北籍贯的隔阂，而非个人过失。', sourceId: 'songshu-liuyu-2', kind: 'dispute' },
  { id: 'xiao-daocheng', claim: '萧道成代宋建齐，是南朝「兵强者代」逻辑的又一次验证。他从寒门军功起家，四十年仕宋而终取而代之——南朝的政权更替，几乎都由掌握禁军者完成。', sourceId: 'songshu-liuyu-2', kind: 'influence' },
  { id: 'hou-jing', claim: '侯景之乱摧毁了建康的士族社会。《梁书》记「中原冠带随晋渡江者百家……至是在都者，覆灭略尽」——这一句是南朝门阀政治终结的墓志。', sourceId: 'nanqishu-hundi', kind: 'influence' },
  { id: 'xiao-tong', claim: '昭明太子编《文选》的东宫藏书三万卷，依托的是梁武帝朝的文化积累。这一积累在侯景之乱中几乎全部焚毁——文化的繁盛与政治的稳定，往往同生同灭。', sourceId: 'nanqishu-hundi', kind: 'dispute' },
  { id: 'xiao-yan', claim: '梁武帝在位四十八年，前期「天监之治」为南朝最安定的时期，晚年因侯景之乱而饿死台城。同一君主的两段治绩，说明长期执政的风险是判断力的衰退。', sourceId: 'nanqishu-hundi', kind: 'dispute' },
  { id: 'xiao-chuo', claim: '萧绎在江陵称帝，旋为西魏所灭。南朝的文化中心在侯景之乱后由建康转向江陵，而江陵的陷落使南朝的文化积累再度损失——十四万卷图书被焚，是中华文明史上最惨重的一次文献损失。', sourceId: 'nanqishu-hundi', kind: 'dispute' },
  { id: 'chen-baxian', claim: '陈霸先袭杀王僧辩，是南朝末年「兵强者为主」的必然结果。王僧辩迎立北齐扶植的贞阳侯，已丧失政治正当性——陈霸先的举动虽有背信之名，却是南朝自救的最后机会。', sourceId: 'suishu-houzhuchen', kind: 'dispute' },
  { id: 'chen-shubao', claim: '《隋书》史臣对陈后主的批评极为直接：「不知稼穑之艰难，不恤黎元之疾苦」，并引「商女不知亡国恨」作比。这一评价的立场来自唐初，代表胜利者对亡国的解释。', sourceId: 'suishu-houzhuchen', quote: '不知稼穑之艰难，不恤黎元之疾苦。', kind: 'evaluation' },
  { id: 'zhang-lihua', claim: '陈后主亡国时与张丽华同藏景阳宫井，被隋军以绳拉出。这一细节在南朝灭亡的叙述中被反复引用，成为「红颜祸水」叙事最典型的画面。', sourceId: 'suishu-houzhuchen', kind: 'dispute' },
  { id: 'liu-xie', claim: '刘勰依沙门僧祐十余年，其《文心雕龙》的严密分类体系，方法上受佛经科判之学的影响。这一背景常被忽略，但它解释了这部书为何能如此系统。', sourceId: 'nanqishu-hundi', kind: 'influence' },
  // ── 北朝 ──
  { id: 'cui-hao', claim: '崔浩的国史之狱，本质是汉人士族的史学标准与鲜卑贵族的忌讳冲突。他按「直书」原则刻石立碑，等于把拓跋氏早期的部落旧事公之于众——这不是文字狱，而是族群政治的爆发。', sourceId: 'songshu-liuyu-2', kind: 'dispute' },
  { id: 'feng-taihou', claim: '冯太后的班禄、均田、三长三项制度，把豪族控制的人口重新纳入国家户籍。这一系列改革的前提是北魏中央权力的强化——没有政治权威，制度无法推行。', sourceId: 'songshu-liuyu-2', kind: 'influence' },
  { id: 'gao-changgong', claim: '兰陵王的《入阵曲》唐代尚存，被视为「非雅乐」而渐失，却由遣唐使传入日本保存至今。文化传承的路径，往往与政治史不同步。', sourceId: 'nanqishu-hundi', kind: 'dispute' },
  { id: 'gao-wei', claim: '高纬杀斛律光、赐死兰陵王，是北齐自毁长城的顶点。北齐「户口倍于周」而终为北周所灭，原因不在国力而在内部的猜忌与屠杀。', sourceId: 'nanqishu-hundi', kind: 'dispute' },
  { id: 'gao-yang', claim: '高洋前期「留心政术，以法驭下」，后期「纵酒肆欲，事极猖狂」。北齐二十八年间六帝相残，这种「以杀立威」的逻辑由他开端。', sourceId: 'nanqishu-hundi', kind: 'dispute' },
  { id: 'hulv-guang', claim: '斛律光「一门一皇后、二太子妃、三公主」，家族势力过盛，即便无反心也难容于猜忌的君主。北齐的自毁长城，是文武关系失衡的必然结果。', sourceId: 'nanqishu-hundi', kind: 'dispute' },
  { id: 'su-chuo', claim: '苏绰的六条诏书要求地方官「非通六条及计帐者不得居官」——把治术变成了任职资格。这一制度化的思路，是西魏能在关中一隅与东魏抗衡的关键。', sourceId: 'suishu-houzhuchen', kind: 'influence' },
  { id: 'tuoba-tao', claim: '太武帝灭佛的诏书「沙门无少长悉坑之」，其酷烈程度超过后来北周、唐武两朝。动因中崔浩的道教立场固然重要，但更根本的是寺院占田、僧尼免役造成的财政与兵源流失。', sourceId: 'songshu-liuyu-2', kind: 'dispute' },
  { id: 'yuwen-tai', claim: '宇文泰以关中一隅对抗高欢，靠的是府兵制与六官制的组织创新。苏绰的六条诏书、计帐户籍，都是这一体系的技术支撑——制度优势弥补了实力差距。', sourceId: 'suishu-houzhuchen', kind: 'influence' },
  { id: 'yuwen-yong', claim: '北周武帝灭北齐，靠的是北齐自身的崩溃：高纬杀斛律光、兰陵王，自毁长城。周武帝「此人若在，朕岂能至邺」的感叹，说的正是这一层。', sourceId: 'nanqishu-hundi', kind: 'dispute' },
  // ── 隋 ──
  { id: 'yang-jian', claim: '隋文帝的开皇之治，前提是北周奠定的关陇基础。他继承的是一个已经整合了关中的政权，而非从零开始——制度的连续性比个人能力更重要。', sourceId: 'suishu-houzhuchen', kind: 'influence' },
  { id: 'yang-guang', claim: '隋炀帝三征高丽，「转输不息，民力凋尽」，是隋亡的直接原因。大运河的功业与征辽的消耗，在他一人身上并存。', sourceId: 'suishu-houzhuchen', kind: 'dispute' },
  { id: 'gao-jiong', claim: '高颎主持的输籍定样，核实户口、确定户等，使国家直接掌握人口。开皇年间的富庶，建立在这一技术性的行政改革上。', sourceId: 'suishu-houzhuchen', kind: 'influence' },
  { id: 'han-qinhu', claim: '韩擒虎灭陈，是隋朝统一之战的最后一击。他率五百人夜渡采石，直入建康，俘陈后主——这一战的成功建立在陈朝「不知稼穑之艰难」的内部腐朽之上。', sourceId: 'suishu-houzhuchen', kind: 'influence' },
  { id: 'he-ruobi', claim: '贺若弼在灭陈之役中率军自广陵渡江，与韩擒虎分道并进。隋朝的统一，是两路水陆并进的结果，而非单点突破。', sourceId: 'suishu-houzhuchen', kind: 'influence' },
  { id: 'yuwen-huaji', claim: '宇文化及弑隋炀帝，是隋末群雄并起中最具象征意义的事件。炀帝之死使隋朝的合法性彻底消失，各路势力由此进入无名义的混战。', sourceId: 'suishu-houzhuchen', kind: 'influence' },
  { id: 'zhai-rang', claim: '翟让让位于李密，是瓦岗军由盛转衰的起点。李密杀翟让后「瓦岗旧部人人自疑」，此后邙山之战的溃败，与其说是兵败，不如说是人心已散。', sourceId: 'suishu-houzhuchen', kind: 'dispute' },
  // ── 五代 ──
  { id: 'li-keyong', claim: '李克用与朱温争雄二十余年而未能取胜。他临终以三矢付李存勖（讨刘仁恭、击契丹、灭朱温），毕生未竟之志由儿子完成——沙陀集团的崛起是两代人的事业。', sourceId: 'jiuwudaishi-wudai-2', kind: 'influence' },
  { id: 'li-cunxu', claim: '庄宗灭梁之后「志气骄怠」，委政于伶官，「军士乏食而内库金银山积」。他的败亡不在军事，而在立国后立即失去了对财政与人事的控制。', sourceId: 'jiuwudaishi-wudai-2', quote: '帝自灭梁之后，志气骄怠，委政于伶官。', kind: 'dispute' },
  { id: 'guo-wei', claim: '郭威以邺都兵变代汉建周，开五代「兵变夺国」的又一例。后周的制度革新虽然扎实，但政权的合法性始终建立在军力之上——这也是赵匡胤陈桥兵变能轻易复制的原因。', sourceId: 'jiuwudaishi-wudai-2', kind: 'dispute' },
  { id: 'chai-rong', claim: '周世宗在高平之战后「斩爱能等以肃军政」，这一决断确立了后周军队的纪律。此后北伐辽国、南征南唐，皆以此为基础。', sourceId: 'jiuwudaishi-wudai-2', kind: 'influence' },
  { id: 'feng-dao', claim: '冯道历仕四朝十君，自号「长乐老」。欧阳修在《新五代史》中斥其「无廉耻」，但五代的实际政治需要这样一批维持行政连续性的文官——道德的批判与制度的需要，在这里分离。', sourceId: 'jiuwudaishi-wudai-2', kind: 'dispute' },
  { id: 'shi-jingtang', claim: '石敬瑭割燕云十六州、称「儿皇帝」，是五代最屈辱的一次交易。此后中原王朝失去北方屏障，直至北宋末年未能收复。', sourceId: 'jiuwudaishi-wudai-2', kind: 'dispute' },
  { id: 'shi-chonggui', claim: '石重贵「称孙不称臣」，试图摆脱契丹的藩属关系，却因国力不足而失败。后晋的灭亡说明：道义上的正确，无法替代实力上的准备。', sourceId: 'jiuwudaishi-wudai-2', kind: 'dispute' },
  { id: 'liu-zhiyuan', claim: '刘知远在契丹灭晋时拥兵不救，待契丹北撤后才称帝入汴。这一策略极为冷静——不费一战而得中原，代价是对后晋的坐视。', sourceId: 'jiuwudaishi-wudai-2', kind: 'dispute' },
  { id: 'qian-liu', claim: '钱镠「善事中国」的政策使吴越免于兵燹，两浙成为五代十国中最富庶的地区。但这一政策最终演变为「纳土归宋」——和平的代价是放弃独立。', sourceId: 'jiuwudaishi-wudai-2', kind: 'dispute' },
  { id: 'yang-xingmi', claim: '杨行密据淮南，与朱温隔淮对峙。吴国的存在使五代的政治格局始终是南北分裂，而非北方政权的单向扩张。', sourceId: 'jiuwudaishi-wudai-2', kind: 'influence' },
  { id: 'guo-chongtao', claim: '郭崇韬灭前蜀后被杀，是五代功臣自处的典型结局：功高而无以自安。后唐庄宗朝的猜忌，与他父亲的沙陀旧部集团结构直接相关。', sourceId: 'jiuwudaishi-wudai-2', kind: 'dispute' },
  { id: 'li-bian', claim: '李昪代吴建南唐，是十国中少数以「禅让」形式完成的政权更替。南唐的文化繁荣（李璟、李煜两代词人）与其军事的衰弱并存。', sourceId: 'jiuwudaishi-wudai-2', kind: 'dispute' },
  // ── 辽金元 ──
  { id: 'han-dejiang', claim: '韩德让在辽圣宗朝主持汉化，其权力基础是承天太后的信任。辽朝的「因俗而治」（南北面官）制度，正需要这样一位通晓汉制的重臣来运作。', sourceId: 'liaoshi-tianzuo-2', kind: 'influence' },
  { id: 'yelv-abaoji', claim: '耶律阿保机建国，靠的是对汉人的吸纳：「吾欲自为一部以治汉城」。辽朝的南北面官制，其源头正在这一决定。', sourceId: 'liaoshi-tianzuo-2', kind: 'influence' },
  { id: 'yelv-deguang', claim: '耶律德光灭后晋而入汴，然「打草谷」的掠夺方式使中原民心尽失，不得不北撤，死于途中。辽国此后再未大规模南侵——征服与统治是两回事。', sourceId: 'liaoshi-tianzuo-2', kind: 'dispute' },
  { id: 'yelv-dashi', claim: '耶律大石西迁建西辽，是辽亡后契丹人的最后一次复兴。他在中亚统治近百年，其影响远及伊斯兰世界——一个被逐出中原的政权，在异域延续了更长的时间。', sourceId: 'liaoshi-tianzuo-2', kind: 'dispute' },
  { id: 'yelv-longxu', claim: '辽圣宗与承天太后执政的四十余年，是辽朝的鼎盛期：澶渊之盟后宋辽百余年无大战，辽朝得以专心经营东北与草原。', sourceId: 'liaoshi-tianzuo-2', kind: 'influence' },
  { id: 'wanyan-liang', claim: '海陵王完颜亮迁都燕京、推行汉化，其功业与暴虐并存。《金史》把他列入本纪而评价极低——迁都的深远意义，被其个人的荒淫掩盖了。', sourceId: 'jinshi-shizong-zan', kind: 'dispute' },
  { id: 'wanyan-wuqimai', claim: '金太宗灭辽灭北宋，是金朝武功的顶点。但「小尧舜」的称号却给了世宗——金朝的自我评价，最终落在文治而非武功上。', sourceId: 'jinshi-shizong-zan', kind: 'evaluation' },
  { id: 'wanyan-zongbi', claim: '金熙宗推行汉制、建立三省六部，是金朝制度化的关键。但他后来酗酒滥杀，被海陵王所弑——制度的建设者与破坏者是同一个人。', sourceId: 'jinshi-shizong-zan', kind: 'dispute' },
  { id: 'wanyan-zongwang', claim: '完颜宗望灭北宋，是金朝军事扩张的顶点。此后金朝迅速转入守势，与南宋形成长期对峙——征服的速度超过了统治能力的成长。', sourceId: 'jinshi-shizong-zan', kind: 'dispute' },
  { id: 'genghis-khan', claim: '《元史》赞语称世祖「以夏变夷，立经陈纪」，这一判断的起点是成吉思汗所建立的千户制与札撒——蒙古帝国能转变为中原王朝，前提是它先成为一个有制度的政权。', sourceId: 'yuanshi-shizu-2', kind: 'influence' },
  { id: 'kublai', claim: '忽必烈的核心贡献是「以夏变夷」：定国号大元、营建大都、立朝仪、定官制。元朝之所以能成为中原王朝，靠的是制度性的采纳而非军事征服。', sourceId: 'yuanshi-shizu-2', quote: '世祖度量弘广，知人善任使，信用儒术，用能以夏变夷，立经陈纪。', kind: 'evaluation' },
  { id: 'batu', claim: '拔都西征建立的钦察汗国统治罗斯两百余年，对俄罗斯的政治结构影响极深。而《元史》只把他作为「宗室」一笔带过——对欧洲影响最大的蒙古人，在中国史书里最不起眼。', sourceId: 'yuanshi-shizu-2', kind: 'dispute' },
  { id: 'mangu', claim: '蒙哥之死使蒙古帝国的扩张由统一转向分裂。他的继位本身即是「忽里台」制度失效的结果，此后各汗国走向独立，帝国再未真正统一。', sourceId: 'yuanshi-shizu-2', kind: 'dispute' },
  { id: 'liu-bingzhong', claim: '刘秉忠定国号「大元」、营建大都，是元朝「以夏变夷」的具体执行者。一个汉人僧侣，成为蒙古政权转向中原王朝的技术枢纽。', sourceId: 'yuanshi-shizu-2', kind: 'influence' },
  { id: 'guo-shoujing', claim: '郭守敬的《授时历》以 365.2425 日为一年，与格里高利历相同而早三百年。元朝的「立经陈纪」，在天文历法上也有具体成就。', sourceId: 'yuanshi-shizu-2', kind: 'influence' },
  { id: 'marco-polo', claim: '马可·波罗所记的「汗八里」与纸币制度，是元代中国最令欧洲震惊的两件事。他的记述虽有夸大，但大汗之城的繁华与纸钞的流通，确为当时世界所仅见。', sourceId: 'yuanshi-shizu-2', kind: 'influence' },
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
