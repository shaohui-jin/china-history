/**
 * 内容索引层：把 content collections 编译成视图需要的形状。
 *
 * 职责：
 * - 提供按 id 查询的索引
 * - 计算反向链接（人物 ↔ 事件、人物 ↔ 人物）
 * - 构建期校验：引用完整性、生卒与事件矛盾、必填项
 * - 生成时间线索引与图谱数据
 *
 * 所有函数在 Astro 组件 frontmatter 里调用（服务端/构建期），不进入浏览器。
 */
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import { toOrdinal, overlapsYear, type HRange } from './time';
import { relationMeta, relationLabel, type RelationStrength, type RelationType } from './relations';

export type Person = CollectionEntry<'people'>;
export type Event = CollectionEntry<'events'>;
export type Polity = CollectionEntry<'polities'>;
export type Source = CollectionEntry<'sources'>;

/* ------------------------------------------------------------------ *
 * 基础索引
 * ------------------------------------------------------------------ */

export interface ContentIndex {
  people: Map<string, Person>;
  events: Event[];
  polities: Map<string, Polity>;
  sources: Map<string, Source>;
  /** 人物 → 参与的事件 id 列表 */
  personEvents: Map<string, string[]>;
  /**
   * 人物 → 关系中涉及的其他人物 id（**双向**）。
   *
   * 为什么是双向：关系只需要在**一端**声明。A 的页面里写了「A 辅佐 B」，
   * B 的页面就必须能列出 A，否则用户顺着 B 找不到 A。
   * 所以这里同时记出边与入边，Set 天然去重（两端都声明也只有一个元素）。
   *
   * 阅读层（人物页「相关人物」）与图谱层（getEgoNetwork 的 BFS）共用这一张表，
   * 避免两处各自遍历 relations 而漂移。
   */
  personNeighbors: Map<string, Set<string>>;
}

let cached: ContentIndex | null = null;

/** 取全部内容并建立索引。构建期调用，结果缓存。 */
export async function loadIndex(): Promise<ContentIndex> {
  if (cached) return cached;

  const [peopleEntries, eventEntries, polityEntries, sourceEntries] = await Promise.all([
    getCollection('people'),
    getCollection('events'),
    getCollection('polities'),
    getCollection('sources'),
  ]);

  const people = new Map(peopleEntries.map((p) => [p.data.id, p]));
  const polities = new Map(polityEntries.map((p) => [p.data.id, p]));
  const sources = new Map(sourceEntries.map((s) => [s.data.id, s]));

  // 事件按开始时间排序，时间线直接可用
  const events = [...eventEntries].sort(
    (a, b) => toOrdinal(a.data.time.from) - toOrdinal(b.data.time.from),
  );

  const personEvents = new Map<string, string[]>();
  for (const e of events) {
    for (const p of e.data.participants) {
      const id = p.personId.id;
      const list = personEvents.get(id) ?? [];
      list.push(e.data.id);
      personEvents.set(id, list);
    }
  }

  const personNeighbors = new Map<string, Set<string>>();
  const addNeighbor = (a: string, b: string) => {
    const cur = personNeighbors.get(a);
    if (cur) cur.add(b);
    else personNeighbors.set(a, new Set([b]));
  };
  for (const p of people.values()) {
    for (const r of p.data.relations) {
      // 出边：这一端自己声明的
      addNeighbor(p.data.id, r.target.id);
      // 入边：目标那一端也要能看到，否则「A 辅佐 B」在 B 页上找不到 A
      addNeighbor(r.target.id, p.data.id);
    }
  }

  cached = { people, events, polities, sources, personEvents, personNeighbors };
  return cached;
}

/* ------------------------------------------------------------------ *
 * 单条查询
 * ------------------------------------------------------------------ */

export async function getPerson(id: string): Promise<Person | undefined> {
  const index = await loadIndex();
  return index.people.get(id);
}

export async function getEvent(id: string): Promise<Event | undefined> {
  const index = await loadIndex();
  return index.events.find((e) => e.data.id === id);
}

export async function getPolity(id: string): Promise<Polity | undefined> {
  const index = await loadIndex();
  return index.polities.get(id);
}

/** 人物参与的事件，按时间排序 */
export async function getPersonEvents(personId: string): Promise<Event[]> {
  const index = await loadIndex();
  const ids = new Set(index.personEvents.get(personId) ?? []);
  return index.events.filter((e) => ids.has(e.data.id));
}

