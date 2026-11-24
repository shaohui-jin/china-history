# 待办清单

> 只记未完成的事。已完成项见 git 提交记录，写完的规范见
> [CONTENT-SCHEMA.md](CONTENT-SCHEMA.md) 与 [STYLE-GUIDE.md](STYLE-GUIDE.md)。
>
> **这份文件里的数字只在两种情况下出现**：要么是待补的缺口，要么是
> `npm run validate` / `depth` 当场会报的基线。改动内容后请重跑命令
> 确认，不要把旧数字往下传。

**最近一次核对：2026-11-24**

---

## 待办

### U1 控件尺寸

已统一为三档令牌 `--control-sm|md|lg` + `--control-lh`，
stylelint 已加 `declaration-property-value-allowed-list` 拦截裸值。

**剩余**：三个断点（375 / 768 / 1024+）的视觉复核。

### U2 时间线可读性

已加：泳道内子分层错开、同泳道事件连线、加粗主轴与箭头、纵向列表轴线。

**剩余**：`MIN_GAP`（40px）与 `layerStep`（10px）在极端缩放下是否合适，
需要放大到单世纪、缩小到全域各看一次。

### U3 事件密度

现 133 条，平均每世纪 4.3 条。仍偏薄的世纪：

| 世纪 | 条数 | 可补方向 |
|---|---|---|
| 前 1 | 2 | 居摄与翟义起兵、西域都护的废置 |
| 18 世纪 | 2 | 雍正朝制度（摊丁入亩、军机处）、平定准噶尔 |
| 19 世纪后半 | 2 | 洋务运动、甲午战争、庚子后的新政 |

**验收**：每个世纪 ≥ 4 条。

### P7 人物与事件的关联

- 未出现在任何事件的人物：**23 / 319**
- 没有任何参与者的事件：**10 / 133**

剩余人物与「无参与者事件」的完整名单，用下面这条命令打印（直接复制即可运行）：

```bash
npm run orphans
```

### 为什么这些挂不上

未挂上的多为思想家、文学家、科学家（道安、慧远、陶渊明、王羲之、韩愈、
柳宗元、玄奘、刘勰、萧统、屈原等），本书的事件体系里没有对应条目。

**不硬接**：往 `participants` 加人涉及「此人是否真的参与此事」的史实判断。
批量填充会制造错误——本仓库有过先例（把前蜀王建的内容写进南宋王坚的条目，
两人拼音相同）。宁可留空。

---

## 不做清单

| 项目 | 原因 |
|---|---|
| `/sources/[id]` 详情页 | 单条史料内容量太小，独立成页价值低于维护成本 |
| 多主题切换（editorial / nocturne） | 已废弃，只保留 classical |
| Tailwind CSS | 已明确不用，原生 CSS + `@layer` |
| `places` 集合 / 地图 | 不在当前范围 |
| 图片 `srcset` / `loading="lazy"` | 全站零 `<img>` |
| 竖排文字 | 用户选择「稍后」 |
| webfont / 字体分片 | 已改用系统字体，首屏字体请求为 0 |
| 固定 Lighthouse 版本 | 字体不再是瓶颈，指标稳定 |

---

## 基线（改动内容后请重跑命令核对）

| 指标 | 数值 | 怎么查 |
|---|---|---|
| 内容规模 | 319 人物 / 133 事件 / 28 政权 / 459 史料 | `npm run validate` |
| 事件脚注 | 133 / 133 | `npm run validate` |
| 事件跨书互证 | 133 / 133 | `npm run validate` |
| 事件争议块 | 9 / 133 | `npm run validate` |
| 行内注释 | 事件 102 条 / 653 处；人物 177 位 / 633 处 | `rg -c '\{[^|{}]+\|[^|{}]+\}' src/content/{events,people}/` |
| 人物带出处评价 | 319 / 319 | `npm run depth` |
| 人物第二书目 | 319 / 319 | `npm run validate` |
| 人物 `disputed` | 120 / 319 | `rg -c '^disputed: true' src/content/people/` |
| 字数与小节 | sig=5 48 条、sig=4 80 条、sig=3 5 条，全部达标 | `npm run depth` |

`validate` 与 `depth` 是唯一权威。表里的数字只是某一时刻的快照。

---

## 命令

```bash
npm run validate   # 引用完整性、id 前缀、书目多样性、互证、争议块联动
npm run depth      # 字数与小节完整性
npm run check      # TypeScript 类型
npm run lint:css   # 样式令牌约束
npm test           # 纯函数单测 + git hook 单测
npm run build      # 完整构建（含 Pagefind 索引）
```

## 写作样板

字段规范见 [CONTENT-SCHEMA.md](CONTENT-SCHEMA.md) 第 3.1 节。想直接看一份写全的原文，读这四个：

| 文件 | 示范什么 |
|---|---|
| [src/content/events/qin-unify.md](src/content/events/qin-unify.md) | 四小节齐全、跨书互证、行内注释 |
| [src/content/events/sanguo-chibi.md](src/content/events/sanguo-chibi.md) | 6 处行内注释 + `disputes` 差异对照 |
| [src/content/events/tang-an-lushan-end.md](src/content/events/tang-an-lushan-end.md) | 四小节、跨书互证（通鉴 + 旧唐书） |
| [src/content/people/tang-wu-zetian.md](src/content/people/tang-wu-zetian.md) | 评价三类齐备（evaluation / influence / dispute），两个书目 |

人物侧的 gloss 参照 `sanguo-chibi.md` 的写法：只标真正难懂的 2–4 处，
不要逐句翻译。
