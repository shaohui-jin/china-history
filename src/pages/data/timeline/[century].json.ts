/**
 * 时间线事件数据端点：按世纪分片。
 *
 * 为什么分片：时间线页把整个 TimelineData 作为 props 注入组件，
 * 内容涨到数百条后，首屏 HTML 会明显变重。
 * 这里按世纪切成独立 JSON，客户端按当前可视窗口按需拉取。
 *
 * 泳道（lanes）与全域（domain）不参与分片——它们很小，
 * 且绘制坐标系必须一开始就有，否则无法定位。
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { loadIndex } from '../../../lib/content';

/**
 * 世纪的划分方式：
 * 公元前的年份按「前 N 世纪」分段，避免负数取整的歧义。
 */
function centuryOf(year: number): number {
  // 例：-221 → -3（前3世纪）；208 → 3；755 → 8
  if (year < 0) {
    // 公元前 1 世纪 = -100..-1
    return -Math.floor((Math.abs(year) - 1) / 100 + 1);
  }
  // 公元 1 世纪 = 1..100
  return Math.floor((year - 1) / 100) + 1;
}

/** 该世纪覆盖的年份范围（闭区间） */
function centuryRange(c: number): [number, number] {
  if (c < 0) {
    const n = Math.abs(c);
    return [-(n * 100), -((n - 1) * 100 + 1)];
  }
  return [(c - 1) * 100 + 1, c * 100];
}

/** 所有有事件的世纪 */
export const getStaticPaths: GetStaticPaths = async () => {
  const index = await loadIndex();
  const centuries = new Set<number>();
  for (const e of index.events) {
    centuries.add(centuryOf(e.data.time.from.year));
    if (e.data.time.to) centuries.add(centuryOf(e.data.time.to.year));
  }
  return [...centuries].map((c) => ({ params: { century: String(c) } }));
};

export const GET: APIRoute = async ({ params }) => {
  const raw = params.century;
  const c = Number(raw);
  if (!Number.isInteger(c) || c === 0) {
    return new Response('invalid century', { status: 400 });
  }

  const index = await loadIndex();
  const [from, to] = centuryRange(c);

  // 与世纪区间求交（跨世纪事件会同时出现在多个世纪里）
  const items = index.events
    .filter((e) => {
      const s = e.data.time.from.year;
      const t = e.data.time.to?.year ?? s;
      return t >= from && s <= to;
    })
    .sort((a, b) => a.data.time.from.year - b.data.time.from.year)
    .map((e) => ({
      id: e.data.id,
      year: e.data.time.from.year,
      endYear: e.data.time.to?.year ?? e.data.time.from.year,
      title: e.data.title,
      laneId: e.data.polityIds[0]?.id ?? 'other',
      categories: e.data.categories,
      significance: e.data.significance,
      summary: e.data.summary,
    }));

  return new Response(
    JSON.stringify({ century: c, from, to, items }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    },
  );
};
