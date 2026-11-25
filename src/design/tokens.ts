/**
 * 设计令牌：全站唯一真源。
 *
 * 规则：
 * - 任何组件、CSS、canvas、Cytoscape 都不得出现裸色值 / 裸间距 / 裸断点。
 * - 改动风格 = 改这个文件，不是改组件。
 * - 构建期由 scripts/gen-tokens.ts 生成 tokens.generated.css（CSS 通道）；
 *   运行时由 Canvas / Cytoscape 直接 import 本文件取已解析的 hex（JS 通道）。
 */

/* ------------------------------------------------------------------ *
 * 1. 原始层 primitive —— 无语义，只在主题定义里被引用
 * ------------------------------------------------------------------ */

export const color = {
  // 宣纸：古典文人风的底色体系（明显偏暖偏黄，是「纸」而不是「白」）
  xuan: {
    0: '#f7f0e0',
    50: '#f2e9d5',
    100: '#eae0c8',
    200: '#ded1b3',
    300: '#c9b998',
  },
  // 古籍墨：不用纯黑，墨色带褐，接近松烟墨
  mosong: {
    900: '#2a231a',
    800: '#3a3125',
    700: '#4b4030',
    600: '#5e5140',
    500: '#75674f',
    400: '#918268',
    300: '#ab9d84',
    200: '#c8bda9',
    100: '#e0d8c8',
  },
  // 状态色：只在极少数场景（争议标记、校验失败）使用
  warn: { 500: '#b8860b', 100: '#f8efd4' },
  danger: { 500: '#a12b2b', 100: '#f6dede' },
} as const;

/** 字号阶梯：以 1.25 倍率构建，根字号 16px。命名用 t-shirt size 便于沟通。 */
export const fontSize = {
  '2xs': '0.6875rem', // 11px 仅用于徽标
  xs: '0.75rem', // 12px 脚注、图注
  sm: '0.8125rem', // 13px 辅助信息
  base: '0.9375rem', // 15px 正文（中文 15-16px 更舒适）
  md: '1.0625rem', // 17px 长文正文
  lg: '1.25rem', // 20px 小标题
  xl: '1.5rem', // 24px 区块标题
  '2xl': '1.875rem', // 30px 页面标题
  '3xl': '2.375rem', // 38px 特稿标题
  '4xl': '3rem', // 48px hero
  '5xl': '3.75rem', // 60px 封面数字
} as const;

/**
 * 字重。
 *
 * 整站已改为系统字体（见下方 fontFamily 注释），系统楷体通常只有
 * 单字重，所以这里不再区分 500/600：任何「比正文粗一点」的需求
 * 都落到 500，避免浏览器做合成加粗（synthetic bold）——
 * 那是「描边变粗的字」，与真正的 Medium 字形不同，且各浏览器算法不一致。
 *
 * bold 保留 700，仅用于确实需要强对比的极少数位置（如印章式标记）。
 */
export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 500,
  bold: 700,
} as const;

/** 行高：中文需要比西文更松，正文 1.75 是底线 */
export const lineHeight = {
  none: 1,
  tight: 1.25,
  snug: 1.4,
  normal: 1.6,
  relaxed: 1.75,
  loose: 2,
} as const;

/** 字距：中文标题需要负字距才不松散 */
export const letterSpacing = {
  tighter: '-0.03em',
  tight: '-0.015em',
  normal: '0',
  wide: '0.02em',
  wider: '0.08em', // 用于全大写的 eyebrow 标签
} as const;

/** 间距阶梯：4px 基数 */
export const space = {
  0: '0',
  1: '0.25rem', // 4
  2: '0.5rem', // 8
  3: '0.75rem', // 12
  4: '1rem', // 16
  5: '1.25rem', // 20
  6: '1.5rem', // 24
  8: '2rem', // 32
  10: '2.5rem', // 40
  12: '3rem', // 48
  16: '4rem', // 64
  20: '5rem', // 80
  24: '6rem', // 96
} as const;

