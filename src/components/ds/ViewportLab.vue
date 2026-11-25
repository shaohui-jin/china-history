<script setup lang="ts">
/**
 * 三端沙盒：在页面里真实切换容器宽度，验证「换形态」而不是「缩字号」。
 *
 * 实现要点：
 * - 用 CSS 容器查询（container-type: inline-size），而不是媒体查询。
 *   媒体查询看的是视口宽度，无法在同一个页面里同时展示三种形态。
 * - 时间线现在是同一个组件（TimelineLayoutB），在三种宽度下都要能读；
 *   关系网仍按宽度切换形态（图谱 / 列表）。
 */
import { computed, ref } from 'vue';
import TimelineLayoutB from '../timeline/TimelineLayoutB.vue';
import RelationList from '../graph/RelationList.vue';
import EgoGraphDesktop from '../graph/EgoGraphDesktop.vue';
import type { TimelineData, EgoNetwork } from '../../lib/content';

interface Props {
  timeline: TimelineData;
  network: EgoNetwork;
  focusId?: string;
}

const props = withDefaults(defineProps<Props>(), { focusId: 'zhuge-liang' });

interface Mode {
  id: 'desktop' | 'tablet' | 'mobile';
  label: string;
  width: string;
  note: string;
}

const MODES: Mode[] = [
  { id: 'desktop', label: '桌面', width: '100%', note: '多政权泳道 + 侧栏详情' },
  { id: 'tablet', label: '平板', width: '48rem', note: '泳道收窄 + 抽屉列表' },
  { id: 'mobile', label: '手机', width: '23.4375rem', note: '纵向事件流 + 关系列表' },
];

const mode = ref<Mode['id']>('desktop');
const current = computed(() => MODES.find((m) => m.id === mode.value) ?? MODES[0]);

/**
 * 关系网仍按宽度换形态：手机上图谱画不开，改用列表。
 * 时间线不再区分 —— 同一个组件在三种宽度下都要能读，
 * 这正是「每端各自一致」的要求。
 */
const isNarrow = computed(() => mode.value === 'mobile');
</script>

<template>
  <div class="lab">
    <div class="lab__bar">
      <div class="segmented" role="group" aria-label="选择设备宽度">
        <button
          v-for="m in MODES"
          :key="m.id"
          type="button"
          class="segmented__btn"
          :aria-pressed="mode === m.id"
          @click="mode = m.id"
        >
          {{ m.label }}
        </button>
      </div>
      <div class="lab__meta u-ui">
        <span class="num">{{ current.width }}</span>
        <span class="lab__sep">·</span>
        <span>{{ current.note }}</span>
      </div>
    </div>

    <div class="lab__stage">
      <div class="lab__device" :data-device="mode">
        <div class="lab__screen">
          <section class="lab__block">
            <header class="lab__head">
              <h4 class="lab__title">时间线</h4>
              <span class="badge">横向时间轴</span>
            </header>
            <TimelineLayoutB
              :lanes="timeline.lanes"
              :items="timeline.items"
            />
          </section>

          <section class="lab__block">
            <header class="lab__head">
              <h4 class="lab__title">关系网</h4>
              <span class="badge">{{ isNarrow ? '列表 + 迷你图' : '图谱' }}</span>
            </header>
            <RelationList v-if="isNarrow" :network="network" :focus-id="focusId" />
            <EgoGraphDesktop v-else :network="network" :focus-id="focusId" />
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lab {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

.lab__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}

.lab__meta {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-xs);
  color: var(--color-ink-muted);
}

.lab__sep {
  color: var(--color-ink-faint);
}

.lab__stage {
  display: flex;
  justify-content: center;
  padding: var(--sp-4);
  background: var(--color-paper-alt);
  border: 1px solid var(--color-border);
  border-radius: var(--decor-card-radius, var(--radius-lg));
  overflow-x: auto;
}

.lab__device {
  width: 100%;
  max-width: var(--lab-width, 100%);
  background: var(--color-paper);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--decor-card-radius, var(--radius-md));
  overflow: hidden;
  container-type: inline-size;
  container-name: lab;
}

.lab__device[data-device='desktop'] {
  --lab-width: 100%;
}

.lab__device[data-device='tablet'] {
  --lab-width: 48rem;
}

.lab__device[data-device='mobile'] {
  --lab-width: 23.4375rem;
}

.lab__screen {
  display: flex;
  flex-direction: column;
  gap: var(--sp-8);
  padding: var(--sp-5);
}

.lab__block {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.lab__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  padding-bottom: var(--sp-2);
  border-bottom: 1px solid var(--color-border);
}

.lab__title {
  font-size: var(--fs-base);
}

@container lab (max-width: 30rem) {
  .lab__screen {
    padding: var(--sp-3);
    gap: var(--sp-6);
  }
}
</style>
