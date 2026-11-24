# 内容补全进度

> 标准定义见 [CONTENT-SCHEMA.md](CONTENT-SCHEMA.md) 第 3、3.1、8.1 节。
> 这份文档只记录**还差多少**，不重复标准本身。

## 用什么命令看进度

```bash
npm run depth      # 字数 + 小节完整性 + 无评价人物
npm run validate   # 引用、互证、争议块、脚注、史料时代合理性
```

## 当前状态（2026-11-24）

```
sig=5: 37 条，需 ≥800 字 + 四小节   → 不达标 0 条
sig=4: 60 条，需 ≥500 字 + 三小节   → 不达标 0 条
人物:  274 条，需 ≥600 字            → 不达标 0 条
人物:  带出处评价                     → 0 条缺失
```

**全部达标。** 这是本阶段的目标状态，后续新增内容须维持同一标准。

## 三个覆盖指标

| 指标 | 现状 | 怎么查 |
|---|---|---|
| 事件脚注 `[^source]` | 100 / 100 | `rg -c '\[\^' src/content/events/` |
| 事件跨书互证 `corroboration` | 100 / 100 | `rg -c '^corroboration:' src/content/events/` |
| 人物第二出处 | 274 / 274 | 见下方脚本 |

人物第二出处（`evaluations` 至少引两个不同书目）：

```bash
node -e "const{readdirSync,readFileSync}=require('fs');let one=0;for(const f of readdirSync('src/content/people')){const t=readFileSync('src/content/people/'+f,'utf8').replace(/\r/g,'');const m=t.match(/^evaluations:\n([\s\S]*?)(?=^\S|\Z)/m);if(!m)continue;const ids=new Set((m[1].match(/sourceId:\s*(\S+)/g)||[]).map(x=>x.split(':')[1].trim()));if(ids.size<2)one++}console.log('仅单一书目:',one)"
```

## 已完成的样板（照此格式写）

| 文件 | 说明 |
|---|---|
| `events/qin-unify.md` | 四小节齐全，跨书互证（史记 + 汉书·地理志），行内注释 |
| `events/chibi.md` | 6 处行内白话注释 + 争议差异对照（`disputes`） |
| `events/an-lushan-end.md` | 四小节，跨书互证（通鉴 + 旧唐书） |
| `people/wu-zetian.md` | 评价三类齐备（evaluation / influence / dispute），两个书目 |

## 写作模板

### 事件

```markdown
---
id: xxx
significance: 5
sources:
  - 主史料
  - 旁证史料              # 书目必须不同
corroboration:
  primary: 主史料
  secondary:
    - 旁证史料
  agreement: consistent     # consistent / partial / conflicting
  note: 一句话说明印证了什么 / 差在哪
disputes:                   # agreement 为 conflicting 时必填
  - claim: 争议的是什么
    views:
      - sourceId: 史料甲
        statement: 船步兵{数十万}     # {} 内的差异片段会高亮
      - sourceId: 史料乙
        statement: 船步兵{十余万}
---

## 背景
## 经过          ← 关键论断后跟 [^source-id]，难句用 {原文|白话}
## 影响
## 争议          ← sig=5 必填
```

### 人物

```markdown
evaluations:
  - claim: （史书定评，具体到某句话或某个判断）
    sourceId: <已存在的史料 id>
    quote: （原文，可选）
    kind: evaluation
  - claim: （具体影响，落到制度/人口/疆域）
    sourceId: <**不同书目**>
    kind: influence
  - claim: （被功业掩盖的一面，或评价的争议）
    sourceId: <任意>
    kind: dispute
```

**关键约束**：

- `sourceId` 必须已存在，否则 `validate` 报错
- **不能只用一本书**：`validate` 会按 `title` 判断是否同一本书（`jiutangshu-*` 与 `xintangshu-*` 才算两本）
- 不能用现代评价（「他是一位伟大的…」）、不能写「后世普遍认为」
- `dispute` 类要具体，如「康熙晚年九子夺嫡、吏治废弛被前期功业掩盖」
