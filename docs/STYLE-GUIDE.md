# 样式规范

> 这份文档只管「写 CSS 时什么能用、什么不能用」。令牌的来源与生成在
> [src/design/tokens.ts](../src/design/tokens.ts) 与
> [scripts/gen-tokens.ts](../scripts/gen-tokens.ts)，本文不重复。
>
> 全部规则由 `npm run lint:css` 强制，CI 会在 Build 之前跑它。

---

## 1. 四条硬规则

```bash
npm run lint:css   # 违规就失败，不进入构建
```

### 1.1 颜色必须用 `var(--color-*)`

```css
/* ✗ 裸色值 */
color: #ff0000;
border-color: rgb(0 0 0 / 50%);

/* ✓ */
color: var(--color-accent);
border-color: var(--color-border);
```

**放行**：`transparent` / `currentColor` / `inherit` / `none` / `unset`，
以及任何含 `var(` 的值。

**为什么**：颜色是主题切换的唯一接口。写一次裸色值，换主题时就会漏掉这一处，
页面上出现一个不属于任何主题的颜色。

### 1.2 间距与字号：**rem 必须走令牌，px / em 放行**

```css
/* ✗ rem 裸值 */
gap: 1.25rem;
padding: 0.5rem 0.75rem;
font-size: 0.85rem;

/* ✓ 走令牌 */
gap: var(--sp-5);
padding: var(--sp-2) var(--sp-3);
font-size: var(--fs-sm);

/* ✓ px 微调（刻度里没有这么细的值） */
gap: 2px;
padding: 3px;
border-width: 1px;

/* ✓ em 相对字号（上标、注文） */
font-size: 0.7em;
```

**这条规则的边界为什么是这样**：

| 单位 | 处理 | 理由 |
|---|---|---|
| `rem` | **必须** `var(--sp-N)` / `var(--fs-N)` | `1.25rem` 与 `--sp-5` 同值。手写它，日后调整令牌刻度时这一处必漏，间距体系出现特例 |
| `px` | 放行 | 本项目有两类合法用途：SVG 内部的 1:1 像素设计；`1px`/`2px` 这类描边级微调，令牌刻度里没有这么细的值 |
| `em` | 放行 | 相对字号（`0.7em` 的上标、`0.9em` 的注文），本身就是相对语义 |
| `%` `vw` `ch` | 放行 | 布局语义单位，不属于间距刻度 |

> 强行把 `2px` 令牌化，会迫使令牌表里塞进 `--sp-0-5: 2px`、`--sp-03: 4.8px`
> 这种无意义项，反而破坏刻度的可读性。这就是为什么只禁 `rem`。

**`calc()` 里的 rem 也会被拦**，这是有意的 —— 逼你写成令牌表达式：

```css
/* ✗ */
padding-left: calc(2.75rem + var(--sp-3) * 2);

/* ✓ */
padding-left: calc(var(--sp-10) + var(--sp-1) + var(--sp-3) * 2);
```

### 1.3 字重用令牌

```css
font-weight: var(--fw-semibold);  /* 不要写 600 */
```

注意：**项目不使用 webfont**。字重完全由系统字体决定。楷体在多数平台只有 Regular，
所以标题不靠字重区分，靠字号、字距与颜色层次。

### 1.4 生成文件不要手改

`src/styles/tokens.generated.css` 由 `npm run tokens` 生成，
`npm run build` / `npm run dev` 都会先跑它。改 `tokens.ts` 而不是改生成物。

lint 已把生成物加入 `ignoreFiles`。

---

## 2. 令牌刻度速查

### 间距（`--sp-*`）

