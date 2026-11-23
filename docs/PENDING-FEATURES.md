# 待继续实现功能清单

> 快照时间：2026-11-23 17:56（对应 `dist/` **17:52:02** 的构建产物，`src/layouts/Base.astro` 为 17:49:38、`fonts.generated.css` 为 17:51:57，均早于构建，产物是新的）
>
> 这份文档只记录**尚未完成**或**只做了一半**的事项，不重复已落地的内容。
> 每一项都写明：现状证据 → 为什么重要 → 怎么改 → 验收标准 → 工作量。
>
> 已完成的部分（D1 令牌、D2 页面配置、D3 数据页、D4 时间线、D5 图谱、滚动条、字体管线、部署流水线）不在本文档范围内。

---

## 0. 当前基线（便于回归对比）

| 指标 | 数值 | 来源 |
|---|---|---|
| 构建产物 | 77 个 HTML + 72 页 Pagefind 索引 | `npm run build` |
| 内容规模 | 31 人物 / 35 事件 / 6 政权 / 6 史料 | `npm run validate` |
| 内容时间跨度 | 前 221 – 763（秦 → 唐中期） | `src/content/events/*.md` |
| 事件重要度分布 | sig=3 → 4 条，sig=4 → 20 条，sig=5 → 11 条 | 同上 |
| 字体产物 | `public/fonts/regular.woff2` 439,348 B + `medium.woff2` 61,324 B；`dist/fonts/` 内 medium 被 `subset-display.ts` 二次精确子集化为 **100,244 B**（357 汉字覆盖全部标题） | `public/fonts/`、`dist/fonts/` |
| 移动端 Lighthouse | FCP 917ms / LCP 917ms / SI 917ms / TBT 11ms / CLS 0.002 / **Perf 100** | `docs/baseline/lighthouse-mobile.json` |
| 首屏传输 | 11 请求 / 605 KiB，其中**字体 528 KiB 占 87%**，JS 62 KiB，文档 15 KiB | 同上 |
| 字体路径 | 全部为根绝对（`/fonts/*.woff2`），`../fonts/` 出现 **0** 次；`preload` 77/77 页命中 | `dist/**/*.html` |

> 注意 1：Perf 100 是在**当前 6 个政权、35 个事件**的内容规模下达成的。内容量一旦翻倍，需要重新验证（见 P1-4）。
> 注意 2：字体路径是刚修好的——之前 `@font-face` 用 `../fonts/` 相对路径，配上 `astro.config.mjs:36` 的 `inlineStylesheets: 'always'` 后在内页解析到 `/people/fonts/`，**72/77 页字体 404**。现在 `scripts/build-fonts.ts:323` 输出带 `BASE_PATH` 的根绝对路径，Lighthouse 指标从 FCP 3.4s / LCP 6.0s / 875KiB 字体降到 917ms / 917ms / 528KiB 字体。
> 注意 3：修复过程中还产生过两份未归档的采集（`lh-mobile.json` 17:46、`lh-mobile2.json` 17:49），它们分别读到 FCP 4.0s / LCP 4.4s，**与归档基线不是同一次采集**，已删除。做对比时只认 `docs/baseline/lighthouse-mobile.json`。

---

## P0 — 会让站点"看起来不对"的问题

### P0-1 内容时间跨度与站点定位不符

**现状**

- `src/content/events/` 只有 35 条，时间范围 `-221` 到 `763`。
- `src/content/polities/` 只有 6 个：`qin` `han` `sanguo` `tang` `tujue` `xiongnu`。
- 首页副标题与 `heroTitle` 使用「两千两百年」的表述（`src/design/pages.ts:187` 的 `heroTitle: '两千两百年，一条可漫游的时间轴。'`），与实际覆盖范围差了一千多年。
- 宋、辽、金、元、明、清六个时期**完全空白**：没有政权、没有人物、没有事件。

> 补内容时注意两处联动：
> - 补完后要把 `src/design/pages.ts:187` 的文案与 `src/pages/index.astro` 里 `hero__lede` 的「前 221 年 … 763 年」一起改，否则首页会自相矛盾。
> - 字体是**按项目字表子集化**的（`scripts/build-fonts.ts` 扫 `src/content` + `src/pages` + `src/components`）。新增内容里的生僻字需要重跑 `npm run fonts`，否则会回落到系统楷体。`npm run build` 已包含这一步，但 `npm run dev` 也要重新跑一次才能看到正确字形。

