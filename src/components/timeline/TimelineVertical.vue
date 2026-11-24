<script setup lang="ts">
/**
 * 时间线：手机形态（纵向事件流）。
 *
 * 为什么不用横向泳道：375px 宽下多政权并行会挤成一条线，
 * 横向滚动又与浏览器返回手势冲突。这里改为按年纵向排列，
 * 缩放降级为「年代选择器」。
 *
 * 分页：不一次渲染全部事件，按年代分段，符合移动端首屏预算。
 */
import { computed, ref } from 'vue';
import { buildEras, shortYear } from '../../lib/time';
import { eventHref } from '../../lib/nav';
import type { TimelineData, TimelineItem } from '../../lib/content';

interface Props {
  data: TimelineData;
  /**
   * 首屏是否已带 summary。
   *
   * 首页为了控制体积，传的是**去掉 summary** 的精简数据（summary 占 props 的 25%）。
   * 这种情况下组件在展开某条事件时，按世纪从 /data/timeline/<c>.json 现取。
   * timeline 页数据量小，直接传全量、置 true 即可。
   */
  hasSummary?: boolean;
}

const props = withDefaults(defineProps<Props>(), { hasSummary: true });

/**
 * 年代分段：交给 lib/time 的 buildEras。
 *
 * 旧实现是固定 4 等分，内容涨到 88 条事件后每段 14–28 条，
 * 一屏滚不完。buildEras 按「世纪 + 事件密度」切，
 * 保证每段 5–10 条 sig≥4 的事件，且总段数受 maxSegments 约束，
 * 年代按钮始终能横向排下。
 */
const ERAS = computed(() => buildEras(props.data.items, props.data.domain));

const era = ref<string>(ERAS.value[0]?.id ?? 'era-0');

const range = computed(
  () => ERAS.value.find((e) => e.id === era.value) ?? ERAS.value[0],
);

/** 默认只显示重大事件，其余折叠——移动端首屏不为次要事件付成本 */
const expanded = ref(false);

/**
 * 政权筛选。只列「当前年代段内有事件」的政权，避免出现点了没反应的按钮。
 */
const activeLane = ref<string | null>(null);

const visible = computed<TimelineItem[]>(() => {
  if (!range.value) return [];
  const lane = activeLane.value;
  return props.data.items
    .filter((it) => {
      if (it.year < range.value.from || it.year > range.value.to) return false;
      // 政权筛选：与桌面端 TimelineCanvas 的 activeLaneId 语义一致
      if (lane && it.laneId !== lane) return false;
      return true;
    })
    .sort((a, b) => a.year - b.year);
});

const eraLanes = computed(() => {
  if (!range.value) return [];
  const ids = new Set(
    props.data.items
      .filter((it) => it.year >= range.value.from && it.year <= range.value.to)
      .map((it) => it.laneId),
  );
  return props.data.lanes.filter((l) => ids.has(l.id));
});

function selectLane(id: string | null) {
  activeLane.value = activeLane.value === id ? null : id;
  expanded.value = false;
}

const laneLabel = (id: string) =>
  props.data.lanes.find((l) => l.id === id)?.label ?? id;
const shown = computed(() =>
  expanded.value ? visible.value : visible.value.filter((it) => it.significance >= 4),
);
const hiddenCount = computed(() => visible.value.length - shown.value.length);

const open = ref<string | null>(null);

/**
 * 按需补 summary。
 *
 * 首页传的是精简数据（不含 summary），展开某条时才去分片里取那一世纪的数据，
 * 命中后写进 summaryCache，避免重复请求。
 * timeline 页 hasSummary=true，直接读 it.summary，这里不会被调用。
 */
const summaryCache = ref<Record<string, string>>({});
const loadingSummary = ref<string | null>(null);

function centuryOf(year: number): number {
  // 与 scripts/build-timeline 的分片口径一致：公元前用负数向下取整
  return year < 0 ? Math.floor((year + 1) / 100) - 1 : Math.floor(year / 100);
}

