/**
 * 页面布局配置：把「一个页面长什么样」变成数据。
 *
 * 原则：
 * - 组件通过 props 接收配置，**不 import 这个文件**。
 *   这样同一个组件能在不同页面用不同密度（如首页嵌入版 vs 完整时间线页）。
 * - 所有数值单位是 CSS 可用的字符串或纯数字（纯数字用于 canvas 计算，单位 px）。
 * - 按断点给变体，因为 canvas 不认 media query，必须显式传入。
 */

import type { BreakpointKey } from './tokens';

/** 时间线在不同宽度下的密度参数 */
export interface TimelineConfig {
  /** 泳道高度（px），canvas 直接用 */
  laneHeight: number;
  /** 泳道之间的间隙（px） */
  laneGap: number;
  /** 左侧泳道标签列宽（px） */
  labelWidth: number;
  /** 底部时间刻度区高度（px） */
  axisHeight: number;
  /**
   * LOD 阶梯：[可视跨度阈值, 最低 significance]。
   * 跨度大于等于阈值时，只显示 significance >= 该值的事件。
   * 按宽度给不同阶梯——窄屏更狠，只留重大事件。
   */
  lod: readonly (readonly [number, number])[];
  /** 标签最多显示多少字，超出截断 */
  labelMaxChars: number;
  /** 是否显示右侧联动列表 */
  showSideList: boolean;
  /** 是否启用框选（brush）选择时间段 */
  enableBrush: boolean;
}

/** 关系图谱配置 */
export interface GraphConfig {
  /** 初始展示深度（跳数） */
  initialDepth: number;
  /** 单次最多渲染节点数，超出提示收窄 */
  maxNodes: number;
  /** 节点半径（px），视觉常量，不随容器变 */
  nodeRadius: { focus: number; primary: number; weak: number };
  /** 边线宽 */
  edgeWidth: { strong: number; weak: number };
  /** 字号 */
  fontSize: { node: number; focus: number; edge: number };
  /** 是否显示时间滑块 */
  showTimeSlider: boolean;
}

/** 人物页区块顺序 */
export type PersonSection =
  | 'identity'
  | 'summary'
  | 'bio'
  | 'graph'
  | 'sources'
  | 'dispute'
  | 'related';

export interface PersonPageConfig {
  sections: PersonSection[];
  /** 关系缩略图深度 */
  graphPreviewDepth: number;
  /** 正文最大宽度 */
  proseMaxWidth: string;
}

export interface TimelinePageConfig {
  /** 页面壳层参数 */
  heroHeight: string;
  /** 初始可视时间窗，null = 全跨度 */
  initialWindow: [number, number] | null;
}

/* ------------------------------------------------------------------ *
 * 具体配置
 * ------------------------------------------------------------------ */

/** 时间线：按断点给不同密度 */
export const timelineByBreakpoint: Record<BreakpointKey, TimelineConfig> = {
  // 手机：不在画布上画泳道（改用 TimelineVertical），此配置仅作兜底
  sm: {
    laneHeight: 44,
    laneGap: 8,
    labelWidth: 52,
    axisHeight: 22,
    lod: [[Infinity, 5]],
    labelMaxChars: 6,
    showSideList: false,
    enableBrush: false,
  },
  md: {
    laneHeight: 48,
    laneGap: 10,
    labelWidth: 62,
    axisHeight: 24,
    lod: [
      [Infinity, 4],
      [300, 3],
      [120, 2],
      [0, 1],
    ],
    labelMaxChars: 8,
    showSideList: false,
    enableBrush: true,
  },
  lg: {
    laneHeight: 52,
    laneGap: 12,
    labelWidth: 76,
    axisHeight: 26,
    lod: [
      [Infinity, 4],
      [400, 3],
      [150, 2],
      [0, 1],
    ],
    labelMaxChars: 9,
    showSideList: true,
    enableBrush: true,
  },
  xl: {
    laneHeight: 56,
    laneGap: 12,
    labelWidth: 84,
    axisHeight: 28,
    lod: [
      [Infinity, 4],
      [400, 3],
      [150, 2],
      [0, 1],
    ],
    labelMaxChars: 10,
    showSideList: true,
    enableBrush: true,
  },
};

/** 关系图谱：视觉常量跨断点保持不变，只有深度与上限不同 */
export const graphByBreakpoint: Record<BreakpointKey, GraphConfig> = {
  sm: {
    initialDepth: 1,
    maxNodes: 12,
    nodeRadius: { focus: 14, primary: 7, weak: 5 },
    edgeWidth: { strong: 1.4, weak: 1 },
    fontSize: { node: 10, focus: 11, edge: 8 },
    showTimeSlider: false,
  },
  md: {
    initialDepth: 1,
    maxNodes: 40,
    nodeRadius: { focus: 16, primary: 8, weak: 6 },
    edgeWidth: { strong: 1.5, weak: 1 },
    fontSize: { node: 10.5, focus: 12, edge: 9 },
    showTimeSlider: true,
  },
  lg: {
    initialDepth: 1,
    maxNodes: 120,
    nodeRadius: { focus: 17, primary: 8, weak: 6 },
    edgeWidth: { strong: 1.5, weak: 1 },
    fontSize: { node: 11, focus: 12, edge: 9 },
    showTimeSlider: true,
  },
  xl: {
    initialDepth: 2,
    maxNodes: 200,
    nodeRadius: { focus: 18, primary: 9, weak: 6 },
    edgeWidth: { strong: 1.6, weak: 1 },
    fontSize: { node: 11, focus: 12, edge: 9 },
    showTimeSlider: true,
  },
};

/** 人物页：区块顺序固定，保证每页可扫读 */
export const personPage: PersonPageConfig = {
  sections: ['identity', 'summary', 'bio', 'graph', 'sources', 'dispute', 'related'],
  graphPreviewDepth: 1,
  proseMaxWidth: '42rem',
};

/** 首页 */
export const homePage = {
  /**
   * 主标题。
   *
   * 历史教训：曾写作「两千两百年」，但当时内容只覆盖前 221 – 763（约 984 年），
   * 首页自我矛盾。现在内容已补到 1912（前 221 – 1911，约 2132 年），
   * 标题可以改回带年数的表述。
   *
   * 但仍保留动态副标题（index.astro 从 timeline.items 计算真实跨度）：
   * 标题给人的是定位，副标题给的是事实。两者都由数据支撑，不会漂移。
   */
  heroTitle: '两千一百年，一条可漫游的时间轴。',
  /** 首屏推荐事件数 */
  featureEventCount: 4,
  /** 首页时间线是否精简 */
  timelineCompact: true,
};

/** 时间线页 */
export const timelinePage: TimelinePageConfig = {
  heroHeight: '32vh',
  initialWindow: null,
};

/** /styleguide 与首页分离后，首页只做导览 */
export const styleguidePage = {
  sections: ['type', 'color', 'cards', 'components', 'graph', 'responsive'] as const,
};
