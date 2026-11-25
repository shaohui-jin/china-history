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

现 143 条，平均每世纪 4.6 条。按「每个世纪 ≥ 4 条」的验收标准，
31 个世纪中已达标 19 个，仍缺 11 个（另有前 8 世纪完全空白）：

| 世纪 | 条数 | 缺 | 可补方向 |
|---|---|---|---|
| 前 11 | 1 | 3 | 商末周初：文王受命、太王迁岐 |
| 前 10 | 2 | 2 | 共王至夷王：王室衰微的开端 |
| 前 9 | 2 | 2 | 宣王后期：千亩之战、料民于太原 |
| **前 8** | **0** | **4** | 幽王废立、犬戎破镐京、平王东迁、携王并立 |
| 前 7 | 2 | 2 | 郑庄小霸、齐襄公之乱 |
| 前 6 | 2 | 2 | 晋献公假道伐虢、宋襄公泓水之败 |
| 前 5 | 2 | 2 | 吴越争霸、孔子相鲁 |
| 前 4 | 1 | 3 | 魏文侯变法、齐威王称雄、赵武灵王胡服 |
| 前 1 | 2 | 2 | 昭君出塞、王莽居摄与翟义起兵 |
| 2 | 3 | 1 | 熹平石经、党锢再起 |
| 9 | 3 | 1 | 会昌灭佛、大中之治 |
| 20 | 2 | 2 | 甲午战争、五四运动 |

用 `npm run density` 可复现上述统计。

**为什么补不动**：缺口集中在先秦（前 11—前 4 共 20 条）。
本库史料对先秦的支撑只有《尚书》2 条、《国语》3 条、《左传》3 条、
《史记》若干，且多为「武王伐纣」「齐桓晋文」等少数节点。
补这些世纪需先扩充史料库（《诗经》《逸周书》《竹书纪年》《世本》等），
否则只能凭记忆写引文，与「必须可溯源」的要求冲突。

2 世纪的缺口则因为东汉只有《后汉书》一个书目来源，无法构成跨书互证。

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
| 内容规模 | 321 人物 / 143 事件 / 28 政权 / 459 史料 | `npm run validate` |
| 事件脚注 | 143 / 143 | `npm run validate` |
| 事件跨书互证 | 143 / 143 | `npm run validate` |
| 事件争议块 | 9 / 143 | `npm run validate` |
| 行内注释 | 事件 102 条 / 653 处；人物 177 位 / 633 处 | `rg -c '\{[^|{}]+\|[^|{}]+\}' src/content/{events,people}/` |
| 人物带出处评价 | 321 / 321 | `npm run depth` |
| 人物第二书目 | 321 / 321 | `npm run validate` |
| 人物 `disputed` | 120 / 321 | `rg -c '^disputed: true' src/content/people/` |
| 字数与小节 | sig=5 50 条、sig=4 84 条，全部达标 | `npm run depth` |
| 事件密度 | 143 条 / 31 个世纪，达标 19 个 | `npm run density` |

`validate` 与 `depth` 是唯一权威。表里的数字只是某一时刻的快照。

---

## 命令

```bash
npm run validate   # 引用完整性、id 前缀、书目多样性、互证、争议块联动
npm run depth      # 字数与小节完整性
npm run density    # 事件密度（按世纪，看 U3 的缺口）
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