/**
 * 与某人物直接相关的全部关系（双向）。
 *
 * 每条边只在**一端**声明。声明方读到的是正向语义（「我辅佐他」），
 * 被提及方读到的是反向语义（「他为我之君」），由 relationLabel(type, inverse)
 * 换措辞。两端都显式声明的同类型关系只输出一次。
 *
 * 返回按「强关系优先 → 名称」排序，便于页面直接渲染。
 */
export interface PersonRelation {
  /** 对方人物 id */
  otherId: string;
  other: Person;
  type: RelationType;
  strength: RelationStrength;
  /** 当前页是否为声明方。false 表示这条边是别人页里写的入边 */
  outgoing: boolean;
  /** 关系描述（已按方向换算措辞） */
  label: string;
  from?: number;
  to?: number;
  note?: string;
}

export async function getPersonRelations(personId: string): Promise<PersonRelation[]> {
  const index = await loadIndex();
  const self = index.people.get(personId);
  if (!self) return [];

  const out: PersonRelation[] = [];
  /** 去重键（无向对 + 类型）→ 是否已收。声明方优先，入边只在无人声明时补 */
  const seen = new Set<string>();

  const keyOf = (a: string, b: string, type: RelationType) =>
    [a, b].sort().join('|') + '::' + type;

  // 1) 自己声明的出边：正向语义
  for (const rel of self.data.relations) {
    const other = index.people.get(rel.target.id);
    if (!other) continue;
    seen.add(keyOf(personId, other.data.id, rel.type));
    out.push({
      otherId: other.data.id,
      other,
      type: rel.type,
      strength: rel.strength,
      outgoing: true,
      label: relationMeta[rel.type].label,
      from: rel.from,
      to: rel.to,
      note: rel.note,
    });
  }

  // 2) 别人声明、指向自己的入边：反向语义（措辞由 relationLabel 换算）
  for (const p of index.people.values()) {
    if (p.data.id === personId) continue;
    for (const rel of p.data.relations) {
      if (rel.target.id !== personId) continue;
      const key = keyOf(personId, p.data.id, rel.type);
      if (seen.has(key)) continue; // 两端都声明了，只留声明方那条
      seen.add(key);
      out.push({
        otherId: p.data.id,
        other: p,
        type: rel.type,
        strength: rel.strength,
        outgoing: false,
        label: relationLabel(rel.type, true),
        from: rel.from,
        to: rel.to,
        note: rel.note,
      });
    }
  }

  return out.sort((a, b) => {
    const sa = a.strength === 'primary' ? 0 : 1;
    const sb = b.strength === 'primary' ? 0 : 1;
    return sa - sb || a.other.data.name.localeCompare(b.other.data.name, 'zh');
  });
}

