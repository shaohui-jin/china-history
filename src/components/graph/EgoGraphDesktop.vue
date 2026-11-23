<script setup lang="ts">
/**
 * 关系网：桌面 / 平板形态（SVG，像素 1:1）。
 *
 * 尺寸策略（关键，踩过坑）：
 * - 不用 viewBox + width:100%。那会把节点半径、线宽、字号一起等比放大，
 *   容器一宽整张图就"膨胀"，观感很怪。
 * - 改为显式像素画布：坐标即像素，无缩放。容器变宽只让 R（环半径）变大，
 *   也就是拉开节点间距；节点圆与字号始终是常量。
 * - 尺寸上限 400px 并在容器内居中，宽容器里不会摊得过大。
 *
 * 注意：完整的关系探索用 RelationGraph.vue（Cytoscape）。
 * 这里是轻量嵌入版，**仅用于设计样张（styleguide）与 ViewportLab**，
 * 生产页面（人物页）已改用 RelationGraph。保留它是因为它验证了
 * 「1:1 像素 SVG 布局」这个方案，对后续做静态分享图（OG image）有参考价值。
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import type { EgoNetwork } from '../../lib/content';

interface Props {
  network: EgoNetwork;
  focusId: string;
}

const props = defineProps<Props>();

const MIN_SIZE = 160;
const MAX_SIZE = 400;
const PAD = 46;

const R_FOCUS = 17;
const R_PRIMARY = 8;
const R_WEAK = 6;
const STROKE_FOCUS = 3;
const STROKE_NODE = 2;

const wrapEl = shallowRef<HTMLDivElement | null>(null);
const boxSize = ref(320);

const CX = computed(() => boxSize.value / 2);
const CY = computed(() => boxSize.value / 2);
const R = computed(() => Math.max(40, boxSize.value / 2 - PAD));

/** 只取与焦点直接相连的节点 */
const neighbors = computed(() =>
  props.network.edges
    .filter((e) => e.source === props.focusId || e.target === props.focusId)
    .map((e) => {
      const id = e.source === props.focusId ? e.target : e.source;
      const node = props.network.nodes.find((n) => n.id === id);
      return {
        id,
        label: node?.label ?? id,
        strength: e.strength,
        type: e.type,
        label2: e.label,
      };
    }),
);

const centerLabel = computed(
  () => props.network.nodes.find((n) => n.id === props.focusId)?.label ?? '',
);

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  focus: boolean;
  strength: 'primary' | 'weak';
}

const nodes = computed<Node[]>(() => {
  const list = neighbors.value;
  const center: Node = {
    id: props.focusId,
    label: centerLabel.value,
    x: CX.value,
    y: CY.value,
    focus: true,
    strength: 'primary',
  };
  const ring = list.map((n, i) => {
    const a = (i / Math.max(1, list.length)) * Math.PI * 2 - Math.PI / 2;
    return {
      id: n.id,
      label: n.label,
      x: CX.value + Math.cos(a) * R.value,
      y: CY.value + Math.sin(a) * R.value,
      focus: false,
      strength: n.strength,
    };
  });
  return [center, ...ring];
});

interface Edge {
  key: string;
  label: string;
  strength: 'primary' | 'weak';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  lx: number;
  ly: number;
}

const edges = computed<Edge[]>(() => {
  const pos = new Map(nodes.value.map((n) => [n.id, n]));
  return neighbors.value.flatMap((r, i) => {
    const a = pos.get(props.focusId);
    const b = pos.get(r.id);
    if (!a || !b) return [];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const off = 9;
    return [
      {
        key: `${r.id}-${i}`,
        label: r.label2,
        strength: r.strength,
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        lx: mx - (dy / len) * off,
        ly: my + (dx / len) * off,
      },
    ];
  });
});

let ro: ResizeObserver | null = null;

