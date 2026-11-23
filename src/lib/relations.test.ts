/**
 * 关系模型单测。
 *
 * 覆盖两个容易出错、错了不容易被发现的点：
 * 1. 去重键：两端都声明同一条关系时只能保留一条
 * 2. 反向措辞：非对称关系在目标页要换说法
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { relationLabel, relationMeta, RELATION_TYPES, type RelationType } from './relations.ts';

/** 与 content.ts 的 getPersonRelations 保持一致的去重键 */
const pairKey = (a: string, b: string, type: RelationType): string =>
  [a, b].sort().join('|') + '::' + type;

/** 对称关系：A 对 B 成立时 B 对 A 也成立 */
const SYMMETRIC: RelationType[] = ['sibling', 'spouse', 'kinship', 'ally', 'enemy', 'colleague'];

test('去重键与顺序无关：A→B 与 B→A 产生同一个键', () => {
  assert.equal(pairKey('cao-cao', 'zhuge-liang', 'enemy'), pairKey('zhuge-liang', 'cao-cao', 'enemy'));
});

test('去重键含类型：同一对人可以有两条不同类型的关系', () => {
  const a = pairKey('cao-cao', 'zhuge-liang', 'enemy');
  const b = pairKey('cao-cao', 'zhuge-liang', 'ruler-subject');
  assert.notEqual(a, b, '君臣与敌对是两条边，不能互相覆盖');
});

test('对称关系反向措辞不变', () => {
  for (const t of SYMMETRIC) {
    assert.equal(
      relationLabel(t, true),
      relationMeta[t].label,
      `${t} 是对称关系，反向措辞应与正向相同`,
    );
  }
});

test('非对称关系反向措辞不同', () => {
  assert.equal(relationLabel('parent-child', true), '父/母');
  assert.equal(relationLabel('ruler-subject', true), '君');
  assert.equal(relationLabel('superior', true), '上级');
  assert.equal(relationLabel('teacher-student', true), '弟子');
  assert.equal(relationLabel('recommend', true), '被荐');
  assert.equal(relationLabel('kill', true), '为其所杀');
});

test('inverse=false 时一律返回基础标签', () => {
  for (const t of RELATION_TYPES) {
    assert.equal(relationLabel(t, false), relationMeta[t].label);
  }
});

test('每个关系类型都有完整的展示元数据', () => {
  for (const t of RELATION_TYPES) {
    const meta = relationMeta[t];
    assert.ok(meta, `${t} 缺少 relationMeta`);
    assert.ok(meta.label.length > 0, `${t} 缺 label`);
    assert.ok(meta.colorKey.startsWith('color-'), `${t} 的 colorKey 必须是语义令牌`);
    assert.ok(['solid', 'dashed', 'dotted'].includes(meta.lineStyle), `${t} 的 lineStyle 非法`);
  }
});
