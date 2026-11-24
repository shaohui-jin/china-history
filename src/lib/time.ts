/**
 * 中国历史日期类型。
 *
 * 为什么不用普通 Date：
 * - 公元前要用负数年份，Date 处理 BCE 会有 0 年问题
 * - 年号需要保留（"开元二十九年"），换算成公元后仍要显示原文
 * - 大量史料的年份是"约"、"前后"，必须能表达不确定性
 * - 跨年事件（安史之乱 755-763）是区间而非时刻
 */
import { z } from 'astro/zod';

/** 单个时间点 */
export const HDate = z.object({
  /** 公元纪年。负数 = 公元前。不存在 0 年，验证时会拒绝。 */
  year: z.number().int().refine((y) => y !== 0, { message: '不存在公元 0 年，请用 -1 或 1' }),
  month: z.number().int().min(1).max(12).optional(),
  day: z.number().int().min(1).max(31).optional(),
  /** 年号，如「开元」 */
  era: z.string().optional(),
  /** 年号纪年数，如「二十九年」写作 29 */
  eraYear: z.number().int().positive().optional(),
  /** 约 / 前后 / 传说时代 */
  approx: z.boolean().default(false),
  /** 史料原文，如「约公元前 1046 年」 */
  raw: z.string().optional(),
});

export type HDate = z.infer<typeof HDate>;

/** 时间区间：用于事件。to 为空表示单点事件。 */
export const HRange = z.object({
  from: HDate,
  to: HDate.nullable().default(null),
});

export type HRange = z.infer<typeof HRange>;

/* ------------------------------------------------------------------ *
 * 工具函数
 * ------------------------------------------------------------------ */

/** 排序用的数值：把年月日压成一个可比较的数 */
export function toOrdinal(d: HDate): number {
  return d.year * 10000 + (d.month ?? 1) * 100 + (d.day ?? 1);
}

/** 年份格式化：负数转「公元前」 */
export function formatYear(year: number): string {
  if (year < 0) return `公元前 ${Math.abs(year)} 年`;
  return `公元 ${year} 年`;
}

/** 紧凑年份，用于刻度、角标 */
export function shortYear(year: number): string {
  return year < 0 ? `前${Math.abs(year)}` : `${year}`;
}

/** 时间点完整显示：优先用原文，其次年号，最后公元 */
export function formatDate(d: HDate): string {
  if (d.raw) return d.raw;
  const parts: string[] = [];
  if (d.era && d.eraYear) {
    parts.push(`${d.era}${eraYearToChinese(d.eraYear)}年`);
  }
  parts.push(formatYear(d.year));
  if (d.month) parts.push(`${d.month}月`);
  if (d.day) parts.push(`${d.day}日`);
  const text = parts.join(' ');
  return d.approx ? `约 ${text}` : text;
}

/** 区间显示：单点事件只显示一次年份 */
export function formatRange(r: HRange): string {
  const from = formatDate(r.from);
  if (!r.to) return from;
  // 同年时只写一次「公元 X 年」
  if (r.to.year === r.from.year) {
    return `${from}${r.to.month ? ` — ${formatDate(r.to)}` : ''}`;
  }
  return `${from} — ${formatDate(r.to)}`;
}

/** 紧凑区间，用于角标 */
export function shortRange(r: HRange): string {
  const from = shortYear(r.from.year);
  if (!r.to || r.to.year === r.from.year) return from;
  return `${from}–${shortYear(r.to.year)}`;
}

