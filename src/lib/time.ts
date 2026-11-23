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
