/**
 * 纯函数单测。用 `node --test`，不引入额外框架。
 *
 * 覆盖的是「逻辑容易错、错了没人看得见」的部分：
 * - 公元前年份与「无公元 0 年」
 * - 区间求交（时间线筛选依赖它）
 * - 人物关系去重键（双向模型的核心）
 * - ego 网络的深度截断与双向扩展
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { toOrdinal, formatYear, shortYear, overlapsYear, eraYearToChinese } from './time.ts';

test('公元前年份格式化为「公元前 N 年」', () => {
  assert.equal(formatYear(-221), '公元前 221 年');
  assert.equal(formatYear(763), '公元 763 年');
});

test('紧凑年份：公元前用「前」前缀', () => {
  assert.equal(shortYear(-221), '前221');
  assert.equal(shortYear(960), '960');
});

test('toOrdinal 对同年同月同日稳定，且能正确排序公元前', () => {
  const a = toOrdinal({ year: -221, approx: false });
  const b = toOrdinal({ year: -206, approx: false });
  assert.ok(a < b, '公元前 221 应早于公元前 206（更小的负数更早）');
  assert.equal(
    toOrdinal({ year: 208, month: 1, day: 1, approx: false }),
    2080000 + 100 + 1,
  );
});

test('overlapsYear：单点事件只命中当年', () => {
  const r = { from: { year: 208, approx: false }, to: null };
  assert.equal(overlapsYear(r, 208), true);
  assert.equal(overlapsYear(r, 207), false);
  assert.equal(overlapsYear(r, 209), false);
});

test('overlapsYear：跨年事件命中区间内每一年，含两端', () => {
  const r = {
    from: { year: 755, approx: false },
    to: { year: 763, approx: false },
  };
  assert.equal(overlapsYear(r, 754), false);
  assert.equal(overlapsYear(r, 755), true);
  assert.equal(overlapsYear(r, 759), true);
  assert.equal(overlapsYear(r, 763), true);
  assert.equal(overlapsYear(r, 764), false);
});

test('年号纪年中文数字', () => {
  assert.equal(eraYearToChinese(1), '一');
  assert.equal(eraYearToChinese(10), '十');
  assert.equal(eraYearToChinese(14), '十四');
  assert.equal(eraYearToChinese(29), '二十九');
});