**为什么重要**

这是用户打开首页第一眼就能发现的空洞。时间线缩到全域视图时，右侧约 60% 的横轴没有任何条目，泳道也只有底部几条。图谱与检索同样只有三国、唐两块密集区。

**怎么做**

1. 先补政权占位（`src/content/polities/*.yaml`）：`song` `liao` `jin` `yuan` `ming` `qing`。schema 只有 `id` / `name` / `aliases` / `span` / `order` / `note` / `coexistedWith`（`src/content.config.ts:18-32`），**没有颜色字段**——泳道颜色由 `laneIndex` 从 8 个 `--color-lane-*` 令牌里取，见 P1-2。
   注意 `order` 决定泳道顺序，与 `src/lib/content.ts` 的 `getTimelineData()` 里 `laneIndex = (i % 8) + 1` 相关——**政权数超过 8 个后泳道会开始复用行号**，届时需要改这段逻辑（见 P1-2）。
2. 每个时期先给 3–5 个"锚点事件"（建国、决定性战役、制度变革、灭亡），保持 sig=5。
3. 每个锚点事件挂 2–3 个关键人物，人物之间的关系至少 2 条（否则图谱会变成孤岛）。
4. 每批内容提交前跑 `npm run validate`，确保 `reference()` 外键不悬空。

**验收标准**

- 事件覆盖到 1912 年，时间线全域视图横轴无大片空白。
- `polities` ≥ 12 个，且 `npm run validate` 零错误。
- 新增内容自动进入 Pagefind 索引（无需额外配置，`data-pagefind-body` 已在模板里）。

**工作量**：大（内容为主，建议分 3～4 批提交：宋辽金 / 元 / 明 / 清）

---

### P0-2 反向链接未渲染，关系是单向的

**现状**

- `src/lib/content.ts:33` 声明了 `personNeighbors: Map<string, string[]>`，`:68-73` 也算出来了。
- 但**全库没有任何消费点**——`rg "personNeighbors" src` 只命中定义与赋值三行。
- 人物页的「相关人物」直接读 `person.relations`（`src/pages/people/[id].astro:90` 附近的 `related`），因此：
  - 如果 A 的人物页里声明了 `A → B`，B 的页面上**不会**出现 A。
  - 只有在 B 自己的 frontmatter 里也写了 `B → A`，双方才会互相出现。

**为什么重要**

D6 的核心价值是「读完一个条目能顺着关系走」。现在**图谱层的节点扩展也只沿出边走**——`getEgoNetwork()` 的 BFS（`src/lib/content.ts:184-199`）只遍历 `person.data.relations`，即 A 页里写的边；边集合倒是双向收集的（`:216-253` 扫全部人物，只要两端都在节点集里就收），但**节点集本身不含只声明了入边的人**。所以在「诸葛亮只在自己页里写了「辅佐 刘禅」」这种情况下，`/graph?focus=liu-shan` 的节点集里根本不会出现诸葛亮，也就无从收那条边。

两处一起修才彻底：`personNeighbors` 双向 + `getEgoNetwork` 的 BFS 也要沿入边扩。

**怎么做**

1. 把 `personNeighbors` 从「只存出边」改成**双向邻接**（`Map<string, Set<string>>`），`getEgoNetwork` 的 BFS 之后直接查这张表，不再单独遍历 `person.data.relations`。这样一处数据、两个消费点（阅读层 + 图谱层）就不会再漂移。

   ```ts
   const personNeighbors = new Map<string, Set<string>>();
   const addEdge = (a: string, b: string) => {
     const cur = personNeighbors.get(a);
     if (cur) cur.add(b);
     else personNeighbors.set(a, new Set([b]));
   };

   for (const p of people.values()) {
     for (const r of p.data.relations) {
       addEdge(p.data.id, r.target.id);   // 出边
       addEdge(r.target.id, p.data.id);   // 关键：反向也记一条
     }
   }
   ```

   注意 `ContentIndex` 接口里的类型（`src/lib/content.ts:33`）也要跟着改成 `Map<string, Set<string>>`，否则 `astro check` 会报。如果不想动接口，就在消费点用 `[...neighbors]` 展开成数组。
