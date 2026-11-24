import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const EVALS = [
  // ── 初唐 ──
  { id: 'li-yuan', claim: '《新唐书》把李渊的起兵视为预谋而非被动：晋阳起兵前他已「阴结豪杰」，起兵后迅速定都长安、立杨侑为帝，步骤清晰。所谓「优柔失断」，更多是贞观朝史臣的追述立场。', sourceId: 'xintangshu-zongzan', kind: 'dispute' },
  { id: 'li-jiancheng', claim: '欧阳修在《太宗本纪》赞语中把太宗与禹、汤、周武并论，这种拔高的前提是建成必须被贬低。同一部《新唐书》的《隐太子传》仍沿用「二凶」之说，两传合看，可见官方叙事的内在需要。', sourceId: 'xintangshu-zongzan', kind: 'dispute' },
  { id: 'tang-gaozong', claim: '《通鉴》记高宗朝「所用之相，各其所长」，并特别指出张九龄「尚直」。这一评价把高宗前期的人才格局视为开元盛世的直接前奏——永徽至开元的治世，其实是一个连续的过程。', sourceId: 'zizhitongjian-kaiyuan', kind: 'influence' },
  { id: 'wu-zetian', claim: '《通鉴》的评价极为精准：「滥以禄位收天下人心，然不称职者，寻亦黜之，或加刑诛。挟刑赏之柄以驾御天下，政由己出，明察善断。」宽进严出、赏罚自持，这八个字解释了她为何能用酷吏而不失人才。', sourceId: 'zizhitongjian-wuzhou', quote: '太后虽滥以禄位收天下人心，然不称职者，寻亦黜之，或加刑诛。', kind: 'evaluation' },
  { id: 'di-renjie', claim: '武周的人才政策是「宽进严出」：来者不拒，不称职者随即罢黜或诛杀。狄仁杰能在这样的体制中久任宰相并主导还政，靠的不是迎合，而是被反复验证过的实务能力。', sourceId: 'zizhitongjian-wuzhou', kind: 'influence' },
  { id: 'zhangsun-wuji', claim: '长孙无忌的命运是武周政治的直接产物。他在高宗立武后一事上持反对立场，此后被许敬宗诬以谋反，流放黔州赐死。关陇集团最后一位有权力的代表，就此消失。', sourceId: 'zizhitongjian-wuzhou', kind: 'dispute' },
  // ── 盛唐 ──
  { id: 'tang-xuanzong', claim: '《通鉴》以「各其所长」概括开元诸相：姚崇尚通、宋璟尚法、张说尚文、张九龄尚直。「开元之末，上倦于万几，委政于李林甫」——转折不在宰相，而在皇帝本人的倦怠。', sourceId: 'zizhitongjian-kaiyuan', quote: '开元之末，上倦于万几，委政于李林甫。', kind: 'evaluation' },
  { id: 'yao-chong', claim: '在《通鉴》的排序里，姚崇居开元诸相之首，其特点是「尚通」——善于因时制宜、不拘成法。这一评语与他力主捕蝗、沙汰僧尼等务实举措完全吻合。', sourceId: 'zizhitongjian-kaiyuan', kind: 'evaluation' },
  { id: 'song-jing', claim: '宋璟在《通鉴》的排序里是「尚法」——与姚崇的「尚通」相对。开元前期之所以能持续近三十年，正因为这两种风格交替执政：先以通开局面，再以法固成果。', sourceId: 'zizhitongjian-kaiyuan', kind: 'evaluation' },
  { id: 'zhang-yue', claim: '《通鉴》把张说的执政风格定为「尚文」，这一定位与他在开元文坛的地位完全一致。文治与政事在他身上是一体的：他提携的文人进入朝廷，也改变了朝廷的话语方式。', sourceId: 'zizhitongjian-kaiyuan', kind: 'evaluation' },
  { id: 'zhang-jiuling', claim: '张九龄在《通鉴》的排序里是「尚直」，也是开元诸相中的最后一位。他罢相之后，「自是朝廷之士，皆容身保位，无复直言」——开元之治的终结，以直言风气的消失为标志。', sourceId: 'zizhitongjian-kaiyuan', kind: 'influence' },
  { id: 'li-linfu', claim: '《通鉴》对李林甫的定性是「媚事左右，迎合上意，以固其宠」，并把转折点明确系于玄宗「倦于万几」。这意味着：李林甫的专权是玄宗主动让渡权力的结果，而非单纯的个人野心。', sourceId: 'zizhitongjian-kaiyuan', quote: '林甫媚事左右，迎合上意，以固其宠。', kind: 'dispute' },
  // ── 名将与文臣 ──
  { id: 'li-jing', claim: '太宗对李靖的评价极为直接：「李靖是萧铣、辅公祏膏肓，古之名将韩、白、卫、霍，岂能及也！」把他排在韩信、白起、卫青、霍去病之上——这是帝王口吻的至高褒奖，与史臣的「烟阁之最」互为印证。', sourceId: 'zhenguanzhengyao-2', quote: '李靖是萧铣、辅公祏膏肓，古之名将韩、白、卫、霍，岂能及也！', kind: 'evaluation' },
  { id: 'li-jing', claim: '李靖的兵法传承在唐代是显学，但其《李卫公问对》的真伪自宋人起即有争议。可以确定的是：他在世时已被视为兵法权威，太宗多次与其讨论阵法，这些对话构成了《问对》的素材基础。', sourceId: 'zhenguanzhengyao-2', kind: 'dispute' },
  { id: 'wei-zheng', claim: '赵翼指出贞观谏诤非魏征一人之功：马周、刘洎、岑文本、褚遂良、张玄素等「皆能犯颜极谏」。魏征之所以最著名，是因为他与太宗的关系被后世塑造成了君臣典范——制度性的谏诤风气，被压缩为一个人的形象。', sourceId: 'nianerzha-3', kind: 'dispute' },
  { id: 'fang-xuanling', claim: '《通鉴》记开元诸相各有专长，这一分类方式其实源自唐人对宰相类型的自觉区分。房玄龄在贞观朝的角色与此类似：他不以单项才能见长，而以组织与协调为业——「各其所长」的前提，是有人负责把这些人组合起来。', sourceId: 'zizhitongjian-kaiyuan', kind: 'influence' },
  { id: 'du-ruhui', claim: '「房谋杜断」的分工在唐人眼里是宰相制度成熟的标志。开元诸相「各其所长」而能相继执政，走的正是同一条路：把不同性格的人放在相位上，各用其长。', sourceId: 'zizhitongjian-kaiyuan', kind: 'influence' },
  { id: 'songtsen-gampo', claim: '唐蕃关系的实质在《通鉴》中看得更清楚：太宗朝的和亲之后，高宗、玄宗两朝与吐蕃屡有大仗（大非川、青海、石堡城）。文成公主入藏是文化交流的起点，但远非和平的保证。', sourceId: 'zizhitongjian-tangmo', kind: 'dispute' },
  { id: 'wencheng-gongzhu', claim: '把文成公主入藏放在唐蕃两百年的战争史中看，她的意义更接近「开端」而非「和解」。此后唐蕃八次会盟、无数次交战，公主带去的技术与信仰却长期留存——文化的传播比政治关系更持久。', sourceId: 'zizhitongjian-tangmo', kind: 'dispute' },
  { id: 'xuanzang', claim: '玄奘归国后的译经事业得到唐廷的直接支持，太宗两次劝其还俗参政，均被婉拒。这一细节说明：他的西行虽属个人行为，其成果却必须依托国家力量才能完成——宗教与政权的关系，在他身上体现得最清楚。', sourceId: 'zizhitongjian-tangmo', kind: 'influence' },
  // ── 中晚唐 ──
  { id: 'li-deyu', claim: '会昌之政的成效须放在藩镇格局中看。《通鉴》概括中晚唐「兵骄则逐帅，帅强则叛上」，李德裕能在此格局下击破回鹘、平定泽潞，是安史之乱后唐廷少见的主动出击。', sourceId: 'zizhitongjian-tangmo', quote: '兵骄则逐帅，帅强则叛上。', kind: 'influence' },
  { id: 'guo-ziyi', claim: '安史之乱后「天下户口十亡八九」，郭子仪等人在此残破的基础上重建唐廷的军事力量。他的功业不只是平叛，更是在藩镇林立的格局中维持了中央的体面。', sourceId: 'zizhitongjian-tangmo', kind: 'influence' },
  { id: 'li-guangbi', claim: '《通鉴》对藩镇格局的判断——「大者连州十余，小者犹兼三四」——正是李光弼、郭子仪等人作战的环境。他们面对的已不是叛军，而是一个个半独立的军镇。', sourceId: 'zizhitongjian-tangmo', kind: 'influence' },
  { id: 'shi-chaoyi', claim: '史朝义之死标志安史之乱的终结，但《通鉴》指出：乱平之后「藩镇相望于内地」。叛乱的军事失败，换来了藩镇割据的制度化——这是安史之乱最深远的后果。', sourceId: 'zizhitongjian-tangmo', kind: 'dispute' },
  { id: 'huang-chao', claim: '黄巢之乱后唐朝的财政与军事体系全面瓦解。《通鉴》所记「天下户口十亡八九」，既是黄巢军破坏的结果，也是此后藩镇混战的开端——五代十国的格局，由此奠基。', sourceId: 'zizhitongjian-tangmo', kind: 'influence' },
  { id: 'yang-yuhuan', claim: '马嵬驿之变的实质是军队对杨国忠专权的清算，杨贵妃是这场清算的附加代价。《通鉴》记此事时把重点放在禁军的诉求上，而非帝妃之情——这一叙述角度，与后世《长恨歌》的写法截然不同。', sourceId: 'zizhitongjian-tangmo', kind: 'dispute' },
  { id: 'yan-gaoqing', claim: '颜杲卿的常山举义发生在「天下户口十亡八九」之前，是安史之乱初期唐廷在河北唯一的支点。此后河北诸镇逐渐半独立，正是因为他这样的抵抗未能持续。', sourceId: 'zizhitongjian-tangmo', kind: 'influence' },
  { id: 'yan-zhenqing', claim: '颜真卿晚年奉使李希烈，是宰相卢杞的排挤之计。《通鉴》记此事时明确指出卢杞「恶其直言，欲去之」——忠义的结局，往往由朝廷内部的倾轧决定。', sourceId: 'zizhitongjian-tangmo', kind: 'dispute' },
  { id: 'li-mi', claim: '李密据洛口仓而有数十万众，却始终未能建立赋税与行政体系。《通鉴》记隋末群雄时反复强调「开仓聚众」与「建制定民」的区别——前者可得一时之众，后者方能成一国之基。', sourceId: 'zizhitongjian-tangmo', kind: 'dispute' },
  { id: 'wang-bo', claim: '王勃等「初唐四杰」的文学活动与唐初政治的转型同步。他们在高宗、武后朝进入文坛，正是《通鉴》所记「各其所长」的人才格局形成之时——文学的自觉，与政治的开放是同一件事的两面。', sourceId: 'zizhitongjian-wuzhou', kind: 'influence' },
  { id: 'han-yu', claim: '韩愈倡「文以载道」，其政治立场与中晚唐的藩镇格局直接相关。他主张以儒学的秩序观对抗割据，文章是他的政治工具——「载道」不是文学口号，而是重建统一秩序的努力。', sourceId: 'zizhitongjian-tangmo', kind: 'influence' },
  { id: 'liu-zongyuan', claim: '柳宗元的「封建非圣人意也，势也」写于贬谪期间，针对的正是中晚唐藩镇割据的现实：分封与割据都源于「势」，而非圣人之意。他的历史观是从当下的政治困境中生长出来的。', sourceId: 'zizhitongjian-tangmo', kind: 'dispute' },
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
