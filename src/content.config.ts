/**
 * 内容集合 schema。
 *
 * 四个集合：polities（政权）/ people（人物）/ events（事件）/ sources（史料）。
 * 时间与关系字段复用 lib/time.ts 与 lib/relations.ts 的定义，避免两处漂移。
 */
import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { HDate, HRange } from './lib/time';
import { RELATION_TYPES } from './lib/relations';

/* ------------------------------------------------------------------ *
 * 政权
 * ------------------------------------------------------------------ */

export const POLITY_PERIODS = [
  'pre-imperial',
  'imperial-early',
  'imperial-mid',
  'imperial-late',
] as const;

const polities = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/polities' }),
  schema: z.object({
    /** 永久 id，与文件名一致 */
    id: z.string(),
    name: z.string(),
    /** 别名：朝代名、国号、史书称谓 */
    aliases: z.array(z.string()).default([]),
    /** 存续区间 */
    span: HRange,
    /** 排序权重，越小越靠前（用于时间线泳道顺序） */
    order: z.number().int().default(100),
    /**
     * 时期分组。时间线泳道按 period 分行：同一时期并存的政权占独立行，
     * 不同时期的政权复用行号。这样政权数超过 8 个也不会把画布撑得无限高。
     * 缺省按下限兜底，避免旧数据构建失败。
     */
    period: z.enum(POLITY_PERIODS).default('imperial-early'),
    /** 一句话说明 */
    note: z.string().optional(),
    /** 与哪些政权并存过 */
    coexistedWith: z.array(z.string()).default([]),
  }),
});

/* ------------------------------------------------------------------ *
 * 人物
 * ------------------------------------------------------------------ */

const people = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/people' }),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    /** 字、号、谥号、庙号、俗称。检索必须命中别名 */
    aliases: z.array(z.string()).default([]),
    birth: HDate.optional(),
    death: HDate.optional(),
    /** 所属政权 */
    polityIds: z.array(reference('polities')).default([]),
    /** 身份：皇帝 / 丞相 / 将领 / 文学家 … */
    roles: z.array(z.string()).default([]),
    /** 身份卡印章文字，通常姓名两字，如「诸葛\n孔明」 */
    seal: z.string().optional(),
    /** 一句话概述，用于列表与卡片 */
    summary: z.string(),
    /**
     * 带出处的评价。人物的「评价 / 影响 / 争议」必须落在这里，
     * 不允许在正文里写无出处的现代评语。
     *
     * 为什么单独成表而不写在正文：
     * 正文是叙述，评价是论断。论断必须能溯源到具体史料，
     * 否则就退化成「后世普遍认为」这类无法核实的表述。
     */
    evaluations: z
      .array(
        z.object({
          /** 评价内容（白话） */
          claim: z.string(),
          /** 出处，必填 */
          sourceId: reference('sources'),
          /** 该书的原始措辞 */
          quote: z.string().optional(),
          /** 评价的性质 */
          kind: z.enum(['evaluation', 'influence', 'dispute']).default('evaluation'),
        }),
      )
      .default([]),
    /** 人物关系。目标必须在 people 集合中存在，构建期校验。 */
    relations: z
      .array(
        z.object({
          target: reference('people'),
          type: z.enum(RELATION_TYPES),
          strength: z.enum(['primary', 'weak']).default('primary'),
          from: z.number().int().optional(),
          to: z.number().int().optional(),
          note: z.string().optional(),
          sourceId: reference('sources').optional(),
        }),
      )
      .default([]),
    /** 争议标记：史料有异说时单列，不与正文混排 */
    disputed: z.boolean().default(false),
  }),
});

/* ------------------------------------------------------------------ *
 * 事件
 * ------------------------------------------------------------------ */

export const EVENT_CATEGORIES = [
  'political',
  'military',
  'institution',
  'culture',
  'science',
  'disaster',
] as const;

const events = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/events' }),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    aliases: z.array(z.string()).default([]),
    time: HRange,
    polityIds: z.array(reference('polities')).default([]),
    placeIds: z.array(z.string()).default([]),
    categories: z.array(z.enum(EVENT_CATEGORIES)).min(1),
    /** 参与者。role 区分主导者与被动卷入者，影响图谱叙述方向。
     *  允许为空：灾异、制度变革、科技发明等事件未必有可考的具体人物。 */
    participants: z
      .array(
        z.object({
          personId: reference('people'),
          role: z.enum(['leader', 'participant', 'victim']).default('participant'),
        }),
      )
      .default([]),
    /** 1-5，时间线 LOD 的唯一依据，也是正文字数要求的依据 */
    significance: z.number().int().min(1).max(5),
    summary: z.string(),
    /** 史料出处。至少 1 条；跨书互证见 corroboration */
    sources: z.array(reference('sources')).default([]),
    /**
     * 跨书互证。**新内容必须填**，老数据暂用 default 兼容，
     * 由 scripts/validate-content.ts 逐步收紧。
     *
     * 为什么单独一张表而不复用 sources：
     * sources 是「所有引到的书」，corroboration 是「哪些书互相印证了同一件事」。
     * 同一个事件可能引了三本书，但只有两本真正描述了同一细节。
     */
    corroboration: z
      .object({
        /** 主史料：叙述以此为骨架 */
        primary: reference('sources'),
        /** 旁证：至少 1 条，且书目必须与 primary 不同 */
        secondary: z.array(reference('sources')).min(1),
        /** 各源是否一致 */
        agreement: z.enum(['consistent', 'partial', 'conflicting']),
        /** 一句话说明印证了什么 / 差在哪 */
        note: z.string().optional(),
      })
      .optional(),
    /**
     * 争议点。agreement 为 conflicting 时必须有内容。
     *
     * statement 里可用 {} 包裹差异片段，渲染时高亮。
     * 例：`statement: 船步兵{数十万}`
     */
    disputes: z
      .array(
        z.object({
          /** 争议的是什么，如「曹军兵力」 */
          claim: z.string(),
          views: z
            .array(
              z.object({
                sourceId: reference('sources'),
                /** 该书的说法 */
                statement: z.string(),
              }),
            )
            .min(2),
        }),
      )
      .default([]),
    /** 史实确定性 */
    certainty: z.enum(['confirmed', 'disputed']).default('confirmed'),
  }),
});

/* ------------------------------------------------------------------ *
 * 史料
 * ------------------------------------------------------------------ */

const sources = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/sources' }),
  schema: z.object({
    id: z.string(),
    /** 书名 */
    title: z.string(),
    /** 卷次，如「卷二一七」 */
    volume: z.string().optional(),
    /** 作者 */
    author: z.string().optional(),
    /** 成书年代 */
    composed: z.string().optional(),
    /** 原文引文 */
    quote: z.string().optional(),
    /** 备注：版本、异文等 */
    note: z.string().optional(),
  }),
});

export const collections = { polities, people, events, sources };