| 令牌 | 值 | 典型用途 |
|---|---|---|
| `--sp-1` | 0.25rem | 元素内微间隔 |
| `--sp-2` | 0.5rem | 紧凑列表项 |
| `--sp-3` | 0.75rem | 常规内边距 |
| `--sp-4` | 1rem | 段落间距 |
| `--sp-5` | 1.25rem | 卡片内边距 |
| `--sp-6` | 1.5rem | 区块间距 |
| `--sp-8` | 2rem | 大区块间距 |
| `--sp-10` | 2.5rem | 章节间距 |
| `--sp-12` | 3rem | 大章节间距 |
| `--sp-16` | 4rem | 页面级留白 |
| `--sp-section` | `--sp-16 × 1.18` | 首屏段落节奏（随主题 `spaceScale` 变化） |

### 字号（`--fs-*`）

2026-11 整体上调：小号每档 +2px，`3xl` 及以上不变（避免 hero 与页面标题在大屏溢出）。
相邻档位差保持 ≥2px —— 若简单等比放大，`md` 与 `lg` 会几乎重合、层次消失。

| 令牌 | 值 | 对应 px |
|---|---|---|
| `--fs-2xs` | 0.75rem | 12 |
| `--fs-xs` | 0.8125rem | 13 |
| `--fs-sm` | 0.9375rem | 15 |
| `--fs-base` | 1.0625rem | 17 |
| `--fs-md` | 1.1875rem | 19 |
| `--fs-lg` | 1.375rem | 22 |
| `--fs-xl` | 1.625rem | 26 |
| `--fs-2xl` | 2rem | 32 |
| `--fs-3xl` | 2.375rem | 38 |
| `--fs-4xl` | 3rem | 48 |
| `--fs-5xl` | 3.75rem | 60 |

为什么 base 提到 17px：整站正文是楷体、UI 是仿宋，笔画都比黑体细，15px 以下在中文里明显吃力。
行高是倍率（`--lh-body` = `--lh-relaxed × 1.1`），字号变大后自动等比跟进，无需单独调整。

---

## 3. 已有的例外（写新代码时不要模仿）

以下是 lint 通过但属于「历史遗留」，新增代码不应照抄：

| 位置 | 写法 | 说明 |
|---|---|---|
| `EgoGraphDesktop.vue` | `font-size: 9px` / `10.5px` / `12px` | SVG 内的 1:1 像素设计，不能随 rem 缩放 |
| `global.css` `.stat__value` | `font-size: 40px` | 原为 `2.5rem`，令牌化时转为等值 px（`--fs-*` 刻度无此值） |
| `global.css` `.footnote-ref` | `font-size: 0.7em` | 上标需相对正文缩放 |
| `RelationList.vue` | `padding: 0 3.2px` | 原为 `0 0.2rem`，等值转换 |
| `RelationGraph.vue` | `gap: 4.8px` | 原为 `0.3rem`，等值转换 |

> 等值转换的那几处（`3.2px` / `4.8px`）看起来有点怪，但它们是**精确等值**，
> 视觉零变化。若日后想归到刻度，应改设计意图（如「约 3px」）再取最近的令牌，
> 而不是直接四舍五入。

---

## 4. 长列表与 `content-visibility`

超过 10 项的列表建议加 `.u-long-list`：

```html
<ul class="related__list u-long-list">
```

它让浏览器跳过视口外元素的布局与绘制。默认每项按 `3.5rem` 估算高度；
**条目带描述段落时**用高变体，否则滚动会出现空白跳变：

```html
<ol class="tl u-long-list u-long-list--tall">
```

已有使用点：朝代页的人物/事件列表、人物页的生平/相关人物/相关事件、
时间线页的政权列表。

---

## 5. 层叠顺序

`global.css` 用 `@layer` 固定优先级，新增样式要放进对应的层：

```
reset < base < layout < component < utility
```

- 元素默认样式 → `base`
- 页面骨架、栅格 → `layout`
- 组件（按钮、卡片、脚注…）→ `component`
- 工具类（`.u-ui`、`.u-muted`、`.u-long-list`）→ `utility`

组件内的 `<style scoped>` 不受此限，但**不要**在组件里覆盖全局组件类。

---

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