/** 某事件的参与者（带人物条目） */
export async function getEventParticipants(
  event: Event,
): Promise<Array<{ person: Person; role: string }>> {
  const index = await loadIndex();
  const out: Array<{ person: Person; role: string }> = [];
  for (const p of event.data.participants) {
    const person = index.people.get(p.personId.id);
    if (person) out.push({ person, role: p.role });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 关系图数据
 * ------------------------------------------------------------------ */

export interface GraphNode {
  id: string;
  label: string;
  /** 是否为当前焦点 */
  focus: boolean;
  /** 生卒年，供时间滑块过滤 */
  birthYear?: number;
  deathYear?: number;
  /** 身份，用于节点分组着色 */
  roles: string[];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: RelationType;
  label: string;
  strength: RelationStrength;
  colorKey: string;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  /** 是否有方向（非对称关系画箭头） */
  directed: boolean;
  /**
   * 叙事方向是否与 source→target 相反。
   * 数据里两侧都声明关系时，去重保留的那条可能来自「被统属方」的视角，
   * 此时 source 实际是 target 的下属。渲染时据此决定箭头朝向。
   */
  inverse: boolean;
  /** 关系有效区间，供时间滑块过滤 */
  from?: number;
  to?: number;
  note?: string;
}

export interface EgoNetwork {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** 因超出 maxNodes 而未展开的节点数 */
  truncated: number;
}

/**
 * 抽取以某个/某些人物为中心的 ego 网络。
 *
 * 关键设计：
 * - 关系是**单向声明**的：A 声明 enemy B，图谱在 B 处也要能看到这条边。
 *   所以构图时要把所有人物的关系都扫一遍，取两端都在节点集里的边。
 * - depth 控制跳数，BFS 扩展。
 */
export async function getEgoNetwork(
  focusIds: string[],
  depth = 1,
  maxNodes = 200,
): Promise<EgoNetwork> {
  const index = await loadIndex();

  const nodeIds = new Set<string>(focusIds.filter((id) => index.people.has(id)));
  let frontier = [...nodeIds];
  let truncated = false;

  // BFS 扩展。沿 personNeighbors（双向表）走，这样只在别人页里声明过
  // 的入边也能把节点带进来。
  for (let d = 0; d < depth && !truncated; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      const neighbors = index.personNeighbors.get(id);
      if (!neighbors) continue;
      for (const target of neighbors) {
        if (!index.people.has(target) || nodeIds.has(target)) continue;
        if (nodeIds.size >= maxNodes) {
          // 超出上限：记下「确实还有没进来的」，不要用 size === maxNodes 猜
          truncated = true;
          break;
        }
        nodeIds.add(target);
        next.push(target);
      }
      if (truncated) break;
    }
    frontier = next;
  }

  const nodes: GraphNode[] = [...nodeIds]
    .map((id) => index.people.get(id))
    .filter((p): p is Person => !!p)
    .map((p) => ({
      id: p.data.id,
      label: p.data.name,
      focus: focusIds.includes(p.data.id),
      birthYear: p.data.birth?.year,
      deathYear: p.data.death?.year,
      roles: p.data.roles,
    }));

  // 扫全部人物，收集两端都在节点集里的边（实现双向可见）
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const person of index.people.values()) {
    if (!nodeIds.has(person.data.id)) continue;
    for (const rel of person.data.relations) {
      const target = rel.target.id;
      if (!nodeIds.has(target)) continue;

      const meta = relationMeta[rel.type];

      /**
       * 去重策略：
       * - 对称关系（兄弟/同盟/敌对…）A-B 与 B-A 是同一条
       * - 非对称关系（君臣/父子/统属…）方向有意义，但数据里两侧可能都写了
       *   （因为每个人物页都要能列出与对方的关系）。这里按「无向对」去重，
       *   保留 id 字典序在前的那一条作为规范表示，渲染时由 label + 箭头表达方向。
       */
      const pairKey =
        [person.data.id, target].sort().join('|') + '::' + rel.type;
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      edges.push({
        id: pairKey,
        source: person.data.id,
        target,
        type: rel.type,
        label: meta.label,
        strength: rel.strength,
        colorKey: meta.colorKey,
        lineStyle: meta.lineStyle,
        directed: !meta.symmetric,
        // 去重后保留的这条，方向就是 person → target，与声明一致
        inverse: false,
        from: rel.from,
        to: rel.to,
        note: rel.note,
      });
    }
  }

  return { nodes, edges, truncated: truncated ? 1 : 0 };
}

/* ------------------------------------------------------------------ *
 * 时间线索引
 * ------------------------------------------------------------------ */

export interface TimelineLane {
  id: string;
  label: string;
  start: number;
  end: number;
  /**
   * 色号 1-8，对应 --color-lane-N。
   *
   * 注意：这**不是**行号。颜色由政权 id 稳定哈希得出，保证同一政权
   * 无论内容怎么增删都保持同色，且不同政权撞色概率均摊。
   * （旧实现是 `(i % 8) + 1`，政权超过 8 个后第 9 个会和第 1 个撞色。）
   */
  laneIndex: number;
  /**
   * 真实行号，从 0 开始。**按时间重叠**分配：时间上不重叠的政权
   * 可以共用同一行 —— 画布高度由实际行数决定，与政权数无关。
   */
  rowIndex: number;
  /** 时期分组，用于分行与图例 */
  period: string;
}

export interface TimelineItem {
  id: string;
  year: number;
  endYear: number;
  title: string;
  laneId: string;
  categories: string[];
  significance: number;
  summary: string;
}

export interface TimelineData {
  domain: [number, number];
  lanes: TimelineLane[];
  items: TimelineItem[];
  /** 分类 → 中文标签 */
  categoryLabels: Record<string, string>;
}

/** 泳道配色数量，与 design/tokens.ts 的 --color-lane-1..8 对应 */
const LANE_COLOR_COUNT = 8;

