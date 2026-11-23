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
import { relationMeta, type RelationStrength, type RelationType } from './relations';

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
  /** 人物 → 关系中涉及的其他人物 id */
  personNeighbors: Map<string, string[]>;
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

  const personNeighbors = new Map<string, string[]>();
  for (const p of people.values()) {
    personNeighbors.set(
      p.data.id,
      p.data.relations.map((r) => r.target.id),
    );
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

  // BFS 扩展
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      const person = index.people.get(id);
      if (!person) continue;
      for (const rel of person.data.relations) {
        const target = rel.target.id;
        if (!index.people.has(target) || nodeIds.has(target)) continue;
        if (nodeIds.size >= maxNodes) break;
        nodeIds.add(target);
        next.push(target);
      }
    }
    if (nodeIds.size >= maxNodes) break;
    frontier = next;
  }

  const truncated = nodeIds.size >= maxNodes ? 1 : 0;

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

  return { nodes, edges, truncated };
}

/* ------------------------------------------------------------------ *
 * 时间线索引
 * ------------------------------------------------------------------ */

export interface TimelineLane {
  id: string;
  label: string;
  start: number;
  end: number;
  /** 泳道序号，1-8，对应 --color-lane-N */
  laneIndex: number;
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

/** 构建时间线索引：泳道按政权起止年，事件挂到其政权上 */
export async function getTimelineData(): Promise<TimelineData> {
  const index = await loadIndex();

  const polities = [...index.polities.values()].sort(
    (a, b) => a.data.order - b.data.order,
  );

  const lanes: TimelineLane[] = polities.map((p, i) => ({
    id: p.data.id,
    label: p.data.name,
    start: p.data.span.from.year,
    end: p.data.span.to?.year ?? p.data.span.from.year,
    laneIndex: (i % 8) + 1,
  }));

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

  // 全域：所有泳道与事件的并集，留 5% 余量
  const years = [
    ...lanes.flatMap((l) => [l.start, l.end]),
    ...items.flatMap((i) => [i.year, i.endYear]),
  ];
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