2. 人物页新增「被提及」区块，列出只在别人页里声明过的入边，并标注关系类型与来源人。
3. 去重：如果某条关系在两个方向都显式声明了，只渲染一次。

**验收标准**

- 当前数据实测有 **10 条单向边**（只在源人物页里声明、目标页没有反向声明）。修好后目标页要能看到这些入边，可直接拿这几对做验证：
  `cao-cao → zhuge-liang`、`guan-yu → cao-cao`、`zhou-yu → cao-cao`、`lu-xun → liu-bei`、`huang-hao → jiang-wei`、`an-lushan → an-qingxu`、`shi-siming → an-qingxu`、`shi-siming → shi-chaoyi`、`guo-ziyi → li-guangbi`、`yang-guozhong → an-lushan`。
  例：`/people/zhuge-liang/` 上应出现「曹操」，且关系描述为曹操页里写的那一条。
- 每个页面上的邻居数量与 `/graph?focus=<id>&depth=1` 返回的节点数减 1 一致。
- 双方都写了的对称关系（如 `zhuge-liang ↔ liu-shan`）不得渲染两次。

**工作量**：中（`content.ts` 约 20 行 + 人物页模板约 40 行）

---

## P1 — 内容生产与阅读体验

### P1-1 正文内链 `[[type:id]]` 与脚注 `[^source]` 未实现

**现状**

- `rg "\[\[" src/content` 零匹配，`rg "\[\^" src/content` 零匹配。
- `astro.config.mjs` 里 `integrations` 只有 `vue()`（`:22`），**没有任何 remark / rehype 插件**。
- 史料引用目前只能靠 frontmatter 的 `sourceIds` 整体列在页尾（`src/pages/people/[id].astro:195` 的「史料」`<h2>`，引文块从 `:198` 开始），正文里无法精确锚定到「某书某卷」。

**为什么重要**

内容扩到宋元明清后，正文里会大量出现「见《续资治通鉴长编》卷某某」这类需要在句中就跳转的场景。现在只能写纯文本，用户点不动。

**怎么做**

1. 装 `remark-wiki-link` 或在 `scripts/` 下自写一个 30 行的 remark 插件，匹配 `[[person:zhuge-liang]]` / `[[event:chibi]]` / `[[polity:han]]` / `[[source:zizhitongjian-anlushan]]`。
2. 转换时用 `src/lib/url.ts` 的 `url()` 拼前缀，**不要**手写 `/people/xxx`，否则子路径部署会 404。
3. 链接文字默认取目标实体的 `title`/`name`，允许 `[[person:xx|自称]]` 覆盖。
4. 脚注：`remark-gfm` 已支持 `[^1]` 语法，但注释内容需要映射到 `sources` 集合。建议约定 `[^source-id]` 直接写史料 id，构建期解析成引用块；缺 id 时构建失败（防止拼错静默通过）。
5. 在 `astro.config.mjs` 的 `markdown.remarkPlugins` 里注册。

> **前置缺口：史料没有详情页。**
> `src/pages/` 下只有 `people/[id]`、`events/[id]`、`dynasties/[id]` 三个实体路由，**`/sources/[id]` 不存在**（`dist/sources/` 也没有）。`sources` 集合的 6 条数据目前只以「引文块」形式嵌在事件页（`events/[id].astro:122` 的 `sources.length > 0 &&`）和人物页（`people/[id].astro:195` 的「史料」区块）里。
> 所以内链/脚注如果要指向 `source`，要么先补一个 `/sources/[id]` 页面（列出该书引到的所有事件与人物、原文、版本信息），要么脚注就渲染成页内 `popover`/展开块，不跳转。**建议先做后者**（改动小），等史料条目上两位数再考虑独立页。

**验收标准**

- 至少 1 个事件页正文里出现可点击的人物内链，点击后跳到对应人物页。
- 内链在 `BASE_PATH=/history` 构建下仍能正确跳转。
- 写一个不存在的 id 时 `npm run build` 报错并指出文件行号。

**工作量**：中

---

### P1-2 政权超过 8 个后，时间线泳道会串行

**现状**

`src/lib/content.ts:305`：

```ts
laneIndex: (i % 8) + 1,
```

