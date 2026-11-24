# 内容数据规范

> 这份文档定的是「怎么填」，不是「填什么」。字段语义、命名规则、关系模型、
> 内链语法都在这里。新增任何内容前先读一遍，可以避免 90% 的返工。
>
> 配合阅读：[docs/PENDING-FEATURES.md](PENDING-FEATURES.md)（还剩什么没做）、
> [CONTRIBUTING.md](../CONTRIBUTING.md)（提交前跑什么）。

---

## 0. 四个集合的分工

| 集合 | 目录 | 格式 | 一条记录是什么 |
|---|---|---|---|
| `polities` | `src/content/polities/` | YAML | 一个政权 / 朝代 |
| `people` | `src/content/people/` | Markdown | 一个人物，正文是传记 |
| `events` | `src/content/events/` | Markdown | 一个事件，正文是经过 |
| `sources` | `src/content/sources/` | YAML | 一条史料引文（书名 + 卷次 + 原文） |

Schema 定义在 [src/content.config.ts](../src/content.config.ts)，时间类型在
[src/lib/time.ts](../src/lib/time.ts)，关系枚举在 [src/lib/relations.ts](../src/lib/relations.ts)。

---

## 1. 关系模型：单向声明，两端可见

### 核心约定

**一条关系只需要在更相关的那一端声明一次。**

```yaml
# people/cao-cao.md 里写了这条
relations:
  - target: zhuge-liang
    type: enemy
    from: 208
    note: 赤壁对峙
```

那么：

- 曹操页 → 显示「诸葛亮 · 敌对」（正向措辞）
- 诸葛亮页 → **也会**显示「曹操 · 敌对」，并带一个「被提及」标记

这由 [src/lib/content.ts](../src/lib/content.ts) 的 `personNeighbors`（双向 Set）
与 `getPersonRelations()` 共同实现。阅读层和图谱层共用这一张表，
不会出现「页面能看到、图谱看不到」的漂移。

### 不要做双向声明

```yaml
# 错误示范：两个页面都写，维护时必然漂移
# cao-cao.md:  - target: zhuge-liang  type: enemy
# zhuge-liang.md: - target: cao-cao   type: enemy
```

两端都声明时系统会去重（保留声明方那条），所以**不会重复渲染**，
但会让你在改一处时忘记改另一处。**只在更相关的一端写。**

这不是理论风险。2026-11 全库核查发现 **189 条双向声明，其中 37 对两端
`from`/`to`/`strength` 不一致**——同一条关系在两个人物页显示不同年份。
例如成吉思汗一侧写「与忽必烈 1162 起」，忽必烈一侧写「1215 起」；
忽必烈生于 1215，1162 是成吉思汗自己的生年。`getPersonRelations()`
按「读谁就保留谁声明的那条」取用，所以读者看到哪个年份取决于他先打开谁。

已全部统一为同一组值。取值原则：

- **血缘类**（`parent-child` `sibling` `kinship` `spouse`）`from` = 后出生者的生年
- **其他类** `from` = 关系可考的最早年份
- **`to`** = 双方中较早的卒年（关系不可能活过任何一方）；仍存续则留空
- **`strength`** = 两端取较强的一方

还有一个语义坑：`cheng-hao`（1032–1085）与 `zhuxi`（1130–1200）曾标为
`teacher-student`，`from` 写 1032——等于「程颢出生那年收朱熹为徒」。
程颢卒于朱熹出生前四十五年，两人并无及门授受，朱熹是私淑二程。
这类关系宁可只在一端用 `note` 说明传承，也不要硬造一条 `teacher-student`。

### 反向措辞

关系类型分对称（`sibling` `spouse` `kinship` `ally` `enemy` `colleague`）与
非对称（`parent-child` `ruler-subject` `superior` `teacher-student` `recommend` `kill`）。

非对称关系在目标页会用 `relationLabel(type, inverse=true)` 换措辞：

