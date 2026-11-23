/**
 * 人物关系枚举与展示元数据。
 *
 * 为什么用封闭枚举：开放字符串半年后一定烂（同一关系会出现"君臣""臣属""上下级"三种写法）。
 * 封闭集合是图谱可读性的前提——每种关系对应固定的颜色与线型，用户能靠视觉直接识别。
 */

export const RELATION_TYPES = [
  // 血缘与婚姻
  'parent-child',
  'sibling',
  'spouse',
  'kinship',
  // 权力
  'ruler-subject',
  'superior',
  // 学术与传承
  'teacher-student',
  'recommend',
  // 同盟与敌对
  'ally',
  'enemy',
  'kill',
  // 同侪
  'colleague',
] as const;

export type RelationType = (typeof RELATION_TYPES)[number];

/** 关系的展示元数据。颜色引用语义令牌，不写裸色值。 */
export interface RelationMeta {
  /** 中文标签 */
  label: string;
  /** 是否血缘/婚姻类（血缘线通常画得更实） */
  family: boolean;
  /** 对称关系：A 对 B 成立时 B 对 A 也成立 */
  symmetric: boolean;
  /** 边的语义令牌名，供 canvas / cytoscape 取色 */
  colorKey:
    | 'color-cat-political'
    | 'color-cat-military'
    | 'color-cat-institution'
    | 'color-cat-culture'
    | 'color-cat-science'
    | 'color-cat-disaster'
    | 'color-accent'
    | 'color-graph-edge-strong';
  /** 线型 */
  lineStyle: 'solid' | 'dashed' | 'dotted';
}

export const relationMeta: Record<RelationType, RelationMeta> = {
  'parent-child': {
    label: '父子',
    family: true,
    symmetric: false,
    colorKey: 'color-cat-institution',
    lineStyle: 'solid',
  },
  sibling: {
    label: '兄弟',
    family: true,
    symmetric: true,
    colorKey: 'color-cat-institution',
    lineStyle: 'solid',
  },
  spouse: {
    label: '婚姻',
    family: true,
    symmetric: true,
    colorKey: 'color-cat-culture',
    lineStyle: 'solid',
  },
  kinship: {
    label: '宗族',
    family: true,
    symmetric: true,
    colorKey: 'color-cat-institution',
    lineStyle: 'dashed',
  },
  'ruler-subject': {
    label: '君臣',
    family: false,
    symmetric: false,
    colorKey: 'color-cat-political',
    lineStyle: 'solid',
  },
  superior: {
    label: '统属',
    family: false,
    symmetric: false,
    colorKey: 'color-cat-political',
    lineStyle: 'dashed',
  },
  'teacher-student': {
    label: '师承',
    family: false,
    symmetric: false,
    colorKey: 'color-cat-culture',
    lineStyle: 'solid',
  },
  recommend: {
    label: '举荐',
    family: false,
    symmetric: false,
    colorKey: 'color-cat-culture',
    lineStyle: 'dotted',
  },
  ally: {
    label: '同盟',
    family: false,
    symmetric: true,
    colorKey: 'color-cat-science',
    lineStyle: 'solid',
  },
  enemy: {
    label: '敌对',
    family: false,
    symmetric: true,
    colorKey: 'color-cat-military',
    lineStyle: 'dashed',
  },
  kill: {
    label: '诛杀',
    family: false,
    symmetric: false,
    colorKey: 'color-cat-disaster',
    lineStyle: 'solid',
  },
  colleague: {
    label: '同僚',
    family: false,
    symmetric: true,
    colorKey: 'color-graph-edge-strong',
    lineStyle: 'dotted',
  },
};

/** 关系强度：primary 默认显示，weak 默认折叠 */
export type RelationStrength = 'primary' | 'weak';

/** 关系的时间有效性：盟友会变成死敌，所以关系本身有时间窗 */
export interface RelationRecord {
  /** 目标人物 id */
  target: string;
  type: RelationType;
  strength: RelationStrength;
  /** 关系开始年（负数 = 公元前），用于时间滑块 */
  from?: number;
  /** 关系结束年。为空表示未终结（如父子） */
  to?: number;
  /** 备注，如「于白帝城托孤」 */
  note?: string;
  /** 史料出处 id */
  sourceId?: string;
}

/** 关系的中文标签（含方向性说明） */
export function relationLabel(type: RelationType, inverse = false): string {
  const meta = relationMeta[type];
  if (!inverse || meta.symmetric) return meta.label;
  // 有方向的关系，反向叙述时换个说法
  const inverseMap: Partial<Record<RelationType, string>> = {
    'parent-child': '父/母',
    'ruler-subject': '君',
    superior: '上级',
    'teacher-student': '弟子',
    recommend: '被荐',
    kill: '为其所杀',
  };
  return inverseMap[type] ?? meta.label;
}