/**
 * 政权 id → 稳定色号（1..8）。
 *
 * 为什么用哈希而不是数组下标：下标会随「新增一个 order 更小的政权」
 * 而整体平移，导致所有政权换色。哈希只取决于 id 本身。
 * FNV-1a 足够离散，且实现只有三行。
 */
function laneColorIndex(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (Math.abs(h) % LANE_COLOR_COUNT) + 1;
}

/** 两个政权的时间区间是否重叠（端点相接也算重叠，否则视觉上贴在一起） */
function spansOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/** 构建时间线索引：泳道按政权起止年，事件挂到其政权上 */
export async function getTimelineData(): Promise<TimelineData> {
  const index = await loadIndex();

  const polities = [...index.polities.values()].sort(
    (a, b) => a.data.order - b.data.order,
  );

  /**
   * 行号分配：**按时间重叠**分道，而不是按数组下标硬排。
   *
   * 旧实现是 `laneIndex = (i % 8) + 1` 且画布用数组下标定位行，
   * 于是有两种浪费：
   * 1. 政权超过 8 个就撞色
   * 2. 时间上完全不重叠的政权（如秦与宋）也各占一行，画布白白变高
   *
   * 现在的规则：
   * - 依次处理政权（按 order），每个政权找**第一条与已占用区间都不重叠**的行
   * - 找不到就新开一行
   * - 颜色由 id 哈希决定，但与「同一行上已有政权」撞色时顺延到下一个色号，
   *   保证同一行（视觉上最容易混淆的位置）不会有同色
   *
   * 这样 12 个政权（时间跨度 -221~1912）通常只需要 3-5 行。
   */
  const rows: Array<Array<{ start: number; end: number; color: number }>> = [];
  const assignments = polities.map((p) => {
    const start = p.data.span.from.year;
    const end = p.data.span.to?.year ?? start;
    const baseColor = laneColorIndex(p.data.id);

    for (let r = 0; r < rows.length; r++) {
      // 该行上已有的政权不能与当前时间重叠
      if (rows[r].some((o) => spansOverlap({ start, end }, o))) continue;
      // 同色顺延，避免同一行出现两支同色
      const used = new Set(rows[r].map((o) => o.color));
      let color = baseColor;
      for (let k = 0; k < LANE_COLOR_COUNT && used.has(color); k++) {
        color = (color % LANE_COLOR_COUNT) + 1;
      }
      rows[r].push({ start, end, color });
      return { id: p.data.id, start, end, rowIndex: r, laneIndex: color, period: p.data.period };
    }

    rows.push([{ start, end, color: baseColor }]);
    return {
      id: p.data.id,
      start,
      end,
      rowIndex: rows.length - 1,
      laneIndex: baseColor,
      period: p.data.period,
    };
  });

  const lanes: TimelineLane[] = assignments.map((a) => {
    const p = index.polities.get(a.id)!;
    return {
      id: a.id,
      label: p.data.name,
      start: a.start,
      end: a.end,
      laneIndex: a.laneIndex,
      rowIndex: a.rowIndex,
      period: a.period,
    };
  });

  const items: TimelineItem[] = index.events.map((e) => ({
    id: e.data.id,
    year: e.data.time.from.year,
    endYear: e.data.time.to?.year ?? e.data.time.from.year,
    title: e.data.title,
    laneId: e.data.polityIds[0]?.id ?? 'other',
    categories: e.data.categories,
    significance: e.data.significance,
    summary: e.data.summary,
  }));

  /**
   * 全域横轴：**只按事件算，不含政权占位**。
   *
   * 为什么不能把政权 span 算进来：政权的 yaml 是时间线的骨架，
   * 宋元明清的占位已经建好（span 到 1912），但还没有任何事件。
   * 若把政权算进来，横轴会拉到 1912，而 763 之后 54% 的区域全是空白 ——
   * 用户看到的是一条右半边空的轴，比不显示更糟。
   *
   * 政权条仍按自身 span 绘制，超出 domain 的部分由画布裁剪（xOf 已 clamp）。
   * 补完宋元明清的事件后，domain 会自动跟着事件往后延。
   */
  const years = items.flatMap((i) => [i.year, i.endYear]).filter(Number.isFinite);
  if (years.length === 0) {
    // 极端兜底：一条事件都没有时，用政权跨度撑住坐标系，否则 Math.min(...[]) 得 Infinity
    const fallback = lanes.flatMap((l) => [l.start, l.end]);
    years.push(...fallback);
  }
  const min = Math.min(...years);
  const max = Math.max(...years);
  const pad = Math.max(10, Math.round((max - min) * 0.05));

  return {
    domain: [min - pad, max + pad],
    lanes,
    items,
    categoryLabels: {
      political: '政治',
      military: '军事',
      institution: '制度',
      culture: '文化',
      science: '科技',
      disaster: '灾异',
    },
  };
}