| 声明方看到的 | 目标方看到的 |
|---|---|
| 父子 | 父/母 |
| 君臣 | 君 |
| 统属 | 上级 |
| 师承 | 弟子 |
| 举荐 | 被荐 |
| 诛杀 | 为其所杀 |

要新增类型或改措辞，只改 [src/lib/relations.ts](../src/lib/relations.ts) 一处。

### 语义冲突不是错误

A 对 B 声明 `ruler-subject`，B 对 A 声明 `enemy` —— 这是**两条不同的边**，
都会保留（去重键是「无向对 + type」，类型不同就不冲突）。历史本来就常有
「先为君臣、后成死敌」。

---

## 2. id 命名规则

**全部小写拼音，用连字符分词，与文件名严格一致，且必须以政权前缀开头。**

| 集合 | 规则 | 正例 | 反例 |
|---|---|---|---|
| `people` | `政权-姓名拼音` | `song-wang-jian` `tang-an-lushan` | `wang-jian`（缺前缀） |
| `events` | `政权-事件` | `tang-an-lushan-end` `song-chanyuan` | `chanyuan`（缺前缀） |
| `polities` | `朝代名拼音` | `song` `ming` | `bei-song`（南北宋合并为一个政权） |
| `sources` | `书名拼音-卷/篇` | `sanguozhi-chibi` | `sanguozhi`（同书多卷会撞） |

前缀取 `polityIds[0]`，直接复用政权 id，不另造简称。多政权人物取第一个
（如祖冲之 `liu-song` / `nan-qi`，用 `liu-song-zu-chongzhi`）。

`npm run validate` 会强制这条规则，id 与 `polityIds[0]` 不匹配即报 error。

### 为什么加前缀

2026-11 我把前蜀**王建**的内容写进了南宋**王坚**的条目——王坚、王建、
王俭三个人拼音完全相同（`wang-jian`）。当时库里靠 `wang-jian-nanqi`
这种临时后缀区分南齐王俭，不成规则，也没有任何检查。

加前缀后 `song-wang-jian`（王坚）、`shu-wang-jian`（王建）、
`nan-qi-wang-jian`（王俭）一眼可分。

**但要说清楚：这不是防错机制。** 写的时候认错人，前缀再长也拦不住——
那次错误的根源是我凭记忆判断，没有核对 `name` 字段。前缀解决的是
「同音不同人在库里难以区分」，不是「写的人不会搞错」。
后者只能靠写之前先读一遍该条目的 `name` 与 `summary`。

### 迁移记录（2026-11）

305 人物 + 118 事件全部改为前缀式，涉 1396 处引用。旧 URL 通过
`scripts/gen-legacy-pages.mjs` 在构建后生成跳转页保住（GitHub Pages
不支持 `_redirects`）。映射表在 `src/lib/legacy-ids.ts`，由
`scripts/gen-legacy-map.mjs` 按中文名配对生成。

确认旧链接不再有访问后，删掉这两个脚本、`legacy-ids.ts` 与
`package.json` 里 build 中的 `gen-legacy-pages.mjs` 调用即可。

### 占位约定

- **`jin` 已占用给女真金朝**。西晋 / 东晋用 `xi-jin` / `dong-jin`。
- 政权 `sanguo` 是聚合体（汉末三国），不是单一王朝，命名上按聚合体处理。
- 前缀与语义重复时手工指定（如 `beiwei-split` 用 `northern-wei-split`，
  而非 `northern-wei-beiwei-split`），在 `scripts/migrate-ids.mjs`
  的 `OVERRIDES` 里登记。

---

## 3. `significance` 分级（直接影响首屏体积）

这个字段不只影响时间线图例大小，它**决定事件进不进首屏 HTML**。

### 分级标准

**取消「每朝 3–5 条」的配额**。评级只看事件本身的性质，不按朝代摊派。