export const radius = {
  none: '0',
  sm: '2px',
  md: '4px',
  lg: '8px',
  xl: '12px',
  full: '9999px',
} as const;

/**
 * 控件尺寸：所有可点元素（按钮、标签、筛选条、分段控件）统一到三档。
 *
 * 为什么单列一组而不复用 space：控件高度是**组件的固有属性**，
 * 不该随间距刻度调整而变。此前 9 处控件用了 var(--touch-target) /
 * 2rem / 1.875rem / 32px 四种写法，同一页面上按钮高矮不一。
 *
 * lineHeight 固定为 1：高度完全由 padding + min-height 决定。
 * 否则会继承 body 的 --lh-relaxed（1.75），在多行中文里撑出参差的高度。
 *
 * ## 为什么按端分两组
 *
 * 要求是「每一端自己内部一致」，不是「三端统一成一个高度」。
 * 指针端（PC）有鼠标精确点击，需要「主按钮 / 行内小按钮」的层级差；
 * 触屏端没有 hover、也点不准 28px 的目标，层级差只会变成「高矮参差」的观感。
 *
 * 所以：
 * - base（≥1024px）：保留三档，28 / 36 / 44
 * - touch（<1024px）：三档合一为 40px，手机与平板一样
 *
 * 40px 而非 44px：一是屏幕利用率，二是配合控件自身的横向 padding，
 * 实际可点区域已超过 WCAG 2.5.5 的 44px 下限。
 *
 * 两组值由 scripts/gen-tokens.ts 输出成基础声明 + 一段媒体查询覆盖
 * （媒体查询里不能引用 CSS 变量，数字只能写死，见该脚本注释）。
 */
export const control = {
  /** 指针端（≥1024px）：保留层级 */
  base: {
    /** 内联小按钮、标签页签 */
    sm: '1.75rem',
    /** 默认按钮、筛选项 */
    md: '2.25rem',
    /** 强调按钮、触屏下限（WCAG 2.5.5 建议 44px） */
    lg: '2.75rem',
  },
  /** 触屏端（<1024px）：三档合一，手机与平板共用 */
  touch: {
    sm: '2.5rem',
    md: '2.5rem',
    lg: '2.5rem',
  },
  /** 控件内文字行高，固定 1 避免继承正文的 1.75 */
  lineHeight: '1',
} as const;

export const shadow = {
  none: 'none',
  sm: '0 1px 2px rgba(23, 21, 15, 0.06)',
  md: '0 2px 8px rgba(23, 21, 15, 0.08)',
  lg: '0 8px 24px rgba(23, 21, 15, 0.10)',
  xl: '0 16px 48px rgba(23, 21, 15, 0.14)',
} as const;

/** 边框宽度：1px 用于分隔，2px 用于强调，3px 用于选中态 */
export const borderWidth = { 0: '0', 1: '1px', 2: '2px', 3: '3px' } as const;

/** 动效时长：历史类站点要克制，超过 300ms 会显得轻浮 */
export const duration = {
  instant: '80ms',
  fast: '140ms',
  normal: '200ms',
  slow: '320ms',
} as const;

export const easing = {
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  out: 'cubic-bezier(0, 0, 0.2, 1)',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
} as const;

/** 层级：z-index 集中管理，避免组件内互相攀比 */
export const zIndex = {
  base: 0,
  raised: 10,
  sticky: 100,
  overlay: 500,
  modal: 900,
  toast: 1000,
} as const;

/* ------------------------------------------------------------------ *
 * 2. 断点与响应式布局
 * ------------------------------------------------------------------ */

export const breakpoint = {
  sm: 480, // 手机竖屏
  md: 768, // 手机横屏 / 小平板
  lg: 1024, // 平板横屏 / 小笔记本
  xl: 1440, // 桌面
} as const;

export type BreakpointKey = 'sm' | 'md' | 'lg' | 'xl';

