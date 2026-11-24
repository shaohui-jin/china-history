# 参与维护

这是一个静态生成的中国历史可视化百科。内容用 Markdown / YAML 写，
构建产物是纯静态 HTML + 少量 Vue 组件。

- 技术栈与设计约定见 [docs/CONTENT-SCHEMA.md](docs/CONTENT-SCHEMA.md)（**新增内容前必读**）
- 样式规则见 [docs/STYLE-GUIDE.md](docs/STYLE-GUIDE.md)
- 已知未完成项与风险见 [docs/PENDING-FEATURES.md](docs/PENDING-FEATURES.md)

---

## 环境

```bash
npm ci
npm run dev      # http://localhost:4321
```

**不需要下载字体**。整站使用系统字体（Noto Serif SC / 宋体 / 楷体栈），
构建不依赖网络。字形在不同平台会有差异，这是有意接受的代价 ——
换来的是首屏零字体请求（此前 webfont 占首屏传输 87%）。

这是 2026-11 的决策：webfont 曾占首屏传输 87%（529KB），换系统字体后首屏零字体请求，
Lighthouse 移动端 Perf 从 71 升到 100。字形跨平台存在差异，是有意接受的代价。

---

## 提交前必跑

```bash
npm run validate   # 引用完整性 + 组件硬编码路径扫描
npm run check      # astro check（TS 类型）
npm run build      # 完整构建（含字体子集化与 Pagefind 索引）
```

CI（`.github/workflows/deploy.yml`）会在 Build 之前依次跑 `check` 和 `validate`，
任何一项失败都不会部署。

---

## 新增内容的三步走

1. **写**：按 [docs/CONTENT-SCHEMA.md](docs/CONTENT-SCHEMA.md) 的字段规范写 md / yaml
2. **验**：`npm run validate`（外键悬空、id 拼错、硬编码路径都会在这里暴露）
3. **看**：`npm run build` 后 `npm run preview` 目视检查

内容里的生僻字**不需要**额外处理 —— 系统字体自带全字库，
不经过子集化，也就没有「新字缺字形」的问题。
（此前的自托管 webfont 方案需要 `npm run fonts` 重新切子集，已废弃。）

---

## 提交与推送

每完成一个**可独立验收**的步骤（一条待办项、一批内容、一处修复），立即提交并推送。
不要攒成一个大提交 —— 出问题时按步骤回退，比在一坨 diff 里找原因便宜得多。

- 信息用中文，前缀 `feat:` / `fix:` / `docs:` / `content:` / `perf:` / `test:`
- 正文写「为什么」和「代价」，不写「改了哪些文件」
- **不加 AI 作者**：不写 `Co-authored-by:` 尾注，不加「Generated with …」之类 footer，
  `Author` 与 `Committer` 只留仓库主人
- 推送后 `gh run list --limit 1` 确认 CI 绿；红了先修，再进下一步
- 临时脚本、调试产物不进提交

---

## 改代码时的约定

### 路径

| 位置 | 用什么 |
|---|---|
| `.astro` 模板 | `url()` from `src/lib/url.ts` |
| `.vue` 组件 | `personHref()` / `eventHref()` from `src/lib/nav.ts` |
| Markdown 正文 | `[[type:id]]` |

**不要手写 `/people/xxx`** —— 子路径部署会 404。`npm run validate` 会检查。

### 设计令牌

颜色、间距、字号、字重必须走令牌：

| 类型 | 写法 | lint |
|---|---|---|
| 颜色 | `var(--color-*)` | 强制 |
| 间距/字号 | `var(--sp-N)` / `var(--fs-N)` | **rem 强制**，px/em 放行 |
| 字重 | `var(--fw-*)` | 约定 |

不写裸值。`npm run lint:css` 会拦下裸色值与手写 rem。
完整规则与理由见 [docs/STYLE-GUIDE.md](docs/STYLE-GUIDE.md)。

新增语义键要同步 `src/design/tokens.ts` 的 `SemanticKey` union，
否则 `astro check` 会报错。

### 字重

**不使用 webfont**，所以字重完全由系统字体决定：

- 正文用系统衬线（Noto Serif SC / SimSun）的 Regular
- 标题不靠字重区分，靠**字号 + 字距 + 颜色层次**
- `--fw-semibold` 的值是 500，`--fw-bold` 是 700 —— 系统字体大多支持这两档，
  但楷体在多平台只有 Regular，所以不要指望 500 比 400 明显更粗

`--fw-semibold` **不要改回 600**：那是上一轮为兼容 webfont 400/500 两档做的修正，
现在虽然不再有合成加粗问题，但保持 500 与设计稿一致。

### 关系

一条关系**只在一端声明**。系统会自动双向可见，另一端会带「被提及」标记并
用反向措辞。两端都写不会报错但会造成维护漂移。详见 schema 文档第 1 节。

---

## 已知的坑

| 现象 | 原因 | 处理 |
|---|---|---|
| 内页字体 404 | `@font-face` 用了相对路径 + 样式内联 | 已整体放弃 webfont，改用系统字体 |
| 组件里链接跳到域名根 | 手写 `/people/x` 绕过 BASE_PATH | 用 `nav.ts`，validate 会拦 |
| 标题看起来「描边变粗」 | `--fw-semibold` 曾是 600 但字体只有 400/500 | 已修，改 500 |
| 首页说「两千两百年」但内容只到 763 | 文案写死 | 已修，副标题从数据算 |
| 脚注渲染成一堆没样式的 `<div>` | 在 remark 阶段误用 hast 的 `tagName` | 改用 mdast 原生节点 + `data.hName` |
| Markdown 改动后构建没反应 | Astro content 缓存 | 删 `.astro/` 与 `dist/` 重跑 |