| 值 | 判据 | 典型例子 |
|---|---|---|
| **5** | 改朝换代 / 统一与分裂的转折 / 制度奠基 | 秦灭六国、隋灭陈、陈桥兵变、辛亥 |
| **4** | 决定性战役、重要人物节点、重大改革（但未改变王朝归属） | 巨鹿之战、玄武门之变、熙宁变法 |
| **3** | 其余有史料记载的事件 | 一般性的地方事件 |
| 2 / 1 | 备查细节 | 预留 |

**判据的边界**：

- 「战役」本身是 4，只有当它直接导致改朝换代时才升为 5（如崖山之战 = 南宋亡）
- 「政权建立」是 5 还是 4，看它是否开启了新的统一格局：隋建立 → 5（随后统一全国）；西夏立国 → 4（割据一方）
- 「改革」若成功且改变制度框架 → 5（如商鞅变法）；若失败或未落地 → 4（如戊戌变法）

### 每档的字数与小节要求

| 值 | 正文字数 | 必备小节 |
|---|---|---|
| 5 | ≥ 800 | 背景 / 经过 / 影响 / 争议 |
| 4 | ≥ 500 | 背景 / 经过 / 影响 |
| 3 | 不强制 | 经过 |

「争议」小节在无异议时写「史料于此无异议」，不能省略——省了读者无法区分「没争议」和「没写」。

用 `npm run depth` 检查差距。

### 出现在哪里

首页与 `/timeline` 只注入 `significance >= 4` 的事件（见
[index.astro](../src/pages/index.astro) 与 [timeline.astro](../src/pages/timeline.astro)）。
放大到 300 年内时画布才会按世纪向接口追加 sig 较低的事件。

**5 给太多会让首屏重新变重**：首屏 243KB 里有 87KB 是事件数据序列化。
按上述判据评级，不要凭「感觉重要」标 5。

---

## 3.1 可信度：可溯源与交叉验证

这是本项目最重要的内容标准。**没有出处的论断不写进正文。**

### 三层溯源

每个事件必须同时满足：

1. **frontmatter `sources`**：至少 1 条，每条都必须是真实存在的 `sources/*.yaml`
2. **正文 claim 级脚注**：每个关键论断后跟 `[^source-id]`，不能只在文末列书目
3. **`sources/*.yaml` 的 `quote`**：必须有原文，不能只写书名

### 交叉验证 `corroboration`

```yaml
corroboration:
  primary: sanguozhi-chibi          # 主史料：叙述以此书为骨架
  secondary:
    - zizhitongjian-chibi           # 旁证，书目必须与 primary 不同
  agreement: partial                 # consistent | partial | conflicting
  note: 战役经过两书一致；兵力数字《三国志》称「数十万」，《资治通鉴》作「二十余万」
```

**硬规则**：

- `secondary` 至少 1 条，且**书目不同**（`sanguozhi-chibi` 与 `sanguozhi-zhuge` 算同一本）
- `agreement: conflicting` 时**必须**填 `disputes`
- 无法找到第二本书的记载时，`agreement` 写 `consistent` 并在 `note` 里说明「仅见于此书」

### 争议点 `disputes`

```yaml
disputes:
  - claim: 曹操南征兵力
    views:
      - sourceId: sanguozhi-chibi
        statement: 曹操得其水军，船步兵{数十万}，顺流东下
      - sourceId: zizhitongjian-chibi
        statement: 曹操之众远来疲敝，{轻骑一日一夜行三百余里}
```

`statement` 里用 `{}` 包裹**差异片段**，渲染时高亮。为什么用人工标注而不是自动 diff：
文言文的不同记载往往不是字面对应（「数十万」vs「二十余万」措辞完全不同），
自动 diff 只会标出一大片红色。

**`statement` 以 `{` 开头时必须加引号**，否则 YAML 会把它当成 flow mapping：

```yaml
statement: "{尚可喜、耿精忠相继叛}，{乱及十省}。"   # 正确
statement: {尚可喜、耿精忠相继叛}，{乱及十省}。      # 语法错误
```

#### `disputes` 与 `certainty` 必须联动