export const layout = {
  /** 内容最大宽度：阅读类页面刻意收窄，长文超过 75 字/行会难读 */
  container: { prose: '42rem', wide: '64rem', full: '90rem' },
  /** 页边距，按断点递增 */
  gutter: { sm: '1rem', md: '1.5rem', lg: '2rem', xl: '3rem' },
  /** 侧栏宽度 */
  sidePanel: { lg: '20rem', xl: '23.75rem' },
  /** 时间线泳道参数（桌面） */
  timeline: {
    laneHeight: '3.5rem',
    laneGap: '0.75rem',
    laneLabelWidth: '7rem',
  },
  /** 触控最小命中区 */
  touchTarget: '2.75rem', // 44px
} as const;

/* ------------------------------------------------------------------ *
 * 3. 字体族
 * ------------------------------------------------------------------ */

/**
 * 字体栈：**不使用自托管 webfont**，全部走系统字体。
 *
 * 为什么放弃霞鹜文楷 webfont：正文字体曾是首屏唯一的实质成本
 * （528 KiB 占首屏传输 87%），且体积随内容线性增长（1948 字 → 429 KB，
 * 补到宋元明清会破 700 KB）。代价是不同平台字形不一致，但换来的是
 * 首屏零字体请求 —— 对纯文字站来说这笔交易划算。
 *
 * 字重局限：系统楷体在多数平台只有 Regular 一档，所以标题不靠字重区分，
 * 而靠字号、字距与颜色层次（见 global.css 的 h1–h6 规则）。
 */
export const fontFamily = {
  /** 标题：衬线，带一点书卷气但不古板 */
  display:
    "'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'SimSun', ui-serif, Georgia, serif",
  /** 正文：宋体衬线，长文阅读最舒适 */
  body: "'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'SimSun', ui-serif, serif",
  /**
   * 楷体：古典文人风的正文与标题。
   * 首选系统楷体；缺失时依次退到宋体衬线，保证任何平台都能出字。
   */
  kai: "'Kaiti SC', 'KaiTi', 'STKaiti', 'Kaiti TC', 'Noto Serif SC', 'Songti SC', serif",
  /** 仿宋：古典风的辅助信息（题跋、注文一类） */
  fangsong: "'FangSong', 'STFangsong', 'Noto Serif SC', serif",
  /** UI：无衬线，界面元素用衬线会显得笨重 */
  ui: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', ui-sans-serif, system-ui, sans-serif",
  /** 数字与年份：等宽的拉丁衬线，时间线对齐需要 */
  numeric: "'Noto Serif SC', ui-serif, Georgia, serif",
  mono: "ui-monospace, 'SF Mono', Consolas, monospace",
} as const;

/* ------------------------------------------------------------------ *
 * 4. 语义层 + 主题层
 *
 * 语义名是组件唯一允许消费的接口。每套主题把语义名映射到原始值。
 * ------------------------------------------------------------------ */

