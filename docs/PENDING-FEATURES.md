# 待办清单

> 只记录**未完成**与**待决策**的事项。已完成项在 git 提交记录里。
> 配置与填写规范见 [CONTENT-SCHEMA.md](CONTENT-SCHEMA.md)、[STYLE-GUIDE.md](STYLE-GUIDE.md)。

**最近一次全量核对：2026-11-24**

---

## 已关闭（留着备查）

| 项 | 结论 |
|---|---|
| **D1** `period` 字段用途 | 定为「仅作图例分组与文案，**不参与泳道分行**」。分行纯按时间重叠（`spansOverlap`）。`CONTENT-SCHEMA.md` 第 4 节已重写，三处矛盾消除。字段保留，不删。 |
| **D2** `significance: 5` 超标 | 已通过重评解决。sig=5 从 77 条降到 37 条，各政权 sig=5 全部 ≤5（tang 5、ming 4、qing 4、song 3、sanguo 3…）。首屏门槛维持 `>=4`，无需调整。 |
| **F1** `buildEras` 排序注释 | 已在 `src/lib/time.ts` JSDoc 补「传入的 items 不要求已排序」。 |
| **F2** 断点同步章节 | 已在 `STYLE-GUIDE.md` 第 6 节写明。 |
| **F3** 事件 id 前缀 | 已改为「**建议**带前缀，裸名亦可接受，只要全局唯一」。 |
| 行内白话注释（gloss） | 53 个含引用块的事件全部已加，共 342 处。语法写在 `CONTENT-SCHEMA.md` 第 8.1 节。**人物页也已接入触屏脚本**（`components/GlossScript.astro`，两页共用）。 |
| 事件跨书互证 | 100/100，且**全部是真正不同的书目**。曾有 21 条是「同书异卷冒充互证」，已换独立史料。 |
| 事件脚注 | 100/100 全部有 claim 级 `[^source]`。 |
| 人物第二出处 | 274/274 位人物的 `evaluations` 都引了至少两个不同书目。 |
| **YAML 泄露（严重）** | 曾因注入脚本吞掉 frontmatter 闭合行，**42 个事件页把 sources/corroboration 的 YAML 当正文显示**。已全部修复，构建产物零泄露。 |
| **争议块 disputes** | 从 1 条补到 **8 条**（chibi、jingnan、xuanwu-gate-tang、tumu-fort、sanfan、diaoyu-fortress、qianyan-rise-fall、yiling）。`DisputeDiff` 不再空转。 |
| **`certainty` 联动** | 8 条有 disputes 的事件标 `certainty: disputed`，「史料有异说」徽章开始生效；`validate` 增加了联动检查。 |
| **`disputed` 字段** | 116 位「评价存在真实分歧」的人物标 `disputed: true`（判据：dispute 类评价 ≥2 条且跨 2 个书目）。 |
| **`placeIds` 死字段** | 已从 schema 删除（无数据、无渲染、无引用）。 |
| **sig=3 小节检查** | `check-depth.ts` 补上 `3: ['经过']`，3 条 sig=3 事件也已补出「经过」小节。 |
| **首页桌面端筛选** | 首页改用 `TimelineExplorer`（画布 + 政权筛选条 + `?lane=` 同步），与 `/timeline` 行为一致。 |
| **`/timeline` 移动端体积** | 去掉 `summary` 后 221.2 KB → 198.6 KB。 |

---

## 待修复（0 项）

当前无待修复项。

> **F4 首页移动端传全量时间线数据** —— 已解决（2026-11-24）。
> 做法不是筛条目，而是**去掉 `summary` 字段**：它在 props 里占约 25%（7.0 KB / 28.1 KB），
> 但只在用户点开某一条时才用得上。移动端改为传 `timelineNoSummary` + `hasSummary={false}`，
> 组件在展开时按世纪从 `/data/timeline/<c>.json` 现取（`TimelineVertical` 的 `ensureSummary`）。
>
> 结果：移动端 island props 28.1 KB → 20.0 KB，首页 246.2 KB → 223.7 KB。
> 折叠按钮的 `hiddenCount` 不受影响（条目数未变）。

---

## 内容扩充（不阻塞，按优先级）

### P1 南朝人物偏少

```
nan-qi    1 人
liu-song  3 人
nan-chen  3 人
nan-liang 4 人
```

可补：萧赜、萧鸾、萧纲、萧绎、陈庆之、韦睿、王僧辩、陈蒨、吴明彻、萧摩诃。

**验收**：南朝四朝各 ≥ 6 人。

### P2 十六国只做了 4 人

现只有慕容垂、刘曜、赫连勃勃、王猛。可补慕容恪、慕容儁、姚苌、张宾、冉闵。

**验收**：十六国 ≥ 8 人，且「冉闵杀胡」有事件条目。

### P3 五代十国只做了 11 人

可补朱友贞、赵延寿、刘知远诸子。

**验收**：五代十国 ≥ 15 人。

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

## 当前基线

| 指标 | 数值 |
|---|---|
| 内容规模 | 274 人物 / 100 事件 / 25 政权 / 366 史料 |
| 构建产物 | 399 页，Pagefind 索引 91704 词 |
| 事件脚注覆盖 | **100 / 100** |
| 事件跨书互证 | **100 / 100**（全部为不同书目） |
| 事件争议块 | **8 / 100**（有真实史料分歧的已全部覆盖） |
| 事件行内注释 | 53 个含引用块的事件，342 处 |
| 人物带出处评价 | **274 / 274**（每人 ≥ 2 个不同书目） |
| 人物 `disputed` 标记 | 116 / 274（评价存在真实分歧） |
| 人物字数 | 全部 ≥ 600 字 |
| sig=5 事件 | 37 条，全部 ≥ 800 字 + 四小节 |
| sig=4 事件 | 60 条，全部 ≥ 500 字 + 三小节 |
| sig=3 事件 | 3 条，全部有「经过」小节 |
| 首页体积 | 207.6 KB（桌面 island 31.0 KB / 移动端 20.0 KB） |
| `/timeline` 体积 | 198.6 KB |
| 三端 | 375 / 768 走纵向列表，≥1024 走画布泳道 + 政权筛选 |
| 门禁 | `check` / `validate` / `lint:css` / `test` / `build` 全通过 |