当前只有 6 个政权，`i % 8` 永远不会回绕，所以没有暴露问题。一旦按 P0-1 补到 12 个，第 9 个政权会和第 1 个共用同一行，视觉上会重叠。

**怎么做**

二选一：

- **A（省事）**：把 `8` 提升为配置项，泳道高度固定，改为**可垂直滚动**的 canvas 高度（`TimelineCanvas` 已有 `config` 传入，加一个 `maxLanes` 即可，超出部分在 canvas 内部滚动）。
- **B（更好）**：泳道改为「按时期分组」，同一时期并存的政权才占独立行；不同时期（如汉与宋）复用同一行。这需要在 `polities` 里补 `period` 字段。

**旁注**：泳道颜色绑定的是 `laneIndex` 而不是政权 id（`TimelineCanvas.vue:183` 用 `` c[`color-lane-${lane.laneIndex}`] ``）。所以 A 方案下第 9 个政权会**连颜色也和第 1 个一样**，不只是行重叠——这会让两个不同政权看起来是同一支。无论选 A 还是 B，都建议把颜色改为按政权 id 稳定映射（比如 `--color-lane-1..8` 之外再加一组，或用 `color-mix` 派生色相）。

**验收标准**

- 政权数 ≥ 12 时，任意两个政权的事件在图上一个都不重叠。
- 相同 `laneIndex` 的两个政权，泳道颜色不应完全相同。
- 泳道标签不与相邻标签文字重叠（现有 LOD 逻辑只控制事件密度，不控制标签）。

**工作量**：中（B 方案需要动数据 schema）

---

### P1-3 首页仍注入全量时间线，移动端时间线未分片

**现状**

- 首页：`src/pages/index.astro:104` 是 `data={timeline}`（**全量**），且**没有** `lazyLoad`。
  对比时间线页 `src/pages/timeline.astro:58` 用的是 `data={timelineLite}` + `lazyLoad={true}`，其中 `timelineLite` 只保留 `significance >= 4`（35 条里滤掉 4 条 sig=3）。
- 手机端：两个页面的 `TimelineVertical` 都收全量 `data={timeline}`（`index.astro:109`、`timeline.astro:65`）。`timeline.astro:20-21` 的注释明确写着「手机端仍用全量数据」，即计划里的「手机端按需分年加载」**没做**。

**为什么重要**

当前内容量小，问题不明显。但 P0-1 一旦把事件补到 300+ 条，首页 HTML 会线性膨胀——而首页本来只需要展示「一条可漫游的时间轴」这个预览。

**怎么做**

1. 首页改用与时间线页相同的 `initialItems` 过滤 + `lazyLoad={true}`。首页 canvas 是 `timelineByBreakpoint.lg`，初始缩放级别低，sig<4 本来就不绘制，全量注入纯属浪费。
2. `TimelineVertical` 其实**已经**在内部做了 `significance >= 4` 折叠（`src/components/timeline/TimelineVertical.vue:59-63` 的 `shown` / `hiddenCount`，「展开其余 N 条事件」按钮在 `:122-127`）。但 `props.data.items` 仍是全量，意味着**折叠只是不渲染，数据已经进了 HTML**。真正的缺口是「数据不进首屏 payload」。
   - 最小改动：给 `TimelineVertical` 也接 `data` 的轻量子集（首页/时间线页都传 `timelineLite`），展开时再 `fetch` 缺失的世纪。
   - 或者更省事的折中：接受现状（折叠已经避免了 DOM 膨胀，只浪费序列化体积），在文档里标注「暂不优化」。**建议在内容量翻倍后再决定。**
3. 改完用与 `docs/baseline/lighthouse-mobile.json` 相同的配置重跑，确认首屏传输不涨。

**验收标准**

- 首页 HTML 里搜不到 `significance: 3` 的事件（当前能搜到「蔡伦」）。
- `timeline.astro` 手机分支在默认状态下只渲染 sig≥4 的条目。

**工作量**：小～中

---

### P1-4 `content-visibility` 覆盖面不足

**现状**