```yaml
certainty: disputed     # 有异说
```

规则（`validate` 会拦）：

| disputes | certainty | 结果 |
|---|---|---|
| 非空 | `disputed` | ✓ 正确 |
| 非空 | `confirmed`（默认值） | ✗ 报错：「史料有异说」徽章不会显示 |
| 空 | `disputed` | ✗ 报错：徽章会显示但没有内容 |

事件页的徽章只看 `certainty === 'disputed'`，与 `disputes` 是两个独立字段。
不写 `certainty` 时它默认是 `confirmed`，于是**即使写了 disputes，读者也看不到异说提示**。
这个坑曾经存在很久：100 条事件的 `certainty` 全是默认值，那个徽章一次都没出现过。

### 人物评价 `evaluations`

人物的「评价 / 影响 / 争议」**必须**落在这个字段，不允许写无出处的现代评语：

```yaml
evaluations:
  - claim: 陈寿认为诸葛亮治戎为长、奇谋为短
    sourceId: sanguozhi-zhuge
    quote: 然连年动众，未能成功，盖应变将略，非其所长欤
    kind: evaluation        # evaluation | influence | dispute
```

**禁止的写法**：

- 「后世普遍认为」「历来被誉为」——无法溯源
- 「他是一位伟大的军事家」——现代评价，无史料依据
- 「其影响深远」——空话

**正确的写法**：

- 引用具体史书的评价（带书目卷次）
- 多个史书评价不同时，用 `kind: dispute` 分别列出
- 影响要具体到事件：「安史之乱后，河北三镇不复听命于朝廷」而不是「影响深远」

### 为什么定这么严

大语言模型生成历史内容时会**编造看似合理的细节**（兵力数字、具体对话、因果关系），
而且文风越像古籍越难识别。三道关卡的作用：

1. `quote` 强制抄录原文 → 编造的成本变高（要伪造整段文言）
2. 跨书互证 → 单一来源的错误会被第二本书发现
3. `evaluations` 强制带出处 → 「评价」类内容不能靠语感生成

`npm run validate` 会拦下：书目不足、同书冒充互证、conflicting 无 disputes、
脚注引用不存在的史料、evaluations 无 sourceId。

---

## 4. 政权：`period` 仅作图例分组，不参与泳道分行

**代码实况（唯一权威）**：`getTimelineData()` 的分行**纯按时间重叠**（`spansOverlap`）——依次处理政权（按 `order`），每个政权找第一条与已占用区间都不重叠的行，找不到就新开一行。颜色由 id 哈希决定，撞色时顺延。

`period` 字段**不决定分行**，它只用于：

- 图例与文案的分期表述
- `TimelineLane` 接口的透传

**为什么不在 schema 里删掉它**：四档分期（秦及以前 / 汉至南北朝 / 隋唐辽宋夏金 / 元明清）对读者有信息价值，将来若要按期筛选或分组展示，字段已经在。目前它处于「已填、已验证、暂未渲染」的状态。

> 历史提示：本条曾有三种互相矛盾的说法（「决定分行」「period 内独立分配」「不决定分行」）。以本段为准——**分行只看时间重叠**。

```yaml
id: song
name: 宋
aliases: [北宋, 南宋, 赵宋]
span:
  from: { year: 960 }
  to: { year: 1279 }
order: 70                 # 全局唯一，间隔 10，便于插入新政权
period: imperial-mid      # 见下表
note: 一句话说明
coexistedWith: [liao, jin]
```

| `period` | 覆盖范围 |
|---|---|
| `pre-imperial` | 秦及以前 |
| `imperial-early` | 汉、三国、两晋南北朝 |
| `imperial-mid` | 隋唐、辽宋夏金 |
| `imperial-late` | 元明清 |

**关于这个字段**：它**不参与分行计算**，只用于分期表述（见本节开头）。