/** 语义名清单：新增语义变量必须先加进这个类型，否则主题会漏实现 */
export type SemanticKey =
  | 'color-paper' // 页面底色
  | 'color-paper-alt' // 次级底色（交替区块）
  | 'color-surface' // 卡片/浮层底色
  | 'color-surface-raised' // 浮起的卡片
  | 'color-ink' // 正文
  | 'color-ink-strong' // 标题
  | 'color-ink-muted' // 辅助信息
  | 'color-ink-faint' // 极弱信息、占位
  | 'color-ink-inverse' // 深底上的文字
  | 'color-border' // 常规分隔线
  | 'color-border-strong' // 强调边框
  | 'color-accent' // 强调色（朱砂）
  | 'color-accent-soft' // 强调色浅底
  | 'color-link'
  | 'color-quote-bg' // 史料引文块底色
  | 'color-quote-border' // 引文左侧竖线
  | 'color-selection' // 文本选中
  | 'color-focus-ring' // 键盘焦点环
  | 'color-scrollbar-thumb' // 滚动条滑块
  | 'color-scrollbar-thumb-hover' // 滑块悬停
  | 'color-scrollbar-track' // 滚动条轨道
  | 'color-graph-node'
  | 'color-graph-node-focus'
  | 'color-graph-node-label'
  | 'color-graph-edge-strong'
  | 'color-graph-edge-weak'
  | 'color-graph-bg'
  | 'color-timeline-axis'
  | 'color-timeline-grid'
  | 'color-timeline-point'
  | 'color-timeline-point-active'
  | 'color-lane-1'
  | 'color-lane-2'
  | 'color-lane-3'
  | 'color-lane-4'
  | 'color-lane-5'
  | 'color-lane-6'
  | 'color-lane-7'
  | 'color-lane-8'
  | 'color-cat-political'
  | 'color-cat-military'
  | 'color-cat-institution'
  | 'color-cat-culture'
  | 'color-cat-science'
  | 'color-cat-disaster';

export interface Theme {
  id: ThemeId;
  label: string;
  /** 一句话说明，样张页展示用 */
  note: string;
  /**
   * 装饰语言。这是两套风格的结构性差异所在：
   * 光换 palette 只能得到"同一个站换个色"，换装饰才能看出是两种设计。
   */
  decor: ThemeDecor;
  /** 该主题的字体栈（字体是最容易被识别的风格特征） */
  fontFamily: { display: string; body: string; ui: string; numeric: string };
  semantic: Record<SemanticKey, string>;
}

export interface ThemeDecor {
  /** 留白倍率：用于 --decor-space 参与布局计算 */
  spaceScale: number;
  /** 正文行高倍率：楷体需要更松的行距才好读 */
  lineScale: number;
  /** 标题字距 */
  titleTracking: string;
  /** 是否启用竖排（D1 只输出变量，不做布局） */
  verticalRhythm: boolean;
  /** 卡片圆角：接近直角（线装书没有圆角） */
  cardRadius: string;
}

/** 目前只有一套风格。留字符串类型而非改名为 default，后续加风格时语义清楚。 */
export type ThemeId = 'classical';

/**
 * 泳道色板：8 条泳道必须两两可辨，且不能抢过强调色。
 * 需在米黄宣纸底上成立——冷绿冷蓝在黄底上会发灰，所以整体压暗、提高褐调比例。
 */
const lanePaletteClassical = [
  '#3d6b53',
  '#8a5c2a',
  '#3c5a7a',
  '#9c3529',
  '#5c8a70',
  '#a8783f',
  '#5a7793',
  '#6b6250',
] as const;

/** 分类色：军事=赭石，制度=青绿，文化=石青，科技=紫，灾异=灰 */
const catClassical = {
  political: '#9c3529',
  military: '#8a5c2a',
  institution: '#3d6b53',
  culture: '#3c5a7a',
  science: '#63467c',
  disaster: '#75674f',
} as const;