- 只有 `src/pages/dynasties/[id].astro:90` 和 `:108` 两处用了 `.u-long-list`。
- `src/styles/global.css:725-729` 的 `.u-long-list > *` 已定义好 `content-visibility: auto` + `contain-intrinsic-size`。
- 以下长列表都没挂这个类：
  - 人物页「生平」时间流 `<ol class="tl">`（`src/pages/people/[id].astro:172`）
  - 人物页「相关人物」`<ul class="related__list">`（`:227`）
  - 人物页「相关事件」`<ul class="related__list">`（`:243`）
  - `/timeline` 的「收录政权」`<ul class="polis__list">`（`src/pages/timeline.astro:70`）

**为什么重要**

`content-visibility` 是 P0-1 内容扩充后成本最低的兜底手段：不用改数据结构，只要给长列表加类名。人物页在宋元明清补完后会明显变长。

**怎么做**

- 给上面四处列表挂 `.u-long-list`（类名直接加在现有 `class` 上即可，`.u-long-list > *` 作用于直接子元素，`<ol class="tl u-long-list">` 命中每个 `<li>`）。
- 注意：`content-visibility: auto` 会让元素在视口外时**不参与布局**，如果列表项里有依赖 `offsetHeight` 的逻辑（目前没有），需要加 `contain-intrinsic-size` 保底高度。现有定义已给了 `auto 3.5rem`（约一行标题 + 一行辅助信息），对 `related__list` 这类单行条目够用；`tl__item` 带 `tl__desc` 时更高，建议再加一个 `.u-long-list--tall > * { contain-intrinsic-size: auto 5rem; }` 变体。

**验收标准**

- Chrome DevTools Performance 面板里，首屏 Layout 时间在内容翻倍后不显著上升。
- 滚动到底部时列表项能正常出现（不能出现空白跳变）。

**工作量**：小

---

### P1-5 字体仍占首屏传输 87%，是最大的单项成本

**现状**

- `docs/baseline/lighthouse-mobile.json`（原 `lh-mobile-after.json`）：首屏 605 KiB 里**字体 528 KiB（87%）**，JS 62 KiB，文档 15 KiB，CSS 0（被内联）。
- `regular.woff2` 单文件 **439,348 B / 1948 字**，`dist/fonts/medium.woff2` 100,244 B / 357 字。
- LCP 元素是 `main > section.hero > div.container > p.hero__lede`，`elementRenderDelay` 仅 207ms、TTFB 11ms —— 说明**渲染链路已经通了**，剩下的时间全在等 429KB 的字体下完。
- `font-display: swap` 已经生效（先出系统楷体），所以 LCP 数字好看；但**真实 4G（非 Lighthouse 模拟）下用户会先看到一段系统楷体再整体重排**，观感损失被指标掩盖了。
- `medium.woff2` 是 `subset-display.ts` 在 `astro build` 之后扫 `dist` HTML 重新切的（357 字），**没有 preload**（这是对的），但它仍在首屏加载。

**为什么重要**

这是当前唯一的性能瓶颈了。TBT 11ms、CLS 0.002、Perf 100，所有指标都满格，但 429KB 的字体在弱网下是实打实的 2～4 秒等待。而且它随**内容扩充线性增长**——P0-1 补到宋元明清后，字表从 1948 涨到 4000+，`regular.woff2` 可能突破 700KB。

**怎么做**

三条路，按性价比排序：

1. **`unicode-range` 分片（推荐，收益最大）**
   `subset-font` 不支持按 unicode-range 切片，需要用 `cn-font-split`（依赖里已经有，见 P2-2）或 `fonttools` 按 unicode 区间切成 8～15 片，`@font-face` 里写 `unicode-range`，浏览器只下实际用到的片。首屏通常只命中 2～3 片（约 100～150KB），其余按需。
   代价：请求数从 2 涨到 10+，HTTP/1.1 下可能反而更慢——但 GitHub Pages 是 HTTP/2，多路复用没有队头阻塞，可以接受。

2. **首屏字表 + 后续补片（改动最小）**
   现状就是「全站字表一次性给」。改成：`regular-crit.woff2`（只覆盖首页首屏出现的约 400 字，压到 ~90KB）+ 完整 `regular.woff2`（`font-display: optional` 或延迟加载，覆盖剩余字）。
   代价：需要在 `build-fonts.ts` 里额外扫一遍首页 DOM 提取字表，且 `swap` 策略要重新设计（否则用户会先看到 crit 字体再跳完整字体，观感更差）。