async function ensureSummary(it: TimelineItem) {
  if (props.hasSummary || it.summary || summaryCache.value[it.id]) return;

  const c = centuryOf(it.year);
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  loadingSummary.value = it.id;
  try {
    const res = await fetch(`${base}/data/timeline/${c}.json`);
    if (!res.ok) return;
    const json = (await res.json()) as { items: TimelineItem[] };
    const next = { ...summaryCache.value };
    for (const x of json.items) next[x.id] = x.summary;
    summaryCache.value = next;
  } catch {
    // 网络失败时静默降级：详情区只显示年份，不显示摘要
  } finally {
    loadingSummary.value = null;
  }
}

/** 展开/收起某条；展开时按需补 summary */
function toggleItem(it: TimelineItem) {
  const willOpen = open.value !== it.id;
  open.value = willOpen ? it.id : null;
  if (willOpen) void ensureSummary(it);
}

const summaryOf = (it: TimelineItem) => it.summary || summaryCache.value[it.id] || '';

const catLabel = (c: string) => props.data.categoryLabels[c] ?? c;
</script>

<template>
  <div class="tlv">
    <!-- 年代选择器：手机上的「缩放」 -->
    <div class="tlv__eras" role="tablist" aria-label="选择年代">
      <button
        v-for="opt in ERAS"
        :key="opt.id"
        type="button"
        role="tab"
        class="tlv__era"
        :aria-selected="era === opt.id"
        @click="era = opt.id; expanded = false"
      >
        {{ opt.label }}
      </button>
    </div>

    <!--
      政权筛选：只列当前年代段内有事件的政权。
      与桌面端 TimelineExplorer 的筛选条语义一致（点第二次取消）。
    -->
    <div v-if="eraLanes.length > 1" class="tlv__lanes" role="group" aria-label="按政权筛选">
      <button
        v-for="l in eraLanes"
        :key="l.id"
        type="button"
        class="tlv__lane"
        :class="{ 'tlv__lane--active': activeLane === l.id }"
        :aria-pressed="activeLane === l.id"
        @click="selectLane(l.id)"
      >
        <span class="tlv__lane-bar" :style="{ background: `var(--color-lane-${l.laneIndex})` }" />
        {{ l.label }}
      </button>
    </div>

    <ol class="tlv__list">
      <li v-for="it in shown" :key="it.id" class="tlv__item">
        <button
          type="button"
          class="tlv__row"
          :class="{ 'tlv__row--major': it.significance === 5 }"
          :aria-expanded="open === it.id"
          @click="toggleItem(it)"
        >
          <span class="tlv__year num">{{ shortYear(it.year) }}</span>
          <span class="tlv__dot" :class="{ 'tlv__dot--major': it.significance === 5 }"></span>
          <span class="tlv__main">
            <span class="tlv__title">{{ it.title }}</span>
            <span class="tlv__meta u-ui">
              {{ laneLabel(it.laneId) }} · {{ it.categories.map(catLabel).join('、') }}
            </span>
          </span>
        </button>

        <div v-if="open === it.id" class="tlv__detail">
          <p v-if="summaryOf(it)">{{ summaryOf(it) }}</p>
          <p v-else-if="loadingSummary === it.id" class="tlv__detail-loading u-ui">载入中…</p>
          <p class="tlv__detail-meta u-ui num">
            {{ it.year < 0 ? `公元前 ${-it.year} 年` : `公元 ${it.year} 年` }}
            <template v-if="it.endYear !== it.year">
              — {{ it.endYear < 0 ? `公元前 ${-it.endYear} 年` : `公元 ${it.endYear} 年` }}
            </template>
          </p>
          <a class="tlv__more-link u-ui" :href="eventHref(it.id)">查看事件详情 →</a>
        </div>
      </li>
    </ol>

    <p v-if="shown.length === 0" class="tlv__empty u-ui">此年代段暂无事件。</p>

    <button
      v-if="hiddenCount > 0 || expanded"
      type="button"
      class="btn btn--ghost btn--sm tlv__expand"
      @click="expanded = !expanded"
    >
      {{ expanded ? '收起次要事件' : `展开其余 ${hiddenCount} 条事件` }}
    </button>
  </div>