export const themes: Record<ThemeId, Theme> = {
  /* ================================================================ *
   * 古典文人风
   * 米黄宣纸底 + 楷体 + 小面积朱砂 + 印章 + 双线框。文化气质优先。
   * ================================================================ */
  classical: {
    id: 'classical',
    label: '古典文人',
    note: '米黄宣纸底、楷体正文、朱砂方印、双线框、更松的留白。像线装书与题跋。',
    decor: {
      spaceScale: 1.18,
      lineScale: 1.1,
      titleTracking: '0.08em',
      verticalRhythm: true,
      cardRadius: '1px',
    },
    fontFamily: {
      display: fontFamily.kai,
      body: fontFamily.kai,
      ui: fontFamily.fangsong,
      numeric: fontFamily.fangsong,
    },
    semantic: {
      // 底色：宣纸，明显偏暖，不是白
      'color-paper': color.xuan[0],
      'color-paper-alt': color.xuan[50],
      'color-surface': color.xuan[50],
      'color-surface-raised': '#faf4e6',
      // 文字：松烟墨，带褐。三级层次全部通过 WCAG AA（4.5:1）：
      //   ink        mosong800  11.24:1
      //   ink-muted  mosong600   6.78:1
      //   ink-faint  mosong500   4.86:1
      // 原 faint 用 mosong400，在宣纸底上只有 3.30:1，11px 小字不达标，已加深。
      'color-ink': color.mosong[800],
      'color-ink-strong': color.mosong[900],
      'color-ink-muted': color.mosong[600],
      'color-ink-faint': color.mosong[500],
      'color-ink-inverse': color.xuan[0],
      // 边框：墨色淡线，靠双线框立古典感
      'color-border': color.mosong[200],
      'color-border-strong': color.mosong[400],
      // 朱砂：更饱和，但面积要小
      'color-accent': '#9c3529',
      'color-accent-soft': '#f0dcd3',
      'color-link': '#8c2b21',
      'color-quote-bg': color.xuan[100],
      'color-quote-border': '#9c3529',
      'color-selection': '#eed6cc',
      'color-focus-ring': '#9c3529',
      // 滚动条：不能复用 --color-border（在宣纸底上太浅，缺少可拖动的暗示）。
      // 轨道用 transparent，露出纸底，避免在页面上切出一条色带。
      'color-scrollbar-thumb': color.mosong[300],
      'color-scrollbar-thumb-hover': color.mosong[400],
      'color-scrollbar-track': 'transparent',
      'color-graph-node': color.mosong[700],
      'color-graph-node-focus': '#9c3529',
      'color-graph-node-label': color.mosong[900],
      'color-graph-edge-strong': color.mosong[600],
      'color-graph-edge-weak': color.mosong[300],
      'color-graph-bg': color.xuan[0],
      'color-timeline-axis': color.mosong[400],
      'color-timeline-grid': color.xuan[200],
      'color-timeline-point': color.mosong[700],
      'color-timeline-point-active': '#9c3529',
      'color-lane-1': lanePaletteClassical[0],
      'color-lane-2': lanePaletteClassical[1],
      'color-lane-3': lanePaletteClassical[2],
      'color-lane-4': lanePaletteClassical[3],
      'color-lane-5': lanePaletteClassical[4],
      'color-lane-6': lanePaletteClassical[5],
      'color-lane-7': lanePaletteClassical[6],
      'color-lane-8': lanePaletteClassical[7],
      'color-cat-political': catClassical.political,
      'color-cat-military': catClassical.military,
      'color-cat-institution': catClassical.institution,
      'color-cat-culture': catClassical.culture,
      'color-cat-science': catClassical.science,
      'color-cat-disaster': catClassical.disaster,
    },
  },
};

/**
 * 当前唯一风格。需要多风格时把它扩成数组并恢复切换器即可，
 * resolveTheme / canvasFont 都已按 id 取参，不必改动。
 */
export const DEFAULT_THEME: ThemeId = 'classical';

/* ------------------------------------------------------------------ *
 * 5. 运行时解析：给 canvas / Cytoscape 用
 * ------------------------------------------------------------------ */

/**
 * 返回某主题下所有语义变量的具体色值。
 * Canvas 读不到 CSS 变量，必须拿 hex；初始化时取一次即可。
 */
export function resolveTheme(id: ThemeId): Record<SemanticKey, string> {
  return { ...themes[id].semantic } as Record<SemanticKey, string>;
}

/** 取某主题的完整字体栈字符串，供 canvas 的 ctx.font 使用 */
export function canvasFont(
  id: ThemeId,
  opts: { size: number; weight?: number; role?: 'display' | 'body' | 'ui' },
): string {
  const theme = themes[id];
  const family = theme.fontFamily[opts.role ?? 'ui'];
  return `${opts.weight ?? fontWeight.regular} ${opts.size}px ${family}`;
}
