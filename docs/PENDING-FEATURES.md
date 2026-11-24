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
| 行内白话注释（gloss） | 53 个含引用块的事件全部已加，共 342 处。语法写在 `CONTENT-SCHEMA.md` 第 8.1 节。 |
| 事件跨书互证 | 100/100 全部有 `corroboration`。 |
| 事件脚注 | 100/100 全部有 claim 级 `[^source]`。 |
| 人物第二出处 | 274/274 位人物的 `evaluations` 都引了至少两个不同书目。 |

---

## 待修复（1 项）

### F4 首页移动端传全量时间线数据

**问题**

`src/pages/index.astro:27` 对桌面端做了裁剪（`timelineLite`，只留 `sig >= 4`），
但移动端的 `TimelineVertical` 拿到的是**全量** `timeline`：

```astro
<TimelineCanvas data={timelineLite} />          <!-- 桌面：裁剪后 -->
<TimelineVertical data={timeline} />             <!-- 移动：全量 -->
```

**为什么现在这样写**：`TimelineVertical` 内部有「展开其余 N 条」的折叠逻辑，
它需要知道被隐藏的条数。若先滤掉 `sig < 4`，`hiddenCount` 会恒为 0，按钮永远不出现。

**实测影响**

```
dist/index.html  206.9 KB
  island 0（TimelineCanvas  props）  44.5 KB
  island 1（TimelineVertical props） 45.3 KB
```

两个 island 各占约 45 KB，其中移动端那份是全量。gzip 后首页约 50 KB，Lighthouse 移动端 Perf 仍是 100——**不是当下的性能事故**，但每多 100 条事件，这一份还会再涨约 20 KB。

**两个方向**

| 方案 | 做法 | 代价 |
|---|---|---|
| **a 传精简数据 + 单独的计数** | 给 `TimelineVertical` 增加一个 `totalCount` prop，data 只传精简后的 | 组件要改，`hiddenCount` 的算法要调整 |
| **b 保持全量** | 认为移动端用户确实可能点开全部事件 | 首页体积随内容线性增长 |

**建议 a**。移动端折叠后的默认视图与桌面一样只看 `sig >= 4`，用户点「展开其余」时才需要更多——那一刻可以改为动态 fetch（`/data/timeline/<century>.json` 已经有分片）。

**验收**：`dist/index.html` 的两个 island props 都小于 30 KB，且移动端「展开其余 N 条」按钮仍能正确显示条数。

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
| 内容规模 | 274 人物 / 100 事件 / 25 政权 / 334 史料 |
| 构建产物 | 399 页，Pagefind 索引 91089 词 |
| 事件脚注覆盖 | **100 / 100** |
| 事件跨书互证 | **100 / 100** |
| 事件行内注释 | 53 个含引用块的事件，342 处 |
| 人物带出处评价 | **274 / 274**（每人 ≥ 2 个不同书目） |
| 人物字数 | 全部 ≥ 600 字 |
| sig=5 事件 | 37 条，全部 ≥ 800 字 + 四小节 |
| sig=4 事件 | 60 条，全部 ≥ 500 字 + 三小节 |
| 首页体积 | 206.9 KB（两个 island props 各约 45 KB） |
| 三端 | 375 / 768 走纵向列表，≥1024 走画布泳道 |
| 门禁 | `check` / `validate` / `lint:css` / `test` / `build` 全通过 |
