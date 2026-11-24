<script setup lang="ts">
/**
 * 时间线（桌面 / 平板）：Canvas 泳道图 + 框选 + 联动列表。
 *
 * 关键设计：
 * - 全部参数从 props.config 读，不 import 全局配置（同一组件可在首页用紧凑版）。
 * - LOD 阶梯来自 config.lod，按当前可视跨度选择最低 significance。
 * - 框选（brush）：按下拖动选出一段年份，右侧列表随之筛选。
 * - 颜色走 resolveTheme()：canvas 读不到 CSS 变量。
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import {
  resolveTheme,
  themes,
  DEFAULT_THEME,
  type SemanticKey,
} from '../../design/tokens';
import type { TimelineConfig } from '../../design/pages';
import { centuryOf, shortYear } from '../../lib/time';
import { eventHref } from '../../lib/nav';
import type { TimelineData } from '../../lib/content';

interface Props {
  config: TimelineConfig;
  data: TimelineData;
  /** 初始可视窗口，null = 全域 */
  initialWindow?: [number, number] | null;
  /**
   * 是否按需加载事件。
   * true 时 props.data.items 只含首屏必需的部分，
   * 缩放/平移时会按世纪从 /data/timeline/<century>.json 拉取缺失的。
   */
  lazyLoad?: boolean;
  /**
   * 政权筛选。传入政权 id 时，右侧列表只显示该政权的事件，画布上其他泳道变淡。
   * 为空表示不筛选，显示全部。
   */
  activeLaneId?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  initialWindow: null,
  lazyLoad: false,
  activeLaneId: null,
});

const canvasEl = shallowRef<HTMLCanvasElement | null>(null);
const wrapEl = shallowRef<HTMLDivElement | null>(null);

/**
 * 已加载的事件。lazyLoad 模式下会随视窗扩展而增长。
 * 用 shallowRef + 整体替换，避免 Vue 深层代理上万条记录。
 */
const loadedItems = shallowRef(props.data.items);

/** 已请求过的世纪，避免重复 fetch */
const requestedCenturies = new Set<number>();

const hovered = ref<string | null>(null);
const selected = ref<string | null>(null);
/** 框选区间，null = 未框选 */
const brushed = ref<{ from: number; to: number } | null>(null);
/** 拖动中的框选开始点（年份） */
let dragStart: number | null = null;
const dragging = ref(false);

const domain = computed<[number, number]>(() => props.data.domain);
const view = ref<{ from: number; to: number }>({
  from: props.initialWindow?.[0] ?? props.data.domain[0],
  to: props.initialWindow?.[1] ?? props.data.domain[1],
});

/** 合并数据源：lazyLoad 时用 loadedItems，否则直接用 props */
const items = computed(() => (props.lazyLoad ? loadedItems.value : props.data.items));

const visual = ref({ width: 0, height: 0, dpr: 1 });

let ro: ResizeObserver | null = null;
let raf = 0;

/* ---------------- 坐标换算 ---------------- */

const padLeft = computed(() => props.config.labelWidth);
const padBottom = computed(() => props.config.axisHeight);

function xOf(year: number, plotW: number): number {
  const { from, to } = view.value;
  return ((year - from) / (to - from)) * plotW;
}

function yearOf(px: number, plotW: number): number {
  const { from, to } = view.value;
  return from + (px / plotW) * (to - from);
}

/** 当前缩放级别允许显示的最低 significance */
function minSignificance(): number {
  const span = view.value.to - view.value.from;
  for (const [threshold, sig] of props.config.lod) {
    if (span >= threshold) return sig;
  }
  return 1;
}

/** 刻度间隔：保证屏幕上 5-8 个主刻度 */
function tickStep(span: number): number {
  const steps = [1, 2, 5, 10, 25, 50, 100, 200, 250, 500, 1000];
  const target = span / 6;
  return steps.find((s) => s >= target) ?? 1000;
}

/** 当前可见的事件（按 LOD + 视窗过滤） */
const visibleItems = computed(() => {
  const minSig = minSignificance();
  const { from, to } = view.value;
  return items.value.filter((it) => {
    if (it.significance < minSig) return false;
    return it.endYear >= from && it.year <= to;
  });
});

/* ---------------- 绘制 ---------------- */

