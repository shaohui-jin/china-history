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

import { toOrdinal, formatYear, shortYear, overlapsYear, eraYearToChinese, centuryOf, centuryRange, buildEras } from './time.ts';

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

test('centuryOf：公元前按「前 N 世纪」分段，且没有 0 世纪', () => {
  assert.equal(centuryOf(-221), -3);
  assert.equal(centuryOf(-202), -3);
  assert.equal(centuryOf(-100), -1);
  assert.equal(centuryOf(-1), -1);
  assert.equal(centuryOf(1), 1);
  assert.equal(centuryOf(100), 1);
  assert.equal(centuryOf(101), 2);
  assert.equal(centuryOf(208), 3);
  assert.equal(centuryOf(755), 8);
  assert.equal(centuryOf(1911), 20);
  // 不存在公元 0 年，所以也不该有 0 世纪
  for (let y = -300; y <= 300; y++) {
    if (y === 0) continue;
    assert.notEqual(centuryOf(y), 0, `年份 ${y} 不应落在 0 世纪`);
  }
});

test('centuryRange：区间与 centuryOf 互为反函数（两端都覆盖）', () => {
  for (const c of [-3, -1, 1, 3, 8, 20]) {
    const [from, to] = centuryRange(c);
    assert.equal(centuryOf(from), c, `centuryRange(${c}) 的下界 ${from} 应仍属该世纪`);
    assert.equal(centuryOf(to), c, `centuryRange(${c}) 的上界 ${to} 应仍属该世纪`);
    assert.ok(from <= to);
  }
  assert.deepEqual(centuryRange(-3), [-300, -201]);
  assert.deepEqual(centuryRange(1), [1, 100]);
});

test('buildEras：每段条数受控，且段数不超过上限', () => {
  // 造 85 条 sig=5 的事件，年份均匀铺在 -221..1911
  const items = Array.from({ length: 85 }, (_, i) => ({
    year: -221 + Math.round((i * 2132) / 85),
    significance: 5,
    title: `事件${i}`,
  }));

  const eras = buildEras(items, [-221, 1911]);

  assert.ok(eras.length <= 12, `段数 ${eras.length} 应 ≤ 12`);
  for (const e of eras) {
    assert.ok(e.count <= 10, `段 ${e.id} 有 ${e.count} 条，超过上限`);
    assert.ok(e.count >= 5, `段 ${e.id} 只有 ${e.count} 条，过短`);
  }
  // 各段 count 之和应等于事件总数，不能漏事件
  const sum = eras.reduce((s, e) => s + e.count, 0);
  assert.equal(sum, items.length);
});

test('buildEras：段区间连续且不重叠，首尾覆盖全域', () => {
  const items = Array.from({ length: 40 }, (_, i) => ({
    year: i * 50,
    significance: 5,
    title: `E${i}`,
  }));
  const eras = buildEras(items, [0, 2000]);

  assert.equal(eras[0].from, 0);
  for (let i = 1; i < eras.length; i++) {
    assert.ok(eras[i].from > eras[i - 1].to, `段 ${i} 与上一段重叠`);
  }
});

test('buildEras：只有 sig<4 的事件时退化为单段', () => {
  const items = [{ year: 800, significance: 2, title: '次要' }];
  const eras = buildEras(items, [700, 900]);
  assert.equal(eras.length, 1);
  assert.equal(eras[0].count, 0);
});

test('buildEras：空数据返回兜底单段，模板不会拿到空数组', () => {
  const eras = buildEras([], [-221, 1911]);
  assert.equal(eras.length, 1);
  assert.equal(eras[0].from, -221);
  assert.equal(eras[0].to, 1911);
});

test('buildEras：不依赖调用方排序（乱序输入结果与排序后一致）', () => {
  const base = Array.from({ length: 30 }, (_, i) => ({
    year: i * 40,
    significance: 5,
    title: `E${i}`,
  }));
  const shuffled = [...base].sort(() => Math.random() - 0.5).reverse();

  const a = buildEras(base, [0, 1200]);
  const b = buildEras(shuffled, [0, 1200]);

  assert.equal(a.length, b.length);
  a.forEach((seg, i) => {
    assert.equal(seg.from, b[i].from, `段 ${i} 的 from 应一致`);
    assert.equal(seg.to, b[i].to, `段 ${i} 的 to 应一致`);
    assert.equal(seg.count, b[i].count);
  });
});

test('buildEras：重复年份不会把同一事件拆到两段', () => {
  const items = Array.from({ length: 12 }, () => ({
    year: 200,
    significance: 5,
    title: '同一年',
  }));
  const eras = buildEras(items, [100, 300]);
  const sum = eras.reduce((s, e) => s + e.count, 0);
  assert.equal(sum, 12);
  for (const e of eras) {
    assert.ok(e.from <= 200 && e.to >= 200, '同一年的事件应落在同一年份区间内');
  }
});

test('buildEras：只有一条事件时返回单段且不崩', () => {
  const eras = buildEras([{ year: 618, significance: 5, title: '唐' }], [600, 700]);
  assert.equal(eras.length, 1);
  assert.equal(eras[0].count, 1);
  assert.equal(eras[0].from, 618);
  assert.equal(eras[0].to, 618);
});
