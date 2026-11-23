<script setup lang="ts">
/**
 * 关系网：手机形态（按关系类型分组的列表）。
 *
 * 手机不渲染图谱：节点挤在一起没有信息量，且画布拖拽会和页面滚动冲突。
 * 改为列表 + 一个最多 6 节点的迷你示意图（仅作方位示意，不可拖拽）。
 */
import { computed } from 'vue';
import type { EgoNetwork } from '../../lib/content';
import { personHref } from '../../lib/nav';
import { relationMeta, type RelationType } from '../../lib/relations';

interface Props {
  network: EgoNetwork;
  focusId: string;
}

const props = defineProps<Props>();

const focusNode = computed(() => props.network.nodes.find((n) => n.id === props.focusId));

interface Row {
  id: string;
  name: string;
  label: string;
  type: RelationType;
  strength: 'primary' | 'weak';
  note?: string;
}

/** 与焦点直接相连的关系 */
const rows = computed<Row[]>(() =>
  props.network.edges
    .filter((e) => e.source === props.focusId || e.target === props.focusId)
    .map((e) => {
      const otherId = e.source === props.focusId ? e.target : e.source;
      const node = props.network.nodes.find((n) => n.id === otherId);
      return {
        id: otherId,
        name: node?.label ?? otherId,
        label: e.label,
        type: e.type,
        strength: e.strength,
        note: e.note,
      };
    }),
);

/** 按关系类型分组，比平铺列表更好扫读 */
const grouped = computed(() => {
  const map = new Map<RelationType, Row[]>();
  for (const r of rows.value) {
    const list = map.get(r.type) ?? [];
    list.push(r);
    map.set(r.type, list);
  }
  // 强关系类型排前面
  return [...map.entries()].sort((a, b) => {
    const aStrong = a[1].some((r) => r.strength === 'primary') ? 0 : 1;
    const bStrong = b[1].some((r) => r.strength === 'primary') ? 0 : 1;
    return aStrong - bStrong || b[1].length - a[1].length;
  });
});

/** 迷你示意图：最多 6 个外圈节点 */
const MINI = 140;
const OUTER = 50;
const CENTER = MINI / 2;

const miniNodes = computed(() => {
  const primary = rows.value.filter((r) => r.strength === 'primary').slice(0, 6);
  return primary.map((r, i) => {
    const a = (i / primary.length) * Math.PI * 2 - Math.PI / 2;
    return {
      ...r,
      x: CENTER + Math.cos(a) * OUTER,
      y: CENTER + Math.sin(a) * OUTER,
    };
  });
});
</script>

<template>
  <div class="rel">
    <!-- 迷你示意图：只能看，不能拖 -->
    <div v-if="miniNodes.length" class="rel__mini" aria-hidden="true">
      <svg :viewBox="`0 0 ${MINI} ${MINI}`" width="100%">
        <line
          v-for="n in miniNodes"
          :key="`l-${n.id}`"
          :x1="CENTER"
          :y1="CENTER"
          :x2="n.x"
          :y2="n.y"
          stroke="var(--color-graph-edge-strong)"
          stroke-width="1.2"
          stroke-linecap="round"
        />
        <circle :cx="CENTER" :cy="CENTER" r="9" fill="var(--color-graph-node-focus)" />
        <circle
          v-for="n in miniNodes"
          :key="`c-${n.id}`"
          :cx="n.x"
          :cy="n.y"
          r="5.5"
          fill="var(--color-graph-node)"
        />
        <text
          v-for="n in miniNodes"
          :key="`t-${n.id}`"
          :x="n.x"
          :y="n.y + (n.y < CENTER ? -9 : 15)"
          text-anchor="middle"
          class="rel__mini-label"
        >
          {{ n.name }}
        </text>
      </svg>
      <p class="rel__mini-caption u-ui">{{ focusNode?.label ?? '' }} 的主要关系</p>
    </div>

    <div class="rel__groups">
      <section v-for="[type, items] in grouped" :key="type">
        <h5 class="rel__group-title u-ui">
          {{ relationMeta[type].label }} · {{ items.length }}
        </h5>
        <ul class="rel__list">
          <li v-for="r in items" :key="r.id">
            <a class="rel__item" :class="{ 'rel__item--weak': r.strength === 'weak' }" :href="personHref(r.id)">
              <span class="rel__name">{{ r.name }}</span>
              <span v-if="r.note" class="rel__note u-ui">{{ r.note }}</span>
              <span v-if="r.strength === 'weak'" class="rel__weak-tag u-ui">次要</span>
            </a>
          </li>
        </ul>
      </section>
    </div>

    <p class="rel__tip u-ui">
      手机端不渲染完整图谱。点人名进入其传记页，再从那里继续展开关系。
    </p>
  </div>
</template>

<style scoped>
.rel {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

.rel__mini {
  width: 100%;
  max-width: 12rem;
  margin-inline: auto;
  padding: var(--sp-2);
  background: var(--color-graph-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--decor-card-radius, var(--radius-md));
}

.rel__mini-label {
  font-family: var(--font-ui);
  font-size: 7.5px;
  fill: var(--color-graph-node-label);
}

.rel__mini-caption {
  text-align: center;
  font-size: var(--fs-2xs);
  color: var(--color-ink-faint);
  margin-top: var(--sp-1);
}

.rel__groups {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

.rel__group-title {
  font-size: var(--fs-2xs);
  letter-spacing: var(--ls-wider);
  text-transform: uppercase;
  color: var(--color-ink-faint);
  padding-bottom: var(--sp-1);
  border-bottom: 1px dotted var(--color-border);
  margin-bottom: var(--sp-1);
}

.rel__list {
  display: flex;
  flex-direction: column;
}

.rel__item {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  min-height: var(--touch-target);
  border-bottom: 1px solid var(--color-border);
  padding-block: var(--sp-2);
  flex-wrap: wrap;
}

.rel__item--weak {
  opacity: 0.75;
}

.rel__name {
  font-size: var(--fs-base);
  font-weight: var(--fw-medium);
  color: var(--color-ink-strong);
  flex: none;
}

.rel__item:hover .rel__name {
  color: var(--color-accent);
}

.rel__note {
  font-size: var(--fs-2xs);
  color: var(--color-ink-muted);
  flex: 1 1 100%;
  line-height: var(--lh-normal);
}

.rel__weak-tag {
  font-size: var(--fs-2xs);
  color: var(--color-ink-faint);
  border: 1px solid var(--color-border);
  border-radius: 2px;
  padding: 0 3.2px;
  margin-left: auto;
}

.rel__tip {
  font-size: var(--fs-2xs);
  color: var(--color-ink-faint);
  line-height: var(--lh-normal);
  padding-top: var(--sp-2);
  border-top: 1px dotted var(--color-border);
}
</style>
