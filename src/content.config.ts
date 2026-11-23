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
    /** 1-5，时间线 LOD 的唯一依据 */
    significance: z.number().int().min(1).max(5),
    summary: z.string(),
    /** 史料出处 */
    sources: z.array(reference('sources')).default([]),
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