</template>

<style scoped>
.tlv {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

.tlv__eras {
  display: flex;
  gap: var(--sp-1);
  padding: 3px;
  background: var(--color-paper-alt);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  overflow-x: auto;
  scrollbar-width: none;
}

.tlv__eras::-webkit-scrollbar {
  display: none;
}

/* 政权 chips：与年代选择器视觉区分——用方角，不用药丸 */
.tlv__lanes {
  display: flex;
  gap: var(--sp-2);
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 2px;
}

.tlv__lanes::-webkit-scrollbar {
  display: none;
}

.tlv__lane {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  padding: var(--sp-1) var(--sp-3);
  /* 2rem = 32px，触控最小高度；令牌里没有 32px 档，按规范用 px */
  min-height: 32px;
  font-family: var(--font-ui);
  font-size: var(--fs-2xs);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-raised);
  color: var(--color-ink-muted);
  white-space: nowrap;
}

.tlv__lane--active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-ink-inverse);
}

.tlv__lane-bar {
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 1px;
  flex: none;
}

.tlv__era {
  flex: none;
  font-family: var(--font-ui);
  font-size: var(--fs-xs);
  padding: 7px 14px;
  min-height: 2rem;
  border-radius: var(--radius-full);
  color: var(--color-ink-muted);
  white-space: nowrap;
}

.tlv__era[aria-selected='true'] {
  background: var(--color-accent);
  color: var(--color-ink-inverse);
}

.tlv__list {
  display: flex;
  flex-direction: column;
}

.tlv__item {
  border-bottom: 1px solid var(--color-border);
}

.tlv__item:last-child {
  border-bottom: 0;
}

.tlv__row {
  display: grid;
  grid-template-columns: 2.75rem 0.5rem minmax(0, 1fr);
  align-items: center;
  gap: var(--sp-3);
  width: 100%;
  min-height: var(--touch-target);
  padding-block: var(--sp-3);
  text-align: left;
}

.tlv__year {
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
  color: var(--color-ink-muted);
  text-align: right;
}

.tlv__row--major .tlv__year {
  color: var(--color-accent);
}

.tlv__dot {
  width: 0.4375rem;
  height: 0.4375rem;
  border-radius: var(--radius-full);
  background: var(--color-timeline-point);
  justify-self: center;
}

.tlv__dot--major {
  width: 0.625rem;
  height: 0.625rem;
  background: var(--color-timeline-point-active);
}

.tlv__main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.tlv__title {
  font-size: var(--fs-base);
  font-weight: var(--fw-medium);
  color: var(--color-ink-strong);
  line-height: var(--lh-snug);
}

.tlv__row--major .tlv__title {
  font-weight: var(--fw-semibold);
}

.tlv__meta {
  font-size: var(--fs-2xs);
  color: var(--color-ink-faint);
  letter-spacing: var(--ls-wide);
}

.tlv__detail {
  padding: 0 0 var(--sp-4) calc(var(--sp-10) + var(--sp-1) + var(--sp-3) * 2 + var(--sp-2));
  font-size: var(--fs-sm);
  color: var(--color-ink-muted);
  line-height: var(--lh-normal);
}

.tlv__detail-meta {
  margin-top: var(--sp-2);
  font-size: var(--fs-2xs);
  color: var(--color-ink-faint);
}

/* 摘要按需现取时的占位，避免展开后高度从 0 跳变 */
.tlv__detail-loading {
  margin: 0;
  color: var(--color-ink-faint);
  font-size: var(--fs-xs);
}

.tlv__more-link {
  display: inline-block;
  margin-top: var(--sp-2);
  font-size: var(--fs-xs);
  color: var(--color-link);
}

.tlv__empty {
  font-size: var(--fs-xs);
  color: var(--color-ink-faint);
}

.tlv__expand {
  align-self: flex-start;
}
</style>
