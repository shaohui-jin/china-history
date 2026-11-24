# 待办清单

> 只记录**未完成**与**待决策**的事项。已完成项在 git 提交记录里。
> 配置与填写规范见 [CONTENT-SCHEMA.md](CONTENT-SCHEMA.md)、[STYLE-GUIDE.md](STYLE-GUIDE.md)。

---

## 待决策（2 项，需先定方向才能动手）

### D1 `period` 字段的实际用途

**问题**

[CONTENT-SCHEMA.md](CONTENT-SCHEMA.md) 第 4 节三处说法互相矛盾：

| 位置 | 说法 |
|---|---|
| 节标题 | 「政权：`period` **决定**泳道分行」 |
| 正文第 3 段 | 「泳道行号按 `period` 内独立分配、跨 `period` 复用」 |
| 倒数第 2 段 | 「**`period` 不决定分行**，它只用于图例分组与文案」 |

**代码实况**

| 位置 | 实际行为 |
|---|---|
| [content.ts](../src/lib/content.ts) 的 `getTimelineData()` | 分行**纯按时间重叠**（`spansOverlap`），与 `period` 无关 |
| [TimelineCanvas.vue:181](../src/components/timeline/TimelineCanvas.vue) 注释 | 说「同一 period 内独立成行」——这条注释也是错的 |
| [timeline.astro](../src/pages/timeline.astro) 的 `.polis__list` | **没有**按 period 分组 |

结论：`period` 目前在任何地方都不起作用，只在 schema 校验与 `TimelineLane` 接口里透传。文档三种说法没有一种对。

**三选项**

| 选项 | 做什么 | 影响 |
|---|---|---|
| **a 删掉** | 从 `content.config.ts`、`TimelineLane`、25 个政权 yaml 里移除 | 最干净，改动面最大 |
| **b 用于图例分组** | 保留字段，`timeline.astro` 的「收录政权」按四期分组 | 补上实际用途，改动集中在 1 个文件 |
| **c 只改文档** | 改成「仅作元数据，不参与分行与图例分组，预留未来分期筛选」 | 零代码改动，留一个死字段 |

**建议 b**。四档分期（秦及以前 / 汉至南北朝 / 隋唐辽宋夏金 / 元明清）有信息价值，用在图例分组比删掉划算。

若选 b，需同时改三处：`CONTENT-SCHEMA.md` 第 4 节、`TimelineCanvas.vue:181` 注释、`timeline.astro` 的 `.polis__list`。

---

### D2 `significance: 5` 超标，是否提高首屏门槛

**问题**

[CONTENT-SCHEMA.md](CONTENT-SCHEMA.md) 的规则是「sig=5 每朝 3–5 条」，实测：

| 政权 | sig=5 | 超标 |
|---|---|---|
| song | 9 | +4 |
| tang / sanguo / qing | 各 8 | 各 +3 |
| ming | 7 | +2 |
| han | 6 | +1 |

全站 sig=5 有 **77** 条，sig=4 只有 **20** 条。

**实际影响（实测）**

```
dist/index.html            243.4 KB  → gzip 56.8 KB / br 26.3 KB
dist/timeline/index.html   209.6 KB  → gzip 51.9 KB / br 22.6 KB
全站 HTML gzip 中位数        10.6 KB
```

首页 243KB 里 **87KB 是 `astro-island` 的 props**（时间线数据序列化），gzip 后是站点中位数的 5.4 倍。

Lighthouse 移动端 Perf 仍是 100（字体改系统字体后首屏无字体请求），所以**不是当下的性能事故**，而是「内容继续涨就会出问题」的隐患：每多 100 条 sig=5 的事件，首页再涨约 20KB。

**关键**：单纯降级**不会减小首屏**，因为首屏门槛是 `significance >= 4`。

| 层次 | 做什么 | 效果 |
|---|---|---|
| **轻** | 24 条从 5 降到 4，符合文档规则 | 体积不变，为将来提门槛铺路 |
| **重** | 轻 + 首屏门槛从 `>=4` 提到 `>=5` | 首页 243KB → 约 190KB；但很多朝代从 8 条变 3 条 |

**建议降级的 24 条**（保留改朝换代 / 决定性战役 / 制度奠基为 5）：

| 政权 | 降为 4 的 |
|---|---|
| song | 采石之战、钓鱼城之战、端平入洛、绍兴和议 |
| tang | 安史之乱平、马嵬驿之变、唐灭东突厥 |
| sanguo | 白帝城托孤、诸葛亮卒于五丈原、蜀汉亡 |
| qing | 三藩之乱、清朝统一台湾、戊戌变法 |
| ming | 土木之变、萨尔浒之战、靖难之役 |
| han | 白登之围、七国之乱、张骞凿空西域 |

建议先做「轻」。 「重」会让很多朝代的首页展示从 8 条骤降到 3 条，需要确认观感可接受。

**验收**

```bash
# 各政权 sig=5 条数应全部 <= 5
node -e "const{readdirSync,readFileSync}=require('fs');const r={};for(const f of readdirSync('src/content/events')){const t=readFileSync('src/content/events/'+f,'utf8').replace(/\r/g,'');const s=t.match(/significance:\s*(\d)/);const p=t.match(/polityIds:[ ]*\n((?:[ ]*-[ ]*\S+[ ]*\n)+)/);if(!s||+s[1]!==5)continue;const k=p?p[1].split('\n').map(x=>x.replace(/^[ ]*-[ ]*/,'').trim())[0]:'?';r[k]=(r[k]||0)+1}console.log(r)"
```

---

## 待修复（3 项，方向已定）