**颜色**：由政权 id 稳定哈希到 `--color-lane-1..8`（`laneColorIndex()`），
与 `order` 无关。新增政权不需要配颜色，也不会让已有政权换色。

**分行**：不按数组下标硬排，也不是按 `period` —— 而是**按时间重叠**分配。每个政权找第一条与其
时间区间不重叠的行，找不到就新开一行。同一行内若与已有政权撞色，色号顺延。
当前 12 个政权（-221~1912）只需 3 行。这样新增政权不会让画布无限增高。

### 注意：政权占位不等于内容覆盖

`polities/*.yaml` 是时间线的骨架。宋元明清的占位已经建好（`span` 到 1912），
但**还没有事件与人物**。

因此首页副标题的「覆盖跨度」**只按事件算，不含政权占位** —— 否则会写
「到公元 1912 年，共 2133 年」，而页面上一个宋代条目都没有。
事件才是「收录了什么」的真实边界。

---

## 5. 正文内链：`[[type:id]]`

正文（Markdown 正文部分，不含 frontmatter）里可以直接写内链。

```
[[person:zhuge-liang]]            → 诸葛亮（自动取 name）
[[person:zhuge-liang|孔明]]        → 孔明（自定义显示文字）
[[event:chibi]]                   → 赤壁之战
[[polity:tang]]                   → 唐（跳 /dynasties/tang）
[[source:sanguozhi-chibi]]        → 《三国志》（暂无详情页，渲染为行内标记）
```

### 硬规则

1. **写错 id 会让构建失败**，报错会指到具体文件。这是故意的 —— 静默渲染成
   纯文本的错字，半年后没人查得出来。
2. 链接自动带 `BASE_PATH`，子路径部署不会 404。**不要**手写 `/people/xxx`。
3. `type` 只能是 `person` / `event` / `polity` / `source` 四种。

实现见 [src/lib/remark-wikilink.ts](../src/lib/remark-wikilink.ts)，在
[astro.config.mjs](../astro.config.mjs) 的 `markdown.remarkPlugins` 注册。

> 注意：Astro 7 默认使用 Sätteri 处理器，启用 remark 插件需要
> `@astrojs/markdown-remark` 依赖（已加入 `devDependencies`）。

---

## 6. 时间写法

时间类型定义在 [src/lib/time.ts](../src/lib/time.ts)。

```yaml
# 单点
time:
  from: { year: 208 }
  to: null

# 区间
time:
  from: { year: 755 }
  to: { year: 763 }

# 带年号与原文（推荐用于史料精确的条目）
time:
  from:
    year: 755
    era: 天宝
    eraYear: 14
    raw: 天宝十四载十一月
```

规则：

- **负数表示公元前**，且**不允许 `year: 0`**（schema 会拒绝，因为不存在公元 0 年）。
- 不确定的年份加 `approx: true`，会在页面上显示「约」。
- `raw` 优先于年号显示，用于「约公元前 1046 年」这类原文。

---

## 7. 史料（`sources`）

```yaml
id: sanguozhi-chibi
title: 三国志
volume: 卷五十四·吴书·周瑜传
author: 陈寿
composed: 约公元 289 年
quote: 瑜部将黄盖曰：「今寇众我寡，难与持久……」
note: 版本、异文等备注（可选）
```

- **暂无 `/sources/[id]` 详情页**。史料只以引文块形式嵌在事件页与人物页里。
- 正文内链 `[[source:xxx]]` 会渲染成《书名》行内标记，**不跳转**。
- 正文脚注 `[^source-id]` 会在文末生成可展开的「史料出处」区块，见下节。

### 史料 id 的命名与用途

id 应体现「书名 + 定位」，便于判断适用场合：

```
shiji-gaozu            史记·高祖本纪
hanshu-wudi            汉书·武帝纪
jinshu-huandi          晋书·孝怀帝纪
zizhitongjian-feishui  资治通鉴·晋纪（淝水）
songshi-yuefei         宋史·岳飞传
```