3. **标题用 medium 替换 semibold（顺带修一个隐性 bug）**
   `global.css:157` 和 `:192` 用的是 `var(--fw-semibold)` = **600**，但字体只有 400/500 两档，`@font-face` 里没有 600。浏览器会做**合成加粗（synthetic bold）**，视觉上是「描边变粗的楷体」，与真正的 Medium 500 不同。建议把 `--fw-semibold` 改成 500，或把 medium 的 `@font-face` 声明成 `font-weight: 400 700`（区间）吃掉 600 的请求。
   这一条**不改体积，但改观感**，且能消除一个隐蔽的跨平台差异（不同浏览器的合成加粗算法不一样）。

**验收标准**

- 首屏字体传输 ≤ 200 KiB（方案 1 或 2）。
- `regular.woff2` 在内容扩到 4000+ 字后仍 ≤ 400KB。
- 标题不再出现合成加粗：`document.fonts.check('600 24px "LXGW WenKai"')` 返回的匹配结果与 500 一致（方案 3）。
- 按 `docs/baseline/lighthouse-mobile.json` 的同配置重跑，LCP 不退化（可用 `node scripts/lh-summary.mjs <新报告>.json` 对比）。

**工作量**：中～大（方案 1 大，方案 2 中，方案 3 小）

---

## P2 — 工程质量与可维护性

### P2-1 CI 不跑类型检查，无样式 lint，无测试

**现状**

- `.github/workflows/deploy.yml` 只有两步校验：`npm run build`（`:49`）和 `npm run validate`（`:53`）。
- **没有** `npm run check`（`astro check` 手动跑过，0 error / 57 hints）。
- 无 `eslint` / `stylelint` / `prettier` 配置文件，无 `*.test.*` / `*.spec.*`。
- 无 `CONTRIBUTING.md`（`git ls-files` 里没有任何 `.md`）。

**为什么重要**

P0/P1 的内容与代码改动量都不小，没有自动化门禁时，`reference()` 悬空、`SemanticKey` 漏实现、裸色值硬编码这类问题只能靠肉眼发现。

**怎么做**

1. `deploy.yml` 的 `Build` 步骤前插入 `run: npm run check`。注意 `astro check` 会失败于任何 TS 错误，先确认当前 0 error 能稳定通过。
2. 样式 lint 用 `stylelint` + `stylelint-declaration-strict-value`，规则约束：颜色必须用 `var(--color-*)`，间距必须用 `var(--sp-*)`，字号必须用 `var(--fs-*)`。只在 `src/styles/**` 和 `**/*.vue` 的 `<style>` 上生效。
3. 单测优先覆盖纯函数：`src/lib/time.ts`（公元前年份、闰年边界、`overlapsYear`）、`src/lib/relations.ts`（去重键）、`src/lib/content.ts` 的 `getEgoNetwork`（深度截断、双向合并）。用 `node --test` 即可，不引入额外框架。
4. `CONTRIBUTING.md` 写清楚：新增内容的三步（写 md → 跑 validate → 跑 build 看截图）、令牌改动必须同步 `SemanticKey`、不得手写 `url()` 之外的绝对路径。

**验收标准**

- 故意写一个 TS 错误，CI 在 Build 之前失败。
- 故意写一个 `#ff0000`，stylelint 报错。
- `npm test` 能在 5 秒内跑完并通过。

**工作量**：中

---

### P2-2 清理死依赖与临时文件 ✅ 已完成

**做了什么**（2026-11-23）

- 删掉 10 个一次性探针：`probe-display.mjs`、`probe-display2.mjs`、`probe-font-budget.mjs`、`probe-slice.mjs` ~ `probe-slice6.mjs`、`fix-links.mjs`。
- 删掉根目录临时产物：`build.log`、`display-charset.txt`、`lh-mobile.json`、`lh-mobile2.json`、`preview.err.log`。
- Lighthouse 基线归档到 `docs/baseline/lighthouse-mobile.json`；`scripts/lh-summary.mjs` 与 `lh-detail.mjs` 的默认入参改指向它，并修掉了原先写死的 `localhost:4331`（改用 `new URL(i.url).pathname`）。
- `.gitignore` 补 `probe*.mjs`、`lh-*.json`、`display-charset.txt`、`build.log`、`*.err.log`，并加 `!/docs/baseline/*.json` 放行基线快照。
- **卸载 3 个死依赖**（`npm uninstall`，共移除 31 个包）：
  - `lxgw-wenkai-webfont` —— 全字库 webfont 包，代码零引用（字体走 `scripts/build-fonts.ts` 自行下载 TTF）
  - `cn-font-split` —— ~40MB 原生依赖，只在 `build-fonts.ts:4-9` 的注释里被提到
  - `axe-core` —— 可访问性检查曾手动跑过，但没有任何脚本引用