### F1 `buildEras` 缺「不依赖调用方排序」注释

**问题**

`buildEras` 内部对 `major` 做了 `sort`，但分组按数组顺序切。「我帮你排序了」这个保证只在实现里，不在接口上。查 [time.ts](../src/lib/time.ts) 的 JSDoc，只有一句「排序用的数值」——那是 `toOrdinal` 的注释。

**改什么**

在 `buildEras` JSDoc 的「为什么不按世纪聚合再分组」那段后追加：

```
 * 传入的 items 不要求已排序——函数内部会按 year 重新排序后再切段。
 * 这一条由 time.test.ts 的「乱序输入结果与排序后一致」用例保证。
```

**验收**：`rg "不要求已排序" src/lib/time.ts` 有命中。

---

### F2 `STYLE-GUIDE.md` 缺「断点同步」章节

**问题**

`client:media="(min-width: 1024px)"` 是 Astro 的字符串参数，无法引用 `tokens.ts` 的 `breakpoint.lg`。所以 JS 挂载边界和 CSS 媒体查询在两个页面各写一处，共 4 个硬编码 `1024`。

改断点时只改 CSS，屏幕宽度落在旧值和新值之间会出现「容器可见但组件没挂载」的空白区。

查 [STYLE-GUIDE.md](STYLE-GUIDE.md) 全文，`1024` / `断点` / `breakpoint` **零命中**——这节从来没写过。

**改什么**

在 `STYLE-GUIDE.md` 第 5 节「层叠顺序」之后新增第 6 节：

```markdown
## 6. 断点的两处写法必须同步

`client:media` 的 JS 挂载边界与 CSS 媒体查询是分开写的，**改一处必须改另一处**：

| 页面 | JS 边界 | CSS 媒体查询 |
|---|---|---|
| `pages/index.astro` | `client:media="(min-width: 1024px)"` | `@media (min-width: 1024px)` |
| `pages/timeline.astro` | 同上 | 同上 |

`src/design/tokens.ts` 里有 `breakpoint.lg = 1024`，但 `client:media`
只接受字符串字面量，无法引用变量——这是 Astro 的平台限制。

**症状**：只改 CSS 不改 JS 时，屏幕宽度落在旧值和新值之间会出现
「容器可见但组件没挂载」的空白区，看起来像页面渲染失败。
```

**验收**：`rg "断点的两处写法必须同步" docs/STYLE-GUIDE.md` 有命中。

---

### F3 事件 id 前缀规则形同虚设

**问题**

[CONTENT-SCHEMA.md](CONTENT-SCHEMA.md) 规定事件命名 `朝代-事件`，并说「新增事件必须带朝代前缀」。实测 100 个事件里 **79 个是裸名**（`chibi`、`baideng`、`an-lushan-start`…），而文档同时有豁免条款「现存裸名不强制改名」——豁免覆盖了 79%，规则形同虚设。

**为什么不改数据**

批量改名会破坏：外部链接、Pagefind 索引路径、正文里约 15 处 `[[event:xxx]]` 内链、`sources` 里的 event id 引用。

**改什么**

把文档的「**必须**带朝代前缀」改为「**建议**带前缀，裸名亦可接受，只要全局唯一」，并把豁免条款从「早期数据」改为「现状」。

**验收**：`rg "必须带朝代前缀" docs/CONTENT-SCHEMA.md` 无命中。

---

## 不做清单

| 项目 | 原因 |
|---|---|
| `/sources/[id]` 详情页 | 单条史料内容量太小（书名+卷次+作者+一段引文），独立成页价值低于维护成本。`[[source:xxx]]` 渲染为《书名》行内标记不跳转，已够用 |
| 事件 id 批量加朝代前缀 | 79/100 已是裸名，改名会破坏外部链接、Pagefind 索引与正文内链 |
| 多主题切换（editorial / nocturne） | 已废弃，只保留 classical |
| Tailwind CSS | 已明确不用，原生 CSS + `@layer` |
| `places` 集合 / 地图 | 不在当前范围 |
| 图片 `srcset` / `loading="lazy"` | 全站零 `<img>` |
| 竖排文字 | 用户选择「稍后」 |
| webfont / 字体分片 | 已改用系统字体，首屏字体请求为 0 |
| 固定 Lighthouse 版本 | 字体不再是瓶颈，指标稳定 |

---

## 可选内容扩充（不阻塞）

### 南朝人物偏少

南齐 4 人、南梁 5 人、南陈 3 人。可补萧赜、萧鸾、萧纲、萧绎、陈庆之、韦睿、王僧辩、陈蒨、吴明彻、萧摩诃。

验收：南朝三朝各 ≥ 6 人。

### 十六国只做了 3 人

现只有慕容垂、刘曜、赫连勃勃。可补慕容恪、慕容儁、姚苌、张宾、冉闵。

验收：十六国 ≥ 8 人，且「冉闵杀胡」有事件条目。

### 五代十国只做了 5 人

可补朱友贞、冯道、赵延寿。

验收：五代十国 ≥ 10 人。

---

## 当前基线

| 指标 | 数值 |
|---|---|
| 内容规模 | 274 人物 / 100 事件 / 25 政权 / 49 史料 |
| 构建产物 | 404 个 HTML，Pagefind 399 页 / 69058 词 |
| 脚注覆盖 | 97 / 100 事件 |
| 首页体积 | 243.4 KB（gzip 56.8 KB），其中 87KB 是 island props |
| 三端 | 375 / 768 走纵向列表，≥1024 走画布泳道 |
| 门禁 | `check` / `validate` / `lint:css` / `test` / `build` 全通过 |