function draw() {
  const canvas = canvasEl.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height, dpr } = visual.value;
  if (width === 0) return;

  const c = resolveTheme(DEFAULT_THEME);
  const fam = themes[DEFAULT_THEME].fontFamily;
  const { laneHeight, laneGap } = props.config;
  const pl = padLeft.value;
  const pb = padBottom.value;
  const plotW = width - pl;
  const laneTotal = laneHeight + laneGap;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  // ---- 纵向网格 + 年份刻度 ----
  const span = view.value.to - view.value.from;
  const step = tickStep(span);
  const firstTick = Math.ceil(view.value.from / step) * step;

  ctx.strokeStyle = c['color-timeline-grid'];
  ctx.lineWidth = 1;
  ctx.font = `400 10px ${fam.numeric}`;
  ctx.fillStyle = c['color-ink-muted'];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  for (let y = firstTick; y <= view.value.to; y += step) {
    if (y === 0) continue; // 不存在公元 0 年
    const x = Math.round(pl + xOf(y, plotW)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height - pb);
    ctx.stroke();
    ctx.fillText(shortYear(y), x, height - pb + 6);
  }

  // ---- 框选遮罩 ----
  if (brushed.value) {
    const bx1 = pl + xOf(Math.max(brushed.value.from, view.value.from), plotW);
    const bx2 = pl + xOf(Math.min(brushed.value.to, view.value.to), plotW);
    ctx.fillStyle = c['color-accent-soft'];
    ctx.globalAlpha = 0.5;
    ctx.fillRect(bx1, 0, bx2 - bx1, height - pb);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = c['color-accent'];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx1 + 0.5, 0);
    ctx.lineTo(bx1 + 0.5, height - pb);
    ctx.moveTo(bx2 - 0.5, 0);
    ctx.lineTo(bx2 - 0.5, height - pb);
    ctx.stroke();
  }

  // ---- 泳道 ----
  const minSig = minSignificance();

  props.data.lanes.forEach((lane) => {
    // 行位置用 rowIndex（由 getTimelineData 按**时间重叠**分配），
    // 不能用数组下标 i —— 否则同一行的两个政权会叠在一起
    const top = lane.rowIndex * laneTotal;
    const midY = top + laneHeight / 2;
    const laneColor = c[`color-lane-${lane.laneIndex}` as SemanticKey];

    // 标签
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = c['color-ink-muted'];
    ctx.font = `500 11px ${fam.ui}`;
    ctx.fillText(lane.label, pl - 10, midY);

    // 存续时间条
    const barX1 = pl + Math.max(0, xOf(lane.start, plotW));
    const barX2 = pl + Math.min(plotW, xOf(lane.end, plotW));
    if (barX2 > barX1) {
      const barH = 6;
      ctx.fillStyle = laneColor;
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.roundRect(barX1, midY - barH / 2, barX2 - barX1, barH, barH / 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 该泳道事件
    const laneItems = items.value.filter(
      (it) => it.laneId === lane.id && it.significance >= minSig,
    );

    for (const it of laneItems) {
      const x = pl + xOf(it.year, plotW);
      if (it.endYear !== it.year) {
        const x2 = pl + xOf(it.endYear, plotW);
        ctx.fillStyle = laneColor;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.roundRect(x, midY + 7, Math.max(x2 - x, 2), 3, 1.5);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      const isActive = selected.value === it.id || hovered.value === it.id;
      const r = it.significance === 5 ? (isActive ? 6.5 : 5) : it.significance === 4 ? 4 : 3;

      ctx.beginPath();
      ctx.arc(x, midY - (it.significance === 5 ? 3 : 0), r, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? c['color-timeline-point-active'] : laneColor;
      ctx.fill();

      // 标签：重大事件常显，其余放大后才显
      const showLabel =
        it.significance === 5 || (it.significance >= 3 && span < 200) || isActive;
      if (showLabel) {
        ctx.font = `600 10px ${fam.ui}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = isActive ? c['color-timeline-point-active'] : c['color-ink'];
        const max = props.config.labelMaxChars;
        const label = it.title.length > max ? it.title.slice(0, max - 1) + '…' : it.title;
        ctx.fillText(label, x, midY - (it.significance === 5 ? 11 : 7));
      }
    }
  });

  // ---- 底部轴线 ----
  ctx.strokeStyle = c['color-timeline-axis'];
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pl, height - pb + 0.5);
  ctx.lineTo(width, height - pb + 0.5);
  ctx.stroke();
}

function scheduleDraw() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    draw();
  });
}

/* ---------------- 尺寸 ---------------- */

function resize() {
  const canvas = canvasEl.value;
  const wrap = wrapEl.value;
  if (!canvas || !wrap) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = wrap.clientWidth;
  // 高度由**实际行数**决定（不是政权数）：
  // 时间上不重叠的政权复用同一行，所以 12 个政权可能只有 3 行，画布不会无限增高。
  const rowCount =
    props.data.lanes.reduce((max, l) => Math.max(max, l.rowIndex + 1), 0) || 0;
  const cssH =
    rowCount * (props.config.laneHeight + props.config.laneGap) +
    props.config.axisHeight;

  // 幂等：尺寸没变就不动，避免 ResizeObserver 自激
  if (
    visual.value.width === cssW &&
    visual.value.height === cssH &&
    visual.value.dpr === dpr
  ) {
    return;
  }

  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);

  visual.value = { width: cssW, height: cssH, dpr };
  scheduleDraw();
}

/* ---------------- 交互 ---------------- */

function zoomAt(factor: number, anchorYear?: number) {
  const { from, to } = view.value;
  const span = to - from;
  const [d0, d1] = domain.value;
  const nextSpan = Math.min(d1 - d0, Math.max(20, span * factor));
  const anchor = anchorYear ?? (from + to) / 2;
  const ratio = (anchor - from) / span;

  let nf = anchor - nextSpan * ratio;
  if (nf < d0) nf = d0;
  let nt = nf + nextSpan;
  if (nt > d1) {
    nt = d1;
    nf = Math.max(d0, nt - nextSpan);
  }
  view.value = { from: Math.round(nf), to: Math.round(nt) };
}

function hitTest(clientX: number, clientY: number): string | null {
  const canvas = canvasEl.value;
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  const pl = padLeft.value;
  const plotW = visual.value.width - pl;
  const laneTotal = props.config.laneHeight + props.config.laneGap;
  const minSig = minSignificance();

  let best: { id: string; d: number } | null = null;
  props.data.lanes.forEach((lane) => {
    const midY = lane.rowIndex * laneTotal + props.config.laneHeight / 2;
    if (Math.abs(y - midY) > props.config.laneHeight * 0.7) return;
    for (const it of items.value) {
      if (it.laneId !== lane.id || it.significance < minSig) continue;
      const ex = pl + xOf(it.year, plotW);
      const d = Math.abs(x - ex);
      // 命中区放大到 14px，满足触控可用性
      if (d < 14 && (!best || d < best.d)) best = { id: it.id, d };
    }
  });
  return best ? best.id : null;
}

function pointerYear(ev: PointerEvent): number {
  const canvas = canvasEl.value;
  if (!canvas) return view.value.from;
  const rect = canvas.getBoundingClientRect();
  const plotW = visual.value.width - padLeft.value;
  const px = Math.max(0, Math.min(plotW, ev.clientX - rect.left - padLeft.value));
  return yearOf(px, plotW);
}

function onPointerDown(ev: PointerEvent) {
  // 触屏：单指只做「点选事件」，不启动框选。
  // 框选需要按住拖动，与浏览器的纵向滚动手势直接冲突——
  // 如果单指也启动框选，手指一动页面就滚不动了。
  if (ev.pointerType === 'touch') {
    const id = hitTest(ev.clientX, ev.clientY);
    if (id) {
      selected.value = id;
      scheduleDraw();
    }
    return;
  }

  if (!props.config.enableBrush) return;
  const id = hitTest(ev.clientX, ev.clientY);
  if (id) {
    // 点在事件上：选择而非框选
    selected.value = id;
    scheduleDraw();
    return;
  }
  dragStart = pointerYear(ev);
  dragging.value = true;
  brushed.value = { from: dragStart, to: dragStart };
  canvasEl.value?.setPointerCapture(ev.pointerId);
}

function onPointerMove(ev: PointerEvent) {
  // 触屏不做 hover 反馈：手指抬起后没有「悬停」语义，
  // 持续改 hovered 只会让选中态闪烁。
  if (ev.pointerType === 'touch') return;

  if (dragging.value && dragStart !== null) {
    const y = pointerYear(ev);
    brushed.value = {
      from: Math.min(dragStart, y),
      to: Math.max(dragStart, y),
    };
    scheduleDraw();
    return;
  }

  const id = hitTest(ev.clientX, ev.clientY);
  if (id !== hovered.value) {
    hovered.value = id;
    const canvas = canvasEl.value;
    if (canvas) canvas.style.cursor = id ? 'pointer' : props.config.enableBrush ? 'crosshair' : 'grab';
    scheduleDraw();
  }
}

function onPointerUp(ev: PointerEvent) {
  if (!dragging.value) return;
  dragging.value = false;
  dragStart = null;
  canvasEl.value?.releasePointerCapture(ev.pointerId);
  // 拖动距离过小视为误触，清空框选
  if (brushed.value && Math.abs(brushed.value.to - brushed.value.from) < 1) {
    brushed.value = null;
  }
  scheduleDraw();
}

/**
 * 指针被系统取消（来电、手势被浏览器接管、切换到别的 App）。
 * 不清理的话 dragging 会卡在 true，下次进页面一碰画布就画出
 * 一条从上次位置到现在的诡异框选。
 */
function onPointerCancel(ev: PointerEvent) {
  if (!dragging.value) return;
  dragging.value = false;
  dragStart = null;
  brushed.value = null;
  canvasEl.value?.releasePointerCapture(ev.pointerId);
  scheduleDraw();
}

/** 双指缩放：两根手指同时按下时进入缩放模式 */
let pinchStartDist = 0;
let pinchStartView: { from: number; to: number } | null = null;

function onTouchStart(ev: TouchEvent) {
  if (ev.touches.length !== 2) return;
  const [a, b] = [ev.touches[0], ev.touches[1]];
  pinchStartDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  pinchStartView = { ...view.value };
}

function onTouchMove(ev: TouchEvent) {
  if (ev.touches.length !== 2 || !pinchStartView || pinchStartDist === 0) return;
  // 双指缩放必须拦掉，否则 iOS 会把整页放大
  ev.preventDefault();

  const [a, b] = [ev.touches[0], ev.touches[1]];
  const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

  const scale = pinchStartDist / dist;
  const span = (pinchStartView.to - pinchStartView.from) * scale;
  const center = (pinchStartView.from + pinchStartView.to) / 2;
  const half = span / 2;
  const [min, max] = props.data.domain;
  const from = Math.max(min, center - half);
  const to = Math.min(max, center + half);
  view.value = from < to ? { from, to } : { from: min, to: max };
}

function onTouchEnd() {
  pinchStartDist = 0;
  pinchStartView = null;
}

function onWheel(ev: WheelEvent) {
  // 滚轮缩放是桌面主交互。画布区域内不需要纵向滚动
  // （页面在画布外滚动），所以这里阻止默认行为是安全的。
  ev.preventDefault();
  const anchor = pointerYear(ev as unknown as PointerEvent);
  zoomAt(ev.deltaY > 0 ? 1.18 : 0.85, anchor);
}

function jumpTo(from: number, to: number) {
  view.value = { from, to };
  brushed.value = null;
}

/* ---------------- 生命周期 ---------------- */

watch(view, scheduleDraw);
watch(brushed, scheduleDraw, { deep: true });

onMounted(() => {
  resize();
  ro = new ResizeObserver(() => resize());
  if (wrapEl.value) ro.observe(wrapEl.value);
});

onBeforeUnmount(() => {
  ro?.disconnect();
  if (raf) cancelAnimationFrame(raf);
});

/* ---------------- 联动列表 ---------------- */

/** 列表内容：有框选时显示框选范围内的事件，否则显示当前视窗内的 */
const listItems = computed(() => {
  const minSig = minSignificance();
  const range = brushed.value ?? view.value;
  const lane = props.activeLaneId;
  return items.value
    .filter((it) => {
      if (it.significance < minSig) return false;
      // 政权筛选：指定 laneId 时只留该政权的事件
      if (lane && it.laneId !== lane) return false;
      return it.endYear >= range.from && it.year <= range.to;
    })
    .sort((a, b) => a.year - b.year);
});

/** 筛选中的政权名，用于列表标题 */
const activeLaneLabel = computed(() => {
  if (!props.activeLaneId) return null;
  return props.data.lanes.find((l) => l.id === props.activeLaneId)?.label ?? props.activeLaneId;
});

const spanLabel = computed(() => {
  const { from, to } = view.value;
  return `${shortYear(from)} — ${shortYear(to)}`;
});

const selectedItem = computed(
  () => items.value.find((it) => it.id === selected.value) ?? null,
);

/** 常用跳转：从数据里挑出重要节点，做成快捷按钮 */
const jumpTargets = computed(() => {
  const bySig = [...items.value].sort((a, b) => b.significance - a.significance);
  const picked: Array<{ label: string; from: number; to: number }> = [];
  const seen = new Set<string>();
  for (const it of bySig) {
    if (seen.has(it.laneId)) continue;
    seen.add(it.laneId);
    const center = it.year;
    // 以事件为中心取 80 年窗口
    picked.push({ label: it.title, from: center - 60, to: center + 40 });
    if (picked.length >= 3) break;
  }
  return picked;
});

/* ---------------- 按需加载（lazyLoad） ---------------- */

/**
 * 视窗覆盖的世纪列表。
 * 跨度太大时（如全域视图）不触发加载——那种缩放下 LOD 只显示
 * significance 5 的事件，初始数据已足够；逐个世纪拉全反而更慢。
 */
function centuriesInView(): number[] {
  const { from, to } = view.value;
  const span = to - from;
  // 超过 300 年不按需加载，避免一次拉十几个世纪
  if (span > 300) return [];
  const out: number[] = [];
  for (let c = centuryOf(from); c <= centuryOf(to); c++) out.push(c);
  return out;
}

async function ensureCenturies() {
  if (!props.lazyLoad) return;

  const need = centuriesInView().filter((c) => !requestedCenturies.has(c));
  if (need.length === 0) return;

  const base = import.meta.env.BASE_URL.replace(/\/$/, '');

  for (const c of need) {
    requestedCenturies.add(c);
  }

  try {
    const results = await Promise.all(
      need.map(async (c) => {
        const res = await fetch(`${base}/data/timeline/${c}.json`);
        if (!res.ok) return [];
        const json = (await res.json()) as { items: typeof props.data.items };
        return json.items;
      }),
    );

    // 合并去重（跨世纪事件会出现在多个分片里）
    const seen = new Set(loadedItems.value.map((it) => it.id));
    const merged = [...loadedItems.value];
    for (const list of results) {
      for (const it of list) {
        if (!seen.has(it.id)) {
          seen.add(it.id);
          merged.push(it);
        }
      }
    }
    // 整体替换，触发 shallowRef 更新
    loadedItems.value = merged;
    scheduleDraw();
  } catch {
    // 加载失败就静默降级：已有数据仍可绘制
    for (const c of need) requestedCenturies.delete(c);
  }
}

// 视窗变化时补数据（防抖，避免连续缩放时狂发请求）
let loadTimer: number | undefined;
watch(view, () => {
  if (!props.lazyLoad) return;
  window.clearTimeout(loadTimer);
  loadTimer = window.setTimeout(ensureCenturies, 200);
});
</script>

<template>
  <div class="tl">
    <div class="tl__toolbar">
      <div class="cluster" style="gap: var(--sp-2)">
        <button class="btn btn--ghost btn--sm" type="button" @click="zoomAt(1.4)">缩小</button>
        <button class="btn btn--ghost btn--sm" type="button" @click="zoomAt(0.7)">放大</button>
        <button
          class="btn btn--ghost btn--sm"
          type="button"
          @click="jumpTo(domain[0], domain[1])"
        >
          全域
        </button>
        <button
          v-for="t in jumpTargets"
          :key="t.label"
          class="btn btn--ghost btn--sm"
          type="button"
          @click="jumpTo(t.from, t.to)"
        >
          {{ t.label }}
        </button>
      </div>
      <div class="tl__meta u-ui">
        <span class="num">{{ spanLabel }}</span>
        <button
          v-if="brushed"
          class="tl__clear"
          type="button"
          @click="brushed = null"
        >
          清除框选
        </button>
      </div>
    </div>

    <div class="tl__body" :class="{ 'tl__body--split': config.showSideList }">
      <div ref="wrapEl" class="tl__canvas-wrap">
        <canvas
          ref="canvasEl"
          role="img"
          aria-label="中国历史时间线，按政权分道"
          @wheel="onWheel"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerCancel"
          @pointerleave="hovered = null"
          @touchstart.passive="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
          @touchcancel="onTouchEnd"
        />
        <p class="tl__hint u-ui">
          滚轮或双指缩放 · 拖动空白处框选时间段 · 点击事件查看详情
        </p>
      </div>

      <aside v-if="config.showSideList" class="tl__side">
        <div class="tl__side-head">
          <span class="u-ui">
            <template v-if="activeLaneLabel">{{ activeLaneLabel }}</template>
            <template v-else>{{ brushed ? '框选范围内' : '当前视窗内' }}</template>
          </span>
          <span class="num u-ui">{{ listItems.length }} 条</span>
        </div>
        <ul class="tl__list">
          <li v-for="it in listItems" :key="it.id">
            <!--
              用 <a> 而不是 <button>：点击要能跳到事件详情页。
              之前是 button + 只设 selected，导致桌面端点列表毫无反应，
              而移动端的 TimelineVertical 是 <a>，两端行为不一致。
              保留 @click 设 selected 是为了画布上同步高亮，不阻止默认跳转。
            -->
            <a
              class="tl__list-item"
              :class="{ 'tl__list-item--active': selected === it.id }"
              :href="eventHref(it.id)"
              @click="selected = it.id"
            >
              <span class="tl__list-year num">{{ shortYear(it.year) }}</span>
              <span class="tl__list-main">
                <span class="tl__list-title">{{ it.title }}</span>
                <span class="tl__list-summary">{{ it.summary }}</span>
              </span>
            </a>
          </li>
        </ul>
        <p v-if="listItems.length === 0" class="tl__empty u-ui">
          <template v-if="activeLaneLabel">该政权在此范围内没有达到阈值的事件。</template>
          <template v-else>该范围内没有达到当前详细度阈值的事件，放大或清除框选试试。</template>
        </p>
      </aside>
    </div>

    <p v-if="selectedItem" class="tl__picked u-ui">
      <span class="dot" style="color: var(--color-timeline-point-active)"></span>
      <span class="num">{{ shortYear(selectedItem.year) }}</span>
      <strong>{{ selectedItem.title }}</strong>
      <span class="u-muted">{{ selectedItem.summary }}</span>
    </p>
  </div>
</template>

<style scoped>
.tl {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.tl__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}

.tl__meta {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-3);
  font-size: var(--fs-xs);
  color: var(--color-ink-muted);
}

.tl__clear {
  font-family: var(--font-ui);
  font-size: var(--fs-2xs);
  color: var(--color-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.tl__body {
  display: grid;
  gap: var(--sp-4);
  grid-template-columns: 1fr;
}

@media (min-width: 1024px) {
  .tl__body--split {
    grid-template-columns: minmax(0, 1fr) 20rem;
    align-items: start;
  }
}

.tl__canvas-wrap {
  min-width: 0;
}

.tl__canvas-wrap canvas {
  display: block;
  /*
    pan-y 而不是 none：
    画布内也要允许页面纵向滚动。none 会让手指落在画布上时
    整页卡死（平板/触屏笔记本上尤其明显）。
    双指缩放由 JS 的 touchmove 里 preventDefault 拦下。
  */
  touch-action: pan-y;
}

.tl__hint {
  margin-top: var(--sp-2);
  font-size: var(--fs-2xs);
  color: var(--color-ink-faint);
}

.tl__side {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  max-height: 26rem;
  border: 1px solid var(--color-border);
  border-radius: var(--decor-card-radius, var(--radius-md));
  background: var(--color-surface-raised);
  padding: var(--sp-3);
}

.tl__side-head {
  display: flex;
  justify-content: space-between;
  font-size: var(--fs-2xs);
  letter-spacing: var(--ls-wide);
  color: var(--color-ink-faint);
  text-transform: uppercase;
  padding-bottom: var(--sp-2);
  border-bottom: 1px dotted var(--color-border);
}

.tl__list {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.tl__list-item {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr);
  gap: var(--sp-2);
  width: 100%;
  text-align: left;
  padding: var(--sp-2);
  border-radius: var(--radius-sm);
  border-bottom: 1px solid var(--color-border);
  /* 列表项是 <a>：去掉全局链接下划线与蓝色，靠 hover 背景表示可点 */
  color: inherit;
  text-decoration: none;
}

.tl__list-item:hover {
  background: var(--color-paper-alt);
}

.tl__list-item--active {
  background: var(--color-accent-soft);
}

.tl__list-year {
  font-size: var(--fs-xs);
  font-weight: var(--fw-semibold);
  color: var(--color-accent);
}

.tl__list-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.tl__list-title {
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
  color: var(--color-ink-strong);
  line-height: var(--lh-snug);
}

.tl__list-summary {
  font-size: var(--fs-2xs);
  color: var(--color-ink-muted);
  line-height: var(--lh-normal);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tl__empty {
  font-size: var(--fs-2xs);
  color: var(--color-ink-faint);
  line-height: var(--lh-normal);
  padding: var(--sp-2);
}

.tl__picked {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--sp-2);
  padding-top: var(--sp-3);
  border-top: 1px dotted var(--color-border);
  font-size: var(--fs-sm);
}
</style>