/** 按年份窗口筛选事件（与区间求交） */
export function filterByWindow<T extends { time: HRange }>(
  entries: T[],
  from: number,
  to: number,
): T[] {
  return entries.filter((e) => {
    const start = e.time.from.year;
    const end = e.time.to?.year ?? start;
    return end >= from && start <= to;
  });
}

/** 按年份查事件（用于手机端按年分页） */
export async function getEventsByYear(year: number): Promise<Event[]> {
  const index = await loadIndex();
  return index.events.filter((e) => overlapsYear(e.data.time, year));
}

/* ------------------------------------------------------------------ *
 * 构建期校验
 * ------------------------------------------------------------------ */

export interface ValidationIssue {
  level: 'error' | 'warn';
  collection: string;
  id: string;
  message: string;
}

/**
 * 引用完整性与常识校验。
 *
 * 由 `astro build` 前的手动脚本或 /admin/validate 页调用。
 * 注意：Zod 已经校验了字段类型与必填，这里只管跨条目的语义。
 */
export async function validateAll(): Promise<ValidationIssue[]> {
  const index = await loadIndex();
  const issues: ValidationIssue[] = [];

  // 1. 人物关系目标存在
  for (const p of index.people.values()) {
    for (const rel of p.data.relations) {
      if (!index.people.has(rel.target.id)) {
        issues.push({
          level: 'error',
          collection: 'people',
          id: p.data.id,
          message: `关系目标不存在：${rel.target.id}`,
        });
      }
    }
  }

  // 2. 事件参与者存在
  for (const e of index.events) {
    for (const part of e.data.participants) {
      if (!index.people.has(part.personId.id)) {
        issues.push({
          level: 'error',
          collection: 'events',
          id: e.data.id,
          message: `参与者不存在：${part.personId.id}`,
        });
      }
    }
    for (const pid of e.data.polityIds) {
      if (!index.polities.has(pid.id)) {
        issues.push({
          level: 'error',
          collection: 'events',
          id: e.data.id,
          message: `政权不存在：${pid.id}`,
        });
      }
    }
  }

  // 3. 生卒顺序
  for (const p of index.people.values()) {
    if (p.data.birth && p.data.death && p.data.birth.year > p.data.death.year) {
      issues.push({
        level: 'error',
        collection: 'people',
        id: p.data.id,
        message: `生年 ${p.data.birth.year} 晚于卒年 ${p.data.death.year}`,
      });
    }
  }

  // 4. 事件时间与参与者生卒矛盾（只警告：史料本就有异说）
  for (const e of index.events) {
    for (const part of e.data.participants) {
      const person = index.people.get(part.personId.id);
      if (!person) continue;
      const born = person.data.birth?.year;
      const died = person.data.death?.year;
      const eventYear = e.data.time.from.year;

      if (born !== undefined && eventYear < born) {
        issues.push({
          level: 'warn',
          collection: 'events',
          id: e.data.id,
          message: `${person.data.name} 生于 ${born}，但事件在 ${eventYear}`,
        });
      }
      if (died !== undefined && eventYear > died) {
        issues.push({
          level: 'warn',
          collection: 'events',
          id: e.data.id,
          message: `${person.data.name} 卒于 ${died}，但事件在 ${eventYear}`,
        });
      }
    }
  }

  // 5. 关系的时间区间自洽
  for (const p of index.people.values()) {
    for (const rel of p.data.relations) {
      if (rel.from !== undefined && rel.to !== undefined && rel.from > rel.to) {
        issues.push({
          level: 'error',
          collection: 'people',
          id: p.data.id,
          message: `关系 ${rel.type} 的起始年 ${rel.from} 晚于结束年 ${rel.to}`,
        });
      }
    }
  }

  return issues;
}
