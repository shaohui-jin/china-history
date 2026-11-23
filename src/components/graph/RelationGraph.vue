<script setup lang="ts">
/**
 * 关系图谱：Cytoscape 实现。
 *
 * 关键设计（都是踩过的坑）：
 * - `elements` 用 `shallowRef` / `markRaw`，绝不进 `reactive`。上万节点被 Vue 深层代理会卡死。
 * - cy 实例本身 markRaw。只把「选中的节点摘要」留在响应式里。
 * - 视觉常量（节点半径、字号、线宽）固定；布局随容器变化用 `fit` + 缩放。
 * - Cytoscape 动态 import：不在首屏为它付体积。
 */
import { computed, markRaw, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { resolveTheme, DEFAULT_THEME, type SemanticKey } from '../../design/tokens';
import type { GraphConfig } from '../../design/pages';
import type { EgoNetwork, GraphNode } from '../../lib/content';
import { personHref } from '../../lib/nav';
import { relationMeta, type RelationType } from '../../lib/relations';

interface Props {
  config: GraphConfig;
  network: EgoNetwork;
  /** 当前焦点人物 id，用于高亮 */
  focusIds: string[];
}

const props = defineProps<Props>();

const containerEl = shallowRef<HTMLDivElement | null>(null);
/** cy 实例必须 markRaw，否则 Vue 会尝试代理整个图 */
const cy = shallowRef<any>(null);
const libLoaded = ref(false);
const loadError = ref<string | null>(null);

const hoveredId = ref<string | null>(null);
const selectedId = ref<string>(props.focusIds[0] ?? '');

/** 时间滑块：只显示此年份仍「存在」的节点与有效的关系 */
const activeYear = ref<number | null>(null);

const yearBounds = computed(() => {
  const births = props.network.nodes.map((n) => n.birthYear).filter((y): y is number => !!y);
  const deaths = props.network.nodes.map((n) => n.deathYear).filter((y): y is number => !!y);
  if (births.length === 0) return null;
  return {
    min: Math.min(...births),
    max: Math.max(...deaths, ...births),
  };
});

const selectedNode = computed<GraphNode | null>(
  () => props.network.nodes.find((n) => n.id === selectedId.value) ?? null,
);

const selectedEdges = computed(() =>
  props.network.edges.filter(
    (e) => e.source === selectedId.value || e.target === selectedId.value,
  ),
);

/** 关系类型的中文名（用于图例） */
const usedTypes = computed(() => {
  const set = new Set<RelationType>();
  for (const e of props.network.edges) set.add(e.type);
  return [...set];
});

/* ------------------------------------------------------------------ *
 * Cytoscape 构建
 * ------------------------------------------------------------------ */

function buildElements() {
  const c = resolveTheme(DEFAULT_THEME);

  const nodes = props.network.nodes.map((n) => ({
    data: {
      id: n.id,
      label: n.label,
      focus: n.focus ? 1 : 0,
      radius: n.focus ? props.config.nodeRadius.focus : props.config.nodeRadius.primary,
      color: n.focus ? c['color-graph-node-focus'] : c['color-graph-node'],
      labelColor: c['color-graph-node-label'],
      birthYear: n.birthYear,
      deathYear: n.deathYear,
    },
  }));

  const edges = props.network.edges.map((e) => {
    const meta = relationMeta[e.type];
    return {
      data: {
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        strength: e.strength,
        color: c[meta.colorKey as SemanticKey] ?? c['color-graph-edge-strong'],
        lineStyle: meta.lineStyle,
        from: e.from,
        to: e.to,
        width: e.strength === 'primary' ? props.config.edgeWidth.strong : props.config.edgeWidth.weak,
        opacity: e.strength === 'primary' ? 1 : 0.55,
        fontSize: props.config.fontSize.edge,
        // 非对称关系画箭头；对称关系不画（否则会误导成单向）
        targetArrow: e.directed ? 'triangle' : 'none',
      },
    };
  });

  return [...nodes, ...edges];
}

function buildStyle() {
  return [
    {
      selector: 'node',
      style: {
        'background-color': 'data(color)',
        width: 'data(radius)',
        height: 'data(radius)',
        label: 'data(label)',
        'font-size': props.config.fontSize.node,
        color: 'data(labelColor)',
        'text-valign': 'bottom',
        'text-margin-y': 6,
        'text-outline-width': 2,
        'text-outline-color': resolveTheme(DEFAULT_THEME)['color-paper'],
        'border-width': 2,
        'border-color': resolveTheme(DEFAULT_THEME)['color-paper'],
      },
    },
    {
      selector: 'node[focus = 1]',
      style: {
        'font-size': props.config.fontSize.focus,
        'font-weight': 600,
        'z-index': 10,
      },
    },
    {
      selector: 'node:selected',
      style: {
        'border-width': 3,
        'border-color': resolveTheme(DEFAULT_THEME)['color-accent'],
      },
    },
    {
      selector: 'edge',
      style: {
        'line-color': 'data(color)',
        'width': 'data(width)',
        opacity: 'data(opacity)',
        'line-style': 'data(lineStyle)',
        'curve-style': 'bezier',
        'target-arrow-shape': 'data(targetArrow)',
        'target-arrow-color': 'data(color)',
        'arrow-scale': 0.8,
        label: 'data(label)',
        'font-size': 'data(fontSize)',
        color: resolveTheme(DEFAULT_THEME)['color-ink-faint'],
        'text-rotation': 'autorotate',
        'text-background-color': resolveTheme(DEFAULT_THEME)['color-paper'],
        'text-background-opacity': 0.9,
        'text-background-padding': '2px',
      },
    },
    {
      // 弱关系在未交互时淡化，减少视觉噪音
      selector: 'edge[strength = "weak"]',
      style: {
        'line-opacity': 0.45,
        'text-opacity': 0,
      },
    },
    {
      selector: '.dimmed',
      style: { opacity: 0.15 },
    },
  ];
}

async function initCy() {
  const el = containerEl.value;
  if (!el) return;

  try {
    const mod = await import('cytoscape');
    const cytoscape = mod.default;

    // markRaw：实例不进响应式系统
    const instance = markRaw(
      cytoscape({
        container: el,
        elements: buildElements(),
        style: buildStyle(),
        layout: { name: 'concentric', concentric: () => 2, levelWidth: () => 1, padding: 30 },
        wheelSensitivity: 0.2,
        minZoom: 0.3,
        maxZoom: 2.5,
      }),
    );

    cy.value = instance;
    libLoaded.value = true;

    instance.on('tap', 'node', (evt: any) => {
      selectedId.value = evt.target.id();
      highlightNeighbors(evt.target.id());
    });

    instance.on('mouseover', 'node', (evt: any) => {
      hoveredId.value = evt.target.id();
      el.style.cursor = 'pointer';
    });

    instance.on('mouseout', 'node', () => {
      hoveredId.value = null;
      el.style.cursor = 'grab';
    });

    instance.on('tap', (evt: any) => {
      if (evt.target === instance) {
        selectedId.value = props.focusIds[0] ?? '';
        instance.elements().removeClass('dimmed');
      }
    });

    // 跑一次布局，让节点散开
    instance.layout({ name: 'cose', animate: false, padding: 30, nodeRepulsion: 8000 }).run();
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
  }
}

/** 高亮某节点的一跳邻居，其余淡化 */
function highlightNeighbors(id: string) {
  const instance = cy.value;
  if (!instance) return;
  instance.elements().removeClass('dimmed');
  const node = instance.getElementById(id);
  if (!node || node.empty()) return;
  const neighborhood = node.closedNeighborhood();
  instance.elements().not(neighborhood).addClass('dimmed');
}

/* ------------------------------------------------------------------ *
 * 时间过滤：只保留指定年份仍存在的节点与有效的关系
 * ------------------------------------------------------------------ */

function applyTimeFilter() {
  const instance = cy.value;
  if (!instance) return;
  const y = activeYear.value;
  if (y === null) {
    instance.nodes().style('display', 'element');
    instance.edges().style('display', 'element');
    return;
  }
  instance.nodes().forEach((n: any) => {
    const b = n.data('birthYear');
    const d = n.data('deathYear');
    const alive = (b === undefined || y >= b) && (d === undefined || y <= d);
    n.style('display', alive ? 'element' : 'none');
  });
  instance.edges().forEach((e: any) => {
    const from = e.data('from');
    const to = e.data('to');
    // 关系未标注时间则视为长期有效
    const valid = (from === undefined || y >= from) && (to === undefined || y <= to);
    e.style('display', valid ? 'element' : 'none');
  });
  instance.fit(undefined, 30);
}

watch(activeYear, applyTimeFilter);

/* ------------------------------------------------------------------ *
 * 生命周期
 * ------------------------------------------------------------------ */

let ro: ResizeObserver | null = null;

onMounted(() => {
  initCy();
  ro = new ResizeObserver(() => {
    // 容器尺寸变化时只 resize，不重建实例
    cy.value?.resize();
  });
  if (containerEl.value) ro.observe(containerEl.value);
});

onBeforeUnmount(() => {
  ro?.disconnect();
  cy.value?.destroy();
  cy.value = null;
});
</script>

<template>
  <div class="graph">
    <div class="graph__bar">
      <div class="cluster" style="gap: var(--sp-2)">
        <span class="graph__stat u-ui">
          {{ network.nodes.length }} 节点 · {{ network.edges.length }} 关系
        </span>
        <span v-if="network.truncated" class="badge badge--accent">
          已截断，收窄范围以查看更多
        </span>
      </div>
      <div class="cluster" style="gap: var(--sp-2)">
        <button class="btn btn--ghost btn--sm" type="button" :disabled="!cy" @click="cy?.fit(undefined, 40)">
          适应画布
        </button>
        <button
          class="btn btn--ghost btn--sm"
          type="button"
          :disabled="!cy"
          @click="cy?.layout({ name: 'cose', animate: false, padding: 30 }).run()"
        >
          重新布局
        </button>
      </div>
    </div>

    <div class="graph__body">
      <div class="graph__canvas-wrap">
        <div ref="containerEl" class="graph__cy" />
        <p v-if="loadError" class="graph__error">
          图谱加载失败：{{ loadError }}
        </p>
        <p v-else-if="!libLoaded" class="graph__loading u-ui">正在加载图谱组件…</p>
      </div>

      <aside class="graph__side">
        <template v-if="selectedNode">
          <h4 class="graph__side-name">{{ selectedNode.label }}</h4>
          <p class="u-ui graph__side-meta">
            <span v-if="selectedNode.birthYear" class="num">
              {{ selectedNode.birthYear < 0 ? `前${-selectedNode.birthYear}` : selectedNode.birthYear }}
            </span>
            <span v-if="selectedNode.deathYear">
              —
              <span class="num">
                {{ selectedNode.deathYear < 0 ? `前${-selectedNode.deathYear}` : selectedNode.deathYear }}
              </span>
            </span>
            <template v-if="selectedNode.roles.length">
              · {{ selectedNode.roles.join('、') }}
            </template>
          </p>
          <a class="graph__link" :href="personHref(selectedNode.id)">查看传记 →</a>

          <h5 class="graph__side-sub u-ui">关系 · {{ selectedEdges.length }}</h5>
          <ul class="graph__rel-list">
            <li v-for="e in selectedEdges" :key="e.id">
              <a
                class="graph__rel"
                :href="personHref(e.source === selectedId ? e.target : e.source)"
              >
                <span class="graph__rel-name">
                  {{
                    network.nodes.find(
                      (n) => n.id === (e.source === selectedId ? e.target : e.source),
                    )?.label
                  }}
                </span>
                <span class="badge">
                  {{ e.source === selectedId ? e.label : relationMeta[e.type].label + '（对）' }}
                </span>
                <span v-if="e.strength === 'weak'" class="graph__rel-weak u-ui">次要</span>
              </a>
            </li>
          </ul>
        </template>
        <p v-else class="u-ui graph__side-hint">点击节点查看关系详情</p>
      </aside>
    </div>

    <!-- 时间滑块 -->
    <div v-if="config.showTimeSlider && yearBounds" class="graph__time">
      <label class="u-ui">
        <span>时间过滤</span>
        <input
          type="checkbox"
          :checked="activeYear !== null"
          @change="
            activeYear = ($event.target as HTMLInputElement).checked
              ? Math.round((yearBounds!.min + yearBounds!.max) / 2)
              : null
          "
        />
      </label>
      <input
        v-if="activeYear !== null"
        class="graph__slider"
        type="range"
        :min="yearBounds.min"
        :max="yearBounds.max"
        :value="activeYear"
        @input="activeYear = Number(($event.target as HTMLInputElement).value)"
      />
      <span v-if="activeYear !== null" class="num u-ui graph__year">
        {{ activeYear < 0 ? `公元前 ${-activeYear} 年` : `公元 ${activeYear} 年` }}
      </span>
    </div>

    <!-- 图例 -->
    <div class="graph__legend u-ui">
      <span v-for="t in usedTypes" :key="t" class="graph__legend-item">
        <span class="graph__legend-dot" :data-type="relationMeta[t].lineStyle"></span>
        {{ relationMeta[t].label }}
      </span>
      <span class="graph__legend-note">虚线 / 点线为弱关系，默认淡化</span>
    </div>
  </div>
</template>

<style scoped>
.graph {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.graph__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
}

.graph__stat {
  font-size: var(--fs-xs);
  color: var(--color-ink-muted);
}

.graph__body {
  display: grid;
  gap: var(--sp-4);
  grid-template-columns: 1fr;
}

@media (min-width: 1024px) {
  .graph__body {
    grid-template-columns: minmax(0, 1fr) 17rem;
  }
}

.graph__canvas-wrap {
  position: relative;
  min-width: 0;
}

.graph__cy {
  width: 100%;
  height: clamp(20rem, 52vh, 32rem);
  background: var(--color-graph-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--decor-card-radius, var(--radius-md));
  cursor: grab;
}

.graph__loading,
.graph__error {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: var(--fs-sm);
  color: var(--color-ink-faint);
  pointer-events: none;
}

.graph__error {
  color: var(--color-accent);
}

.graph__side {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  border: 1px solid var(--color-border);
  border-radius: var(--decor-card-radius, var(--radius-md));
  background: var(--color-surface-raised);
  padding: var(--sp-4);
  min-height: 10rem;
}

.graph__side-name {
  font-size: var(--fs-lg);
}

.graph__side-meta {
  font-size: var(--fs-xs);
  color: var(--color-ink-muted);
}

.graph__link {
  font-family: var(--font-ui);
  font-size: var(--fs-xs);
  color: var(--color-link);
}

.graph__side-sub {
  margin-top: var(--sp-3);
  font-size: var(--fs-2xs);
  letter-spacing: var(--ls-wider);
  text-transform: uppercase;
  color: var(--color-ink-faint);
  padding-bottom: var(--sp-1);
  border-bottom: 1px dotted var(--color-border);
}

.graph__rel-list {
  display: flex;
  flex-direction: column;
  max-height: 14rem;
  overflow-y: auto;
}

.graph__rel {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  min-height: var(--touch-target);
  border-bottom: 1px solid var(--color-border);
}

.graph__rel-name {
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
  color: var(--color-ink-strong);
}

.graph__rel-weak {
  font-size: var(--fs-2xs);
  color: var(--color-ink-faint);
}

.graph__side-hint {
  font-size: var(--fs-xs);
  color: var(--color-ink-faint);
}

.graph__time {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-3);
  padding-top: var(--sp-2);
  border-top: 1px dotted var(--color-border);
  font-size: var(--fs-xs);
  color: var(--color-ink-muted);
}

.graph__time label {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
}

.graph__slider {
  flex: 1 1 12rem;
  accent-color: var(--color-accent);
}

.graph__year {
  color: var(--color-accent);
  font-weight: var(--fw-medium);
}

.graph__legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3);
  font-size: var(--fs-2xs);
  color: var(--color-ink-faint);
}

.graph__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4.8px;
}

.graph__legend-dot {
  width: 0.875rem;
  height: 0;
  border-top-width: 1.5px;
  border-top-style: solid;
  border-color: var(--color-graph-edge-strong);
}

.graph__legend-dot[data-type='dashed'] {
  border-top-style: dashed;
}

.graph__legend-dot[data-type='dotted'] {
  border-top-style: dotted;
}

.graph__legend-note {
  color: var(--color-ink-faint);
}
</style>