**验证**

- `npm run build` → 77 页 HTML，Pagefind 72 页 / 9374 词，字体产物不变（`regular 439348 B` + `medium 100244 B`）
- `dist/**/*.html` 里 `../fonts/` 计数 = **0**
- `npm run check` → **0 errors / 0 warnings / 56 hints**（30 个文件）

**保留的可复用脚本**：`scripts/gen-tokens.ts`、`build-fonts.ts`、`subset-display.ts`、`validate-content.ts`（四个都在 `package.json` 的 build 链路里）、`shoot.mjs`（三端截图）、`lh-summary.mjs`、`lh-detail.mjs`。

> ⚠️ 若后续要走 P1-5 的 `unicode-range` 分片方案，需要重新装回 `cn-font-split`（或改用 `fonttools`）。届时它就不是死依赖了。

---

### P2-3 SEO 元信息缺失

**现状**

- `src/layouts/Base.astro` 只有 `<title>`、`<meta name="description">`、`favicon`、字体 `preload`。
- **没有** `canonical`、Open Graph（`og:title` `og:description` `og:type` `og:url`）、`twitter:card`、`robots.txt`、`sitemap`。
- Lighthouse 的 `canonical` 审计当前是 `notApplicable`（localhost 不算），线上会变成可优化项。

**为什么重要**

这是一个会被分享的百科站（用户会贴链接到微信/微博）。没有 OG 卡片时，分享出去只有一行灰字；搜索引擎也没有 sitemap 可抓。

**怎么做**

1. `Base.astro` 接收 `canonicalUrl?: string` prop，默认用 `Astro.url` + `import.meta.env.SITE` 拼绝对地址。注意 `astro.config.mjs:29` 的 `site` 只在设了 `SITE_URL` 时才存在，本地 dev 下为 `undefined`，需要兜底跳过 canonical 输出（避免打出 `undefined` 开头的 URL）。
2. 加 OG 标签。图片可以先不生成，`og:type=article` + 文字描述已足够。
3. 装 `@astrojs/sitemap`（需要 `site` 已配置，`astro.config.mjs` 里已有 `SITE_URL` 逻辑），`integrations` 里加 `sitemap()`。
4. `robots.txt` **不要**放 `public/`——那是静态文件，`SITE_URL` 换域名时不会跟着变。改成 `src/pages/robots.txt.ts` 动态端点（`export const GET`），用 `import.meta.env.SITE` 拼绝对地址。这样本地 dev、子路径部署、自定义域名三种情况都对。

**验收标准**

- `dist/sitemap-index.xml` 存在且包含 77 个 URL。
- 在 `https://cards-dev.twitter.com/validator` 或任意 OG 调试器里能看到标题与描述。
- Lighthouse 的 `is-crawlable` / `canonical` 均为通过。

**工作量**：小

---

## P3 — 设计一致性与遗留

### P3-1 语义键数量文案与实际不符

**现状**

`src/pages/styleguide.astro:167` 写死「34 个语义键」，但 `src/design/tokens.ts:207` 的 `SemanticKey` 实际有 **45** 个（同页 `:291` 是动态渲染 `Object.keys(theme.semantic).length`，输出正确值）。

**怎么做**

把 `:167` 的数字改成动态插值，或直接删掉具体数字改为「全部语义键见下」。

**工作量**：小（一行）

---

### P3-2 `EgoGraphDesktop` 已边缘化

**现状**

只在 `src/pages/styleguide.astro:267` 与 `src/components/ds/ViewportLab.vue:90` 使用。人物页已改用 `RelationGraph`（`people/[id].astro:216`）。

**怎么做**

二选一：

- 保留为设计系统的「静态 EGO 样张」，在组件顶部注释说明「仅用于设计参照，不用于生产页面」。
- 删除，并同步清理 `ViewportLab.vue` 与 styleguide 的引用。

