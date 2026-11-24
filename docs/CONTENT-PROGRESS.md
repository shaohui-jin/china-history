# 内容补全进度

> 标准定义见 [CONTENT-SCHEMA.md](CONTENT-SCHEMA.md) 第 3、3.1 节。
> 这份文档只记录**还差多少**，不重复标准本身。

## 用什么命令看进度

```bash
npm run depth      # 字数 + 小节完整性
npm run validate   # 引用、互证、争议块的结构合法性
```

## 当前差距（2026-11-24）

```
sig=5: 37 条，需 ≥800 字 + 四小节   → 不达标 35 条
sig=4: 60 条，需 ≥500 字 + 三小节   → 不达标 6 条
人物:  274 条，<600 字              → 177 条
```

## 已完成的样板（照此格式写）

| 文件 | 字数 | 说明 |
|---|---|---|
| `events/qin-unify.md` | 1143 | 四小节齐全，双源互证（史记 + 汉书·地理志） |
| `events/an-lushan-end.md` | 900+ | 四小节，双源互证（通鉴 + 旧唐书） |
| `events/chibi.md` | 400+ | 含 6 处行内白话注释 + 争议差异对照 |

## 写作模板

```markdown
---
id: xxx
# ... 现有 frontmatter
sources:
  - 主史料
  - 旁证史料              # 书目必须不同
corroboration:
  primary: 主史料
  secondary:
    - 旁证史料
  agreement: consistent | partial | conflicting
  note: 一两句说明印证了什么 / 差在哪
disputes:                 # agreement 为 conflicting 时必填
  - claim: 争议点
    views:
      - sourceId: 甲书
        statement: ……{差异片段}……
      - sourceId: 乙书
        statement: ……{差异片段}……
---

## 背景
（3-5 段，交代前因与格局，须有出处）

## 经过
（主体叙述，关键论断后跟 [^source-id]，文言难句用 {原文|白话}）

## 影响
（具体到制度、格局、人口、疆域，不写「影响深远」）

## 争议
（有异说则列出；无则写「史料于此无异议」——不能省略）
```

## 分批计划

### 第 1 批：sig=5 最薄的 10 条

按当前字数从少到多：

| 序 | id | 现字数 | 需要的额外史料 |
|---|---|---|---|
| 1 | ~~qin-unify~~ | 131 → 1143 | 已完成 |
| 2 | ~~an-lushan-end~~ | 204 → 900+ | 已完成 |
| 3 | an-lushan-start | 239 | 需第二条（旧唐书·安禄山传） |
| 4 | chibi | 397 | 需扩写正文（史料已有 2 条） |
| 5 | yashan | 453 | 需第二条（宋史·陆秀夫传） |
| 6 | ming-founded | 459 | 需第二条（明史·太祖本纪已有？） |
| 7 | song-chenqiao | 464 | 需第二条（续资治通鉴长编） |
| 8 | yanyun-cede | 488 | 需第二条（辽史·太宗本纪） |
| 9 | jingkang | 537 | 需第二条（金史·太宗本纪） |
| 10 | zhangjuzheng-reform | 601 | 史料已有，需扩写 |

### 第 2 批：sig=4 的 6 条

`caishi` `zhuxi-orthodoxy` `longxing-treaty` `qingli-reform`
`song-beihan-conquest` `qingyuan-partisan-ban`

这些只需补到 500 字 + 三小节（无「争议」节要求）。

### 第 3 批：sig=5 剩余 25 条

逐条扩写到 800 字。工作量最大，建议按朝代分组推进。

### 第 4 批：人物深度 177 条

人物不按 sig 分级，统一以 600 字为软门槛。优先补主要人物：

- 各朝开国君主与名将名相
- 已有 `evaluations` 字段的人物（评价需要出处）
- 出现在多个事件 `participants` 里的人物（被引用越多，越值得写厚）

## 关于跨书互证的工作量

现有 100 个事件里，只有 3 条真正做了双源互证（`qin-unify` `an-lushan-end` `chibi`）。
剩下 97 条要各找一个**不同书目**且**真的记载了这件事**的史料。

这条不能靠凑数：如果找一本没记载此事的书填进 `secondary`，
validate 不会拦（它只查书目是否不同），但读者一查就会发现是假的——
这比不填更糟。

所以每补一条互证，流程是：

1. 确认目标事件的主史料是哪本
2. 思考哪个**时代的**史书可能记载它（后朝修前朝史是常态）
3. 在书里定位到具体卷次
4. 抄录原文进 `quote`
5. 比对两书说法，定 `agreement`

一步没有捷径。这也是为什么内容深度提升会是一个长期工程。
