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
import { shortYear } from '../../lib/time';
import type { TimelineData, TimelineItem } from '../../lib/content';

interface Props {
  data: TimelineData;
}

const props = defineProps<Props>();

/** 把全域按固定跨度切成若干年代段，手机上单屏只显示一段 */
const ERAS = computed(() => {
  const [d0, d1] = props.data.domain;
  const span = d1 - d0;
  const segments = 4;
  const step = Math.ceil(span / segments);
  const out: Array<{ id: string; label: string; from: number; to: number }> = [];
  for (let i = 0; i < segments; i++) {
    const from = d0 + i * step;
    const to = Math.min(d1, from + step);
    if (from >= d1) break;
    // 用一个代表性的重大事件给分段命名，没有则用年份范围
    const inRange = props.data.items
      .filter((it) => it.year >= from && it.year <= to)
      .sort((a, b) => b.significance - a.significance);
    const label = inRange[0]?.title.slice(0, 4) ?? `${shortYear(from)}—${shortYear(to)}`;
    out.push({ id: `era-${i}`, label, from, to });
  }
  return out;
});

const era = ref<string>(ERAS.value[0]?.id ?? 'era-0');

const range = computed(
  () => ERAS.value.find((e) => e.id === era.value) ?? ERAS.value[0],
);

const visible = computed<TimelineItem[]>(() => {
  if (!range.value) return [];
  return props.data.items
    .filter((it) => it.year >= range.value.from && it.year <= range.value.to)
    .sort((a, b) => a.year - b.year);
});

const laneLabel = (id: string) =>
  props.data.lanes.find((l) => l.id === id)?.label ?? id;

/** 默认只显示重大事件，其余折叠——移动端首屏不为次要事件付成本 */
const expanded = ref(false);
const shown = computed(() =>
  expanded.value ? visible.value : visible.value.filter((it) => it.significance >= 4),
);
const hiddenCount = computed(() => visible.value.length - shown.value.length);

const open = ref<string | null>(null);

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

    <ol class="tlv__list">
      <li v-for="it in shown" :key="it.id" class="tlv__item">
        <button
          type="button"
          class="tlv__row"
          :class="{ 'tlv__row--major': it.significance === 5 }"
          :aria-expanded="open === it.id"
          @click="open = open === it.id ? null : it.id"
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
          <p>{{ it.summary }}</p>
          <p class="tlv__detail-meta u-ui num">
            {{ it.year < 0 ? `公元前 ${-it.year} 年` : `公元 ${it.year} 年` }}
            <template v-if="it.endYear !== it.year">
              — {{ it.endYear < 0 ? `公元前 ${-it.endYear} 年` : `公元 ${it.endYear} 年` }}
            </template>
          </p>
          <a class="tlv__more-link u-ui" :href="`/events/${it.id}`">查看事件详情 →</a>
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
  gap: 0.25rem;
  padding: 0.1875rem;
  background: var(--color-paper-alt);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  overflow-x: auto;
  scrollbar-width: none;
}

.tlv__eras::-webkit-scrollbar {
  display: none;
}

.tlv__era {
  flex: none;
  font-family: var(--font-ui);
  font-size: var(--fs-xs);
  padding: 0.4375rem 0.875rem;
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
  gap: 0.125rem;
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
  padding: 0 0 var(--sp-4) calc(2.75rem + var(--sp-3) * 2 + 0.5rem);
  font-size: var(--fs-sm);
  color: var(--color-ink-muted);
  line-height: var(--lh-normal);
}

.tlv__detail-meta {
  margin-top: var(--sp-2);
  font-size: var(--fs-2xs);
  color: var(--color-ink-faint);
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