**一条史料只能覆盖它真正记载的事**。曾出现「永嘉之乱」引用《晋书·武帝纪》的错误 ——
武帝纪讲的是西晋建国，不是永嘉之乱；正确出处是《晋书·孝怀帝纪》。
写内容时若发现某事件找不到贴切史料，**宁可补一条新史料，也不要硬套现有的**。

---

## 8. 正文脚注：`[^source-id]`

内链用于「跳转到另一个条目」，脚注用于「这里引的是哪本书、原文怎么说」。
两者语法不同、用途不同，不要混用。

### 写法

```
曹操南征荆州。（正文）[^sanguozhi-chibi]
```

渲染结果：

- 正文里出现上标 `[1]`，悬停显示《三国志》卷五十四·吴书·周瑜传，点击滚到文末
- 文末自动生成一个默认收起的区块：

```
史料出处 · 1 条
  1 《三国志》卷五十四·吴书·周瑜传  陈寿 · 约公元 289 年
    瑜部将黄盖曰：「今寇众我寡，难与持久……」
```

### 为什么是这个设计

史料已经在 `sources/*.yaml` 里结构化存储（书名、卷次、作者、原文）。
如果照搬 GFM 的脚注语法，作者需要把注释文本再在正文里写一遍：

```markdown
正文 [^1]
[^1]: 《三国志》卷五十四……（重复一遍 yaml 里的内容）
```

这样两处必然漂移。本站的做法是**正文只写 id，内容从 yaml 取**，一条史料只维护一处。

### 硬规则

1. **写错 id 会让构建失败**，报错指出文件与缺失的 id。
2. 编号按**首次出现顺序**自动分配，同一 id 多次引用共用同一编号。
3. 支持 `[^source-id|自定义文字]` 让上标显示自定义文字（仍参与编号）。
4. 脚注由 [src/lib/remark-footnote.ts](../src/lib/remark-footnote.ts) 实现。

> **实现注意**：插件运行在 **mdast 阶段**，因此构造节点必须用 mdast 原生类型
> （`emphasis` / `paragraph` / `list` / `listItem`）配 `data.hName` + `data.hProperties`，
> **不能**用 hast 的 `type: 'element' / tagName` —— remarkRehype 不认后者，
> 会落到默认 handler 上，表现为输出一堆没样式的 `<div>`。
>
> 另：Astro 默认 `gfm: true`，`[^id]` 在**有配对定义**时才被解析成
> `footnoteReference`；本站不写定义，所以它保持为纯文本，由插件接管。
> 插件同时处理了 `footnoteReference` 节点作为兜底。

---

## 8.1 行内白话注释：`{原文|白话}`

文言引文难懂时，在**原文外面**套一层花括号，用竖线分开原文与译文：

```markdown
> 周瑜部将黄盖曰：「{今寇众我寡，难与持久|现在敌军多、我军少，难以长期相持}。」
```

渲染结果：

```html
<span class="gloss" tabindex="0" data-gloss="现在敌军多、我军少，难以长期相持">今寇众我寡，难与持久</span>
```

**交互**（样式在 `src/styles/global.css`）：

| 输入方式 | 触发 |
|---|---|
| 桌面悬停 | `:hover` 显示浮层 |
| 键盘 | `Tab` 聚焦 → `:focus-visible` 显示 |
| 触屏 | 点击切换 `data-open="true"`（脚本在 `pages/events/[id].astro`） |

**为什么不直接把译文写进正文**：整段双写会让正文体积翻倍，而多数读者只读其中一种。浮层只在需要时出现。

**为什么不加注在脚注里**：脚注是给「出处」用的，混进译文会让两种信息互相干扰——读者想看引文出处时被译文挡住。

**写多少**：只给**真正难懂的语句**加，不要逐句翻译。一段引文通常 2–4 处即可。
判断标准：一个受过高中古文训练的读者，是否需要停下来查字典。

**硬规则**：

