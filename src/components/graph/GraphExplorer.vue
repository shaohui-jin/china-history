<script setup lang="ts">
/**
 * 图谱浏览器：人物选择 + URL 深链 + 按需加载 ego 网络。
 *
 * URL 是状态源：?focus=<id>&depth=<n>
 * - 直接访问可分享
 * - 浏览器后退能回到上一个焦点
 * - 切换焦点用 replaceState 而非整页跳转，避免重建 Cytoscape 容器
 */
import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import RelationGraph from './RelationGraph.vue';
import RelationList from './RelationList.vue';
import { useBreakpoint } from '../../composables/useBreakpoint';
import { graphByBreakpoint } from '../../design/pages';
import type { EgoNetwork } from '../../lib/content';
import { personHref } from '../../lib/nav';

interface Props {
  options: Array<{
    id: string;
    name: string;
    roles: string[];
    polity: string;
    relationCount: number;
  }>;
}

const props = defineProps<Props>();

const bp = useBreakpoint();

const focusId = ref<string>('');
const depth = ref<number>(1);
const network = shallowRef<EgoNetwork | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

/** 当前断点对应的图谱配置 */
const config = computed(() => graphByBreakpoint[bp.value] ?? graphByBreakpoint.lg);

/** 窄屏走关系列表，不做图谱 */
const narrow = computed(() => bp.value === 'sm');

const focusedOption = computed(
  () => props.options.find((o) => o.id === focusId.value) ?? null,
);

/* ---------------- URL 同步 ---------------- */

function readUrl() {
  const params = new URLSearchParams(window.location.search);
  const focus = params.get('focus');
  const d = Number(params.get('depth') ?? '1');
  focusId.value = focus && props.options.some((o) => o.id === focus) ? focus : props.options[0]?.id ?? '';
  depth.value = Number.isFinite(d) ? Math.min(3, Math.max(1, d)) : 1;
}

function writeUrl() {
  const params = new URLSearchParams();
  params.set('focus', focusId.value);
  params.set('depth', String(depth.value));
  const url = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, '', url);
}

/* ---------------- 数据加载 ---------------- */

async function loadNetwork() {
  if (!focusId.value) return;
  loading.value = true;
  error.value = null;
  try {
    // 用 BASE_URL 前缀，兼容 GitHub Pages 子路径部署
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const res = await fetch(`${base}/graph/ego/${focusId.value}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    network.value = await res.json();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
    network.value = null;
  } finally {
    loading.value = false;
  }
}

/** 按 depth 裁剪网络（服务端给的是 2 跳，前端可收窄） */
const visibleNetwork = computed<EgoNetwork | null>(() => {
  const net = network.value;
  if (!net) return null;
  if (depth.value >= 2) return net;

  // 只保留与焦点直接相连的节点
  const focusSet = new Set([focusId.value]);
  const keep = new Set(focusSet);
  for (const e of net.edges) {
    if (e.source === focusId.value) keep.add(e.target);
    if (e.target === focusId.value) keep.add(e.source);
  }
  return {
    nodes: net.nodes.filter((n) => keep.has(n.id)),
    edges: net.edges.filter((e) => keep.has(e.source) && keep.has(e.target)),
    truncated: 0,
  };
});

/* ---------------- 交互 ---------------- */

function setFocus(id: string) {
  focusId.value = id;
  writeUrl();
  loadNetwork();
}

function setDepth(d: number) {
  depth.value = d;
  writeUrl();
}

function onPopState() {
  readUrl();
  loadNetwork();
}

onMounted(() => {
  readUrl();
  loadNetwork();
  window.addEventListener('popstate', onPopState);
});

// 卸载时清监听（组件是 client:only，页面切换会销毁）
import { onBeforeUnmount } from 'vue';
onBeforeUnmount(() => window.removeEventListener('popstate', onPopState));

watch(focusId, () => {
  if (!loading.value) loadNetwork();
});
</script>

<template>
  <div class="explorer">
    <!-- 控制条 -->
    <div class="explorer__controls">
      <label class="explorer__field">
        <span class="u-ui">中心人物</span>
        <select :value="focusId" @change="setFocus(($event.target as HTMLSelectElement).value)">
          <option v-for="o in options" :key="o.id" :value="o.id">
            {{ o.name }}{{ o.polity ? ` · ${o.polity}` : '' }}（{{ o.relationCount }} 条关系）
          </option>
        </select>
      </label>

      <div class="explorer__field">
        <span class="u-ui">展开深度</span>
        <div class="segmented">
          <button
            v-for="d in [1, 2]"
            :key="d"
            type="button"
            class="segmented__btn"
            :aria-pressed="depth === d"
            @click="setDepth(d)"
          >
            {{ d }} 跳
          </button>
        </div>
      </div>

      <a v-if="focusedOption" class="btn btn--ghost btn--sm" :href="personHref(focusedOption.id)">
        查看 {{ focusedOption.name }} 传记 →
      </a>
    </div>

    <!-- 图谱 / 列表 -->
    <div v-if="loading" class="explorer__state u-ui">正在加载关系数据…</div>
    <div v-else-if="error" class="explorer__state explorer__state--error">
      加载失败：{{ error }}
    </div>
    <template v-else-if="visibleNetwork">
      <RelationList v-if="narrow" :network="visibleNetwork" :focus-id="focusId" />
      <RelationGraph
        v-else
        :config="config"
        :network="visibleNetwork"
        :focus-ids="[focusId]"
      />
    </template>
  </div>
</template>

<style scoped>
.explorer {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  padding-bottom: var(--sp-16);
}

.explorer__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--sp-4);
  padding: var(--sp-4);
  border: 1px solid var(--color-border);
  border-radius: var(--decor-card-radius, var(--radius-md));
  background: var(--color-surface-raised);
}

.explorer__field {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  font-size: var(--fs-xs);
  color: var(--color-ink-muted);
}

.explorer__field select {
  font-family: var(--font-ui);
  font-size: var(--fs-sm);
  padding: var(--sp-2) var(--sp-3);
  min-height: var(--control-md);
  line-height: var(--control-lh);
  min-width: 14rem;
  max-width: 100%;
  color: var(--color-ink);
  background: var(--color-paper);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
}

.explorer__state {
  padding: var(--sp-10);
  text-align: center;
  font-size: var(--fs-sm);
  color: var(--color-ink-faint);
  border: 1px dashed var(--color-border);
  border-radius: var(--decor-card-radius, var(--radius-md));
}

.explorer__state--error {
  color: var(--color-accent);
}
</style>
