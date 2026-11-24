<script setup lang="ts">
/**
 * 时间线浏览器：画布 + 政权筛选条。
 *
 * 为什么要单独一层包装：
 * 政权筛选是「点政权→右侧列表只显示该政权事件」的联动，
 * 两个区域必须共享状态。而 TimelineCanvas 是 client:media 挂载的，
 * 页面级 Astro 模板无法持有客户端状态，所以把两者放进同一个 Vue 组件。
 *
 * URL 同步：筛选状态写进 ?lane=<id>，刷新与分享都能还原。
 * 与 GraphExplorer 的 ?focus=&depth= 用同一套 replaceState 手法。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import TimelineCanvas from './TimelineCanvas.vue';
import type { TimelineConfig } from '../../design/pages';
import type { TimelineData } from '../../lib/content';
import { shortYear } from '../../lib/time';

interface Props {
  config: TimelineConfig;
  /** 画布用的数据（可能已裁剪，只含 sig≥4） */
  data: TimelineData;
  /** 政权列表用的完整泳道信息 */
  lanes: TimelineData['lanes'];
  lazyLoad?: boolean;
}

const props = withDefaults(defineProps<Props>(), { lazyLoad: false });

const activeLane = ref<string | null>(null);

/** 从 URL 还原筛选（首屏 SSR 拿不到，只能在客户端初始化） */
function readLaneFromUrl(): string | null {
  if (typeof location === 'undefined') return null;
  const id = new URLSearchParams(location.search).get('lane');
  if (!id) return null;
  return props.lanes.some((l) => l.id === id) ? id : null;
}

function syncUrl() {
  if (typeof history === 'undefined') return;
  const u = new URL(location.href);
  if (activeLane.value) u.searchParams.set('lane', activeLane.value);
  else u.searchParams.delete('lane');
  history.replaceState(null, '', u);
}

function selectLane(id: string | null) {
  activeLane.value = activeLane.value === id ? null : id;
  syncUrl();
}

/** 浏览器前进后退时同步 */
function onPopState() {
  activeLane.value = readLaneFromUrl();
}

onMounted(() => {
  activeLane.value = readLaneFromUrl();
  window.addEventListener('popstate', onPopState);
});

onBeforeUnmount(() => {
  window.removeEventListener('popstate', onPopState);
});
</script>

<template>
  <div class="tle">
    <TimelineCanvas
      :config="config"
      :data="data"
      :lazy-load="lazyLoad"
      :active-lane-id="activeLane"
    />

    <section class="tle__lanes">
      <div class="tle__head">
        <h2 class="tle__title u-ui">按政权查看</h2>
        <button
          v-if="activeLane"
          type="button"
          class="tle__reset u-ui"
          @click="selectLane(null)"
        >
          显示全部
        </button>
        <span v-else class="tle__hint u-ui">点击政权，右侧只列该政权的事件</span>
      </div>

      <ul class="tle__list">
        <li v-for="l in lanes" :key="l.id">
          <button
            type="button"
            class="tle__item"
            :class="{ 'tle__item--active': activeLane === l.id }"
            :aria-pressed="activeLane === l.id"
            @click="selectLane(l.id)"
          >
            <span
              class="tle__bar"
              :style="{ background: `var(--color-lane-${l.laneIndex})` }"
            />
            <span class="tle__name">{{ l.label }}</span>
            <span class="num tle__span">{{ shortYear(l.start) }}–{{ shortYear(l.end) }}</span>
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.tle {
  display: flex;
  flex-direction: column;
  gap: var(--sp-6);
}

.tle__lanes {
  padding-top: var(--sp-5);
  border-top: 1px dotted var(--color-border);
}

.tle__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--sp-3);
  margin-bottom: var(--sp-3);
}

.tle__title {
  font-size: var(--fs-2xs);
  letter-spacing: var(--ls-wider);
  text-transform: uppercase;
  color: var(--color-ink-faint);
}

.tle__hint {
  font-size: var(--fs-2xs);
  color: var(--color-ink-faint);
}

.tle__reset {
  font-size: var(--fs-xs);
  color: var(--color-accent);
  padding: 0 var(--sp-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: none;
  cursor: pointer;
  min-height: var(--control-sm);
  line-height: var(--control-lh);
}

.tle__reset:hover {
  background: var(--color-paper-alt);
}

.tle__list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}

.tle__item {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  padding: 0 var(--sp-3);
  min-height: var(--control-md);
  line-height: var(--control-lh);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-surface-raised);
  cursor: pointer;
  font-size: var(--fs-xs);
  color: var(--color-ink-muted);
}

.tle__item:hover {
  border-color: var(--color-accent);
  color: var(--color-ink-strong);
}

.tle__item--active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-ink-inverse);
}

.tle__item--active .tle__span {
  color: var(--color-ink-inverse);
  opacity: 0.75;
}

.tle__bar {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 1px;
  flex: none;
}

.tle__name {
  font-family: var(--font-ui);
}

.tle__span {
  font-size: var(--fs-2xs);
  color: var(--color-ink-faint);
}
</style>
