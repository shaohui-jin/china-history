import { writeFileSync, existsSync } from 'node:fs';

const SRC = 'src/content/sources';

const SOURCES = [
  {
    id: 'zizhitongjian-wuzhou',
    title: '资治通鉴',
    volume: '卷二百至二百七·唐纪十六至二十三',
    author: '司马光等',
    composed: '公元 1084 年',
    quote:
      '太后虽滥以禄位收天下人心，然不称职者，寻亦黜之，或加刑诛。挟刑赏之柄以驾御天下，政由己出，明察善断，故当时英贤亦竞为之用。',
    note:
      '《通鉴》对武则天用人的评价极为精准：「滥以禄位收天下人心」而「不称职者寻亦黜之」——宽进严出。这一句是理解武周政治的关键，可与两《唐书·则天本纪》互证。',
  },
  {
    id: 'zizhitongjian-kaiyuan',
    title: '资治通鉴',
    volume: '卷二百一十至二百一十五·唐纪二十六至三十一',
    author: '司马光等',
    composed: '公元 1084 年',
    quote:
      '上即位以来，所用之相，姚崇尚通，宋璟尚法，张嘉贞尚吏，张说尚文，李元纮、杜暹尚俭，韩休、张九龄尚直，各其所长也。……开元之末，上倦于万几，委政于李林甫。林甫媚事左右，迎合上意，以固其宠。',
    note:
      '《通鉴》以「各其所长」四字概括开元诸相，又以「上倦于万几」点出转折。这一段落是理解开元由盛转衰最凝练的叙述。',
  },
  {
    id: 'zizhitongjian-tangmo',
    title: '资治通鉴',
    volume: '卷二百四十至二百六十五·唐纪五十六至八十一',
    author: '司马光等',
    composed: '公元 1084 年',
    quote:
      '自安史之乱，天下户口十亡八九。……藩镇相望于内地，大者连州十余，小者犹兼三四。故兵骄则逐帅，帅强则叛上。',
    note:
      '《通鉴》唐纪末段对藩镇格局的概括极为凝练：「兵骄则逐帅，帅强则叛上」八字，是理解中晚唐政治的基本框架。',
  },
  {
    id: 'xintangshu-zongzan',
    title: '新唐书',
    volume: '卷二·太宗本纪·赞',
    author: '欧阳修等',
    composed: '约公元 1060 年',
    quote:
      '甚矣，至治之君不世出也！禹有天下传十有六王，而少康有中兴之业。汤有天下传二十八王，而其甚盛者，号称三宗。武王有天下传三十六王，而成、康之治与周公之摄政，皆不过什一。……太宗之烈，可谓盛矣。',
    note:
      '《新唐书·太宗本纪》赞语以禹、汤、周武三代为参照，衡量太宗之治的稀有程度。此评与《旧唐书》史臣的叙述角度不同，更侧重历史比较。',
  },
  {
    id: 'zhenguanzhengyao-2',
    title: '贞观政要',
    volume: '卷二·论任贤·李靖',
    author: '吴兢',
    composed: '约公元 720 年',
    quote:
      '李靖，京兆三原人也。……太宗尝谓侍臣曰：「李靖是萧铣、辅公祏膏肓，古之名将韩、白、卫、霍，岂能及也！」',
    note:
      '《贞观政要·论任贤》保存太宗对李靖的当面评价，与《旧唐书·李靖传》的史臣论不同：一为帝王口吻、一为史家定评，可互为参照。',
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