/** 只读宽度，夹在上下限之间；不改动自身尺寸，不会自激 */
function measure() {
  const el = wrapEl.value;
  if (!el) return;
  const w = el.clientWidth;
  const next = Math.min(MAX_SIZE, Math.max(MIN_SIZE, w));
  if (next !== boxSize.value) boxSize.value = next;
}

onMounted(() => {
  measure();
  ro = new ResizeObserver(() => measure());
  if (wrapEl.value) ro.observe(wrapEl.value);
});

onBeforeUnmount(() => ro?.disconnect());
</script>

<template>
  <div ref="wrapEl" class="eg">
    <svg
      v-if="neighbors.length"
      :width="boxSize"
      :height="boxSize"
      :viewBox="`0 0 ${boxSize} ${boxSize}`"
      class="eg__svg"
      role="img"
      :aria-label="`${centerLabel}的关系网`"
    >
      <line
        v-for="e in edges"
        :key="`e-${e.key}`"
        :x1="e.x1"
        :y1="e.y1"
        :x2="e.x2"
        :y2="e.y2"
        :stroke="e.strength === 'primary' ? 'var(--color-graph-edge-strong)' : 'var(--color-graph-edge-weak)'"
        :stroke-width="e.strength === 'primary' ? 1.5 : 1"
        :stroke-dasharray="e.strength === 'weak' ? '3 3' : undefined"
        stroke-linecap="round"
      />

      <text
        v-for="e in edges"
        :key="`t-${e.key}`"
        :x="e.lx"
        :y="e.ly"
        text-anchor="middle"
        dominant-baseline="middle"
        class="eg__edge-label"
      >
        {{ e.label }}
      </text>

      <g v-for="n in nodes" :key="n.id">
        <circle
          :cx="n.x"
          :cy="n.y"
          :r="n.focus ? R_FOCUS : n.strength === 'primary' ? R_PRIMARY : R_WEAK"
          :fill="n.focus ? 'var(--color-graph-node-focus)' : 'var(--color-graph-node)'"
          :opacity="n.strength === 'weak' && !n.focus ? 0.55 : 1"
          stroke="var(--color-graph-bg)"
          :stroke-width="n.focus ? STROKE_FOCUS : STROKE_NODE"
        />
        <text
          :x="n.x"
          :y="n.focus ? n.y + 32 : n.y + (n.y < CY ? -13 : 19)"
          text-anchor="middle"
          :class="['eg__label', { 'eg__label--focus': n.focus }]"
        >
          {{ n.label }}
        </text>
      </g>
    </svg>
    <p v-else class="eg__empty u-ui">暂无关系数据</p>

    <div class="eg__legend u-ui">
      <span class="eg__legend-item">
        <span class="eg__line eg__line--strong"></span>强关系
      </span>
      <span class="eg__legend-item">
        <span class="eg__line eg__line--weak"></span>弱关系
      </span>
    </div>
  </div>
</template>

<style scoped>
.eg {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  width: 100%;
}

.eg__svg {
  display: block;
  flex: none;
}

.eg__empty {
  font-size: var(--fs-xs);
  color: var(--color-ink-faint);
  padding: var(--sp-6);
}

.eg__edge-label {
  font-family: var(--font-ui);
  font-size: 9px;
  fill: var(--color-ink-faint);
  paint-order: stroke;
  stroke: var(--color-graph-bg);
  stroke-width: 3px;
  stroke-linejoin: round;
}

.eg__label {
  font-family: var(--font-ui);
  font-size: 10.5px;
  fill: var(--color-graph-node-label);
}

.eg__label--focus {
  font-weight: var(--fw-semibold);
  font-size: 12px;
}

.eg__legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--sp-4);
  font-size: var(--fs-2xs);
  color: var(--color-ink-faint);
}

.eg__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.eg__line {
  width: 1.25rem;
  height: 0;
  border-top-width: 1.5px;
  border-top-style: solid;
}

.eg__line--strong {
  border-color: var(--color-graph-edge-strong);
}

.eg__line--weak {
  border-top-style: dashed;
  border-color: var(--color-graph-edge-weak);
}
</style>