建议保留——它证明了 1:1 像素 SVG 布局方案，对后续做静态分享图（OG image）有参考价值。

**工作量**：小

---

### P3-3 截图基线过期

**现状**

`.shots/` 里 32 张（8 页 × 4 档）时间戳都是 `16:46`–`16:47`，早于当前构建。字体管线（`subset-font` + `subset-display`）、样式内联、medium 子集化都是之后改的，现有截图不能代表当前观感。

**怎么做**

- 重跑 `node scripts/shoot.mjs`（默认指向 `http://localhost:4322`，可用第一个参数覆盖）。`dist/` 已重建过（77 页，`../fonts/` 计数 0），可以直接跑。
- 真机验证（iOS Safari / Android Chrome）补一次记录，重点看：滚动条观感、字体回退、图谱触摸拖拽。
- ✅ `scripts/lh-summary.mjs` 里写死的 `http://localhost:4331` 已改成 `new URL(i.url).pathname`（2026-11-23 清理临时文件时一并修了）。
- 做严格 A/B 时**固定 Lighthouse 版本**：`lh-mobile-after.json` 是 13.6.0 采集的（`npx --yes` 拉的最新版），而用户给的基线报告是 13.5.0。配置项一致，但版本差异会引入少量打分抖动，建议在 `package.json` 加 `"lighthouse": "13.6.0"` 到 devDependencies 并 `npx lighthouse` 调用本地版本。

**工作量**：小

---

## 附：已知的"不做"清单（避免反复提起）

| 项目 | 原因 |
|---|---|
| 多主题切换（editorial / nocturne） | 已明确废弃，只保留 classical 一套 |
| Tailwind CSS | 已明确不用，原生 CSS + `@layer` |
| `places` 集合 | `content.config.ts:96` 只留了 `placeIds: z.array(z.string()).default([])` 字段，无集合、无数据；地图功能不在当前范围内 |
| 图片 `srcset` / `loading="lazy"` | 全站零 `<img>`，纯文字与 SVG/canvas；等真正引入图片再处理 |
| 垂直排版（竖排文字） | 用户明确选择「稍后」 |

---

## 建议执行顺序

依赖关系上有两个硬约束：**P1-2（泳道扩容）必须在 P0-1（政权破 8 个）之前或同批完成**，否则第 9 个政权会与第 1 个重叠且撞色；**P0-2（反向链接）最好在 P0-1 之前做完**，先把双向模型建好，否则新写的内容都要回头补。

| 顺序 | 事项 | 前置 | 工作量 |
|---|---|---|---|
| 1 | **P2-2 卸载 `lxgw-wenkai-webfont`**（临时文件已清，只剩这个死包） | 无 | 小 |
| 2 | **P1-5 方案 3：修合成加粗**（把 `--fw-semibold` 改 500，或 medium 声明 `font-weight: 400 700`） | 无 | 小 |
| 3 | **P1-3 首页去全量时间线** | 无 | 小 |
| 4 | **P1-4 `content-visibility` 补四处列表** | 无 | 小 |
| 5 | **P1-2 泳道扩容（政权破 8 之前）** | 无 | 中 |
| 6 | **P0-2 反向链接 + BFS 沿入边扩** | 建议在 P0-1 之前做完，先建立双向基础 | 中 |
| 7 | **P1-5 方案 1/2：字体 unicode-range 分片** | 内容量确认后再做（字表会涨） | 大 |
| 8 | **P0-1 内容扩到宋元明清**（分 4 批：宋辽金 / 元 / 明 / 清） | P1-2、P0-2 | 大 |
| 9 | **P1-1 内链与脚注**（内容扩充时同步用起来） | P0-1 至少一批 | 中 |
| 10 | **P2-1 CI 门禁 + 样式 lint + 单测 + CONTRIBUTING** | 无（越早越好） | 中 |
| 11 | **P2-3 SEO（canonical / OG / sitemap / robots 端点）** | 上线前 | 小 |
| 12 | **P3-1 / P3-2 / P3-3 收尾** | 无 | 小 |

> 如果只想用最少工作量换来最大可见提升：做 **P0-1 的「宋辽金」一批 + P0-2**，再补一次截图验收。这两项加起来就能让站点从「三国唐两块密集区」变成「有一条连续主线」。