/** 1 → 一，29 → 二十九。年号纪年用中文数字 */
export function eraYearToChinese(n: number): string {
  const digits = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (n <= 10) return n === 10 ? '十' : digits[n];
  if (n < 20) return `十${digits[n % 10]}`;
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${digits[tens]}十${ones ? digits[ones] : ''}`;
}

/** 判断事件是否落在给定年份窗口内（与区间求交） */
export function overlapsYear(r: HRange, year: number): boolean {
  const start = r.from.year;
  const end = r.to?.year ?? start;
  return year >= start && year <= end;
}

/* ------------------------------------------------------------------ *
 * 世纪划分
 *
 * 时间线的懒加载分片与移动端分段都以「世纪」为最小单位，
 * 所以这两个函数的定义必须唯一——服务端 API route 与客户端组件
 * 各写一份的话，一旦漂移就会拉错分片（画面上表现为事件莫名消失）。
 * ------------------------------------------------------------------ */

/**
 * 年份所在世纪。
 * 公元前按「前 N 世纪」分段，避免负数取整的歧义。
 *
 * 例：-221 → -3（前 3 世纪）；208 → 3；755 → 8
 */
export function centuryOf(year: number): number {
  if (year < 0) {
    // 公元前 1 世纪 = -100..-1
    return -Math.floor((Math.abs(year) - 1) / 100 + 1);
  }
  // 公元 1 世纪 = 1..100
  return Math.floor((year - 1) / 100) + 1;
}

/** 该世纪覆盖的年份范围（闭区间） */
export function centuryRange(c: number): [number, number] {
  if (c < 0) {
    const n = Math.abs(c);
    return [-(n * 100), -((n - 1) * 100 + 1)];
  }
  return [(c - 1) * 100 + 1, c * 100];
}

/* ------------------------------------------------------------------ *
 * 年代分段（移动端时间线的「缩放」降级）
 * ------------------------------------------------------------------ */

export interface EraSegment {
  id: string;
  /** 段内 sig 最高事件的标题前若干字，退化时用年份区间 */
  label: string;
  from: number;
  to: number;
  /** 该段内 sig≥4 的事件数，供模板判断是否需要「展开」按钮 */
  count: number;
}

export interface EraOptions {
  /** 每段的大致条数上限 */
  maxPerSegment?: number;
  /** 总段数上限；超出时放大每段条数 */
  maxSegments?: number;
  /** 只统计达到该重要度的事件 */
  minSignificance?: number;
}

/**
 * 按事件密度把全域切成若干年代段。
 *
 * 为什么不用固定段数：内容量会持续增长，固定 4 段在 88 条事件时
 * 每段已经 14–28 条，一屏滚不完。按密度切能保证每段体量稳定，
 * 同时又不会把 2132 年切成几十段导致年代按钮放不下。
 *
 * 为什么不按世纪聚合再分组：世纪粒度太粗——单个世纪（如三国所在的
 * 3 世纪）就可能有 10 条以上 sig≥4 的事件，按世纪合并必然超限。
 * 这里直接按事件年份序列贪心切分，能精确控制每段条数。
 * 注意这只影响「展示分段」，不影响懒加载分片（那个仍按世纪走）。
 */
export function buildEras(
  items: Array<{ year: number; significance: number; title: string }>,
  domain: [number, number],
  opts: EraOptions = {},
): EraSegment[] {
  const maxPer = opts.maxPerSegment ?? 9;
  const maxSeg = opts.maxSegments ?? 12;
  const minSig = opts.minSignificance ?? 4;

  const [d0, d1] = domain;
  const major = items
    .filter((it) => it.significance >= minSig)
    .sort((a, b) => a.year - b.year);

  // 没有事件时给一个整段兜底，避免模板里 ERAS 为空
  if (major.length === 0) {
    return [{ id: 'era-0', label: `${shortYear(d0)}—${shortYear(d1)}`, from: d0, to: d1, count: 0 }];
  }

  // 段数上限放宽时每段条数同步放大，保证总段数收敛
  const targetPer = Math.max(maxPer, Math.ceil(major.length / maxSeg));

  /**
   * 均摊切分。
   *
   * 不能简单按 targetPer 硬切：85 条 / 每段 9 条 = 9 段余 4 条，
   * 余数会全堆在最后一段（13 条），尾部又变成滑不动的长列表。
   * 这里先算出段数，再把条数尽量平均分配，余数从前往后各加一条。
   */
  const segCount = Math.max(1, Math.ceil(major.length / targetPer));
  const base = Math.floor(major.length / segCount);
  const remainder = major.length % segCount;

  const chunks: Array<typeof major> = [];
  let cursor = 0;
  for (let i = 0; i < segCount; i++) {
    const size = base + (i < remainder ? 1 : 0);
    chunks.push(major.slice(cursor, cursor + size));
    cursor += size;
  }

  return chunks.map((chunk, i) => {
    const from = Math.max(d0, chunk[0].year);
    const to = Math.min(d1, chunk[chunk.length - 1].year);
    // 用段内最重要的那条事件给按钮命名，比年份区间更好认
    const top = [...chunk].sort((a, b) => b.significance - a.significance)[0];
    const label =
      top && top.significance >= 4
        ? top.title.slice(0, 4)
        : `${shortYear(from)}—${shortYear(to)}`;
    return { id: `era-${i}`, label, from, to, count: chunk.length };
  });
}