1. 原文与译文都**不允许跨行**，也不允许嵌套花括号。
2. 竖线 `|` 是唯一分隔符，译文里不能出现 `|`。
3. 花括号**不要**用在脚注标记内部：`[^id]` 与 `{}` 是两回事。
4. 插件顺序必须是 `remarkFootnote → remarkGloss → remarkWikilink`。
   wikilink 会把文本节点替换成链接节点，之后 gloss 就扫不到了。
5. 由 [src/lib/remark-gloss.ts](../src/lib/remark-gloss.ts) 实现。

**覆盖情况不要写在这里**——内容会变，写了就必然过期。当前数字跑 `node scripts/orphans.mjs`
与 `npm run validate` 看。本条只规定语法。

---

## 9. 新增内容的完整流程

```bash
# 1. 写内容（政权 → 人物 → 事件，顺序无关但引用不能悬空）
#    新增人物记得给 relations，否则图谱里是孤岛

# 2. 校验引用完整性 + 硬编码路径
npm run validate

# 3. 类型检查
npm run check

# 4. 构建
npm run build
```

代码跑完、眼看无误后，按 [CONTRIBUTING.md](../CONTRIBUTING.md) 的「提交与推送」立即提交并推送
—— **一个步骤一个提交**，不加 AI 作者。

### 每批内容的自检清单

- [ ] 新增政权的 `period` 填了，`order` 不与现有冲突
- [ ] 人物与事件 id 都以政权前缀开头（`<polityIds[0]>-<拼音>`），且全局唯一
- [ ] 写新人物前先读一遍已有条目的 `name` 与 `summary`，确认没认错人（同音名字尤其要查）
- [ ] `significance` 按事件性质评级，不是按「想让它首屏可见」评级
- [ ] 每个新人物至少有 1 条 `relations`（不是孤岛）
- [ ] 每个朝代至少 2 条**跨朝代**关系边（否则时间线被切成互不相连的孤岛）
- [ ] `sources` 里的史料**真的记载了这件事**（不要硬套不相关的本纪）
- [ ] 关键论断处加了 `[^source-id]` 脚注
- [ ] 非 trivial 事件填了 `corroboration`，且 `secondary` 与 `primary` **不是同一本书**
- [ ] `npm run validate` 零 error
- [ ] `npm run depth` 无字数为 0 / 缺节项

### 三条命令各自管什么

| 命令 | 管什么 | 漏了会怎样 |
|---|---|---|
| `npm run validate` | 外键悬空、枚举值、组件硬编码路径 | 构建失败或线上 404 |
| `npm run check` | TypeScript 类型 | 构建失败 |
| `npm run build` | Zod schema（最严格）、Markdown 编译 | 构建失败 |

`validate` 是**前置快检**（正则扫描，秒级），`build` 是**最终裁决**（Zod 全量校验）。
两者有重叠但不完全等价：validate 覆盖不到的 schema 细节由 build 兜住。

---

## 10. 为什么不能用相对路径

`astro.config.mjs` 里 `build.inlineStylesheets: 'always'` —— 样式全部内联进 HTML。
这意味着 CSS 不再有独立文件 URL，**任何相对路径都会相对页面 URL 解析**。
历史上的教训：`@font-face` 用 `../fonts/` 导致 `/people/xxx/` 上解析成
`/people/fonts/`，**72/77 页字体 404**（后来整个 webfont 方案已废弃）。

同理，Vue 组件里手写 `` :href="`/people/${id}`" `` 会绕过 `BASE_PATH`，
在 GitHub Pages 项目站（`base = '/<repo>'`）下跳到域名根。

**规则**：

- `.astro` 文件里用 `url()` （[src/lib/url.ts](../src/lib/url.ts)）
- `.vue` 组件里用 `personHref()` / `eventHref()` 等（[src/lib/nav.ts](../src/lib/nav.ts)）
- Markdown 正文里用 `[[type:id]]`

`npm run validate` 会扫描 `src/components/**/*.vue`，发现硬编码站内绝对路径就报 error。
