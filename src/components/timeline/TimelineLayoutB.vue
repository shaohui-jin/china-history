<script setup lang="ts">
/**
 * 时间线：顶部政权标签条 + 下方横向时间轴。
 *
 * ## 横轴为什么是非线性的
 *
 * 线性轴下，年份跨度大的政权必然把事件挤在几处。实测汉朝 422 年 16 个事件，
 * 相邻间距最密只有 5px；唐与清更极端，同年两件事间距为 0px。
 * 靠「纵向堆层数」解决的话，清朝要堆到 10 层、轨道高 370px 以上，高度失控。
 *
 * 改成按「事件之间的年份差」分配横轴宽度：
 * - 相邻事件隔得远 → 这一段拉长，让人看清「中间隔了很久」
 * - 相邻事件挨得近 → 这一段收窄到最小可读宽度
 * - 用平方根压缩，不做完全等距：40 年的空白不该是 10 年的 4 倍宽，
 *   但也不该和 1 年一样宽——间隔本身是有信息的
 *
 * 结果：所有朝代只需 1–2 层，轨道高固定约 150–200px，且不再需要缩放。
 *
 * ## 标签为什么上下交错
 *
 * 即使段宽已经拉到 ≥144px（一个标签的宽度），同年多个事件仍会重叠。
 * 所以按「优先放上层，上层放不下才放下层」分配，两层各自内部保证不相撞。
 *
 * ## 交互
 *
 * 横轴总宽 2400–3100px，超出容器的部分横向滚动。不做缩放——
 * 非线性轴已经把「密集处摊开」这件事在布局阶段做完了。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { TimelineData, TimelineItem } from '../../lib/content';
import { eventHref } from '../../lib/nav';
import { shortYear } from '../../lib/time';

interface Props {
  lanes: TimelineData['lanes'];
  items: TimelineItem[];
  initialLaneId?: string;
}

const props = defineProps<Props>();

/* ---------------- 政权选择 ---------------- */

/**
 * 政权按起始年排序，这是顶部标签条的显示顺序。
 *
 * 必须定义在 activeLaneId 之前：默认选中项要取排序后的第一个，
 * 否则会取到 props.lanes 的原始顺序（内容集合的读取序，
 * 实测第 0 项是「北齐」而非「先秦」），与视觉上的第一个不一致。
 */
const sortedLanes = computed(() => [...props.lanes].sort((a, b) => a.start - b.start));

const activeLaneId = ref<string>(props.initialLaneId ?? sortedLanes.value[0]?.id ?? '');

const activeLane = computed(
  () => props.lanes.find((l) => l.id === activeLaneId.value) ?? null,
);

const laneItems = computed(() =>
  props.items
    .filter((it) => it.laneId === activeLaneId.value)
    .sort((a, b) => a.year - b.year),
);

/* ---------------- 容器宽度实测 ---------------- */

const scrollEl = ref<HTMLElement | null>(null);
const trackW = ref(960);

let ro: ResizeObserver | null = null;

onMounted(() => {
  if (!scrollEl.value) return;
  ro = new ResizeObserver((entries) => {
    const w = entries[0]?.contentRect.width ?? 960;
    // 幂等：变化小于 8px 不重算。否则布局一变就触发回调，回调又改布局，形成自激。
    if (Math.abs(w - trackW.value) > 8) trackW.value = w;
  });
  ro.observe(scrollEl.value);
});

onBeforeUnmount(() => ro?.disconnect());

/* ---------------- 非线性轴 ---------------- */

/* ---------------- 非线性轴 ---------------- */

/**
 * 标签宽度。段宽与分槽都依赖它，所以放在最前。
 * 窄屏 104px（约 8 个汉字），宽屏 144px（约 11 个汉字）。
 */
const LABEL_W = computed(() => (trackW.value < 500 ? 104 : 144));

/**
 * 段宽（相邻两个事件之间的横向像素）。
 *
 * 关键前提：标签是**上下交错**摆放的，所以同一侧相邻的两个事件之间隔了两个段。
 * 也就是说段宽只需达到标签宽度的一半，同侧就不会相撞。
 * 这让轴总宽比「段宽 = 标签宽」少一半。
 *
 * 三个系数：
 * - MIN_SEG 取标签宽的一半再加一点余量（桌面约 88px）。再小同侧标签会挤。
 * - MAX_SEG 防止个别超长空白（汉朝 105→166 隔 61 年）吃掉整条轴。
 * - 平方根把年份差压成宽度差：差 1 年 → 98px，差 60 年 → 165px。
 *   空白确实更宽，但不会宽到 60 倍。
 */
const MIN_SEG = computed(() => Math.round(LABEL_W.value / 2) + 16);
const MAX_SEG = computed(() => MIN_SEG.value * 2.2);

function segmentWidth(gapYears: number): number {
  // 同年或倒序（数据异常）时给最小宽度，靠上下交错分开
  if (gapYears <= 0) return MIN_SEG.value;
  return Math.min(MAX_SEG.value, MIN_SEG.value + Math.sqrt(gapYears) * 10);
}

/**
 * 每个事件在轴上的左偏移（px）。第一项固定 0。
 *
 * 注意这与「年份 → 百分比」的线性换算完全不同：
 * 位置来自逐段累加，所以年份与坐标的关系不是等比例的。
 */
const xs = computed(() => {
  const list = laneItems.value;
  if (list.length === 0) return [];

  const out: number[] = [0];
  for (let i = 1; i < list.length; i++) {
    const gap = list[i].year - list[i - 1].year;
    out.push(out[i - 1] + segmentWidth(gap));
  }
  return out;
});

/** 轴的总宽：最后一段再补半个标签宽度，避免末尾标签被裁 */
const axisWidth = computed(() => {
  const list = xs.value;
  if (list.length === 0) return 0;
  return Math.round(list[list.length - 1] + LABEL_W.value / 2);
});

/* ---------------- 上下交错分槽 ---------------- */

/**
 * 标签摆放：**按位置交替上下**，而不是「上层塞满再放下层」。
 *
 * 为什么必须强制交替：
 * 早先的实现是「先试上层，满了才放下层」。但段宽本身就是按标签宽度定的，
 * 上层永远放得下 —— 结果所有标签都堆在轴上侧，等于没做交错。
 * 交错的意义不只是省空间，更是让相邻两个标签在垂直方向错开，
 * 读者的眼睛可以顺着「上-下-上-下」的锯齿读下去，不会被同行标签干扰。
 *
 * 规则：
 * 1. 第 i 个事件默认放 `i % 2 === 0 ? 上 : 下`
 * 2. 若该侧与已有标签相撞，换到另一侧
 * 3. 另一侧也相撞，才在同一侧往更外层叠加（兜底，正常不会触发）
 *
 * 因为段宽 ≥ 标签宽的一半，同侧相邻两个事件间隔两段（≥ 一个标签宽），
 * 正常情况下规则 2、3 都不会触发，所有标签恰好是 1 上 1 下交替。
 */
const laidOut = computed(() => {
  const list = laneItems.value;
  const positions = xs.value;
  const labelW = LABEL_W.value;

  /** 各层已占用的最右边缘。up[0] 是紧贴轴的上层，down[0] 是紧贴轴的下层 */
  const up: number[] = [];
  const down: number[] = [];

  /** 某侧第 slot 层能不能放下 x */
  function fits(layers: number[], slot: number, x: number): boolean {
    const last = layers[slot];
    return last === undefined || x - last >= labelW;
  }

  function place(layers: number[], x: number): number {
    let slot = layers.findIndex((last) => x - last >= labelW);
    if (slot === -1) {
      slot = layers.length;
      layers.push(x);
    } else {
      layers[slot] = x;
    }
    return slot;
  }

  return list.map((item, i) => {
    const x = positions[i];
    const preferUp = i % 2 === 0;

    const first = preferUp ? up : down;
    const second = preferUp ? down : up;
    const firstSide = preferUp ? ('up' as const) : ('down' as const);
    const secondSide = preferUp ? ('down' as const) : ('up' as const);

    // 1. 首选侧放得下
    if (fits(first, 0, x)) {
      return { item, x, side: firstSide, slot: place(first, x) };
    }
    // 2. 换到另一侧
    if (fits(second, 0, x)) {
      return { item, x, side: secondSide, slot: place(second, x) };
    }
    // 3. 两侧都满：在首选侧往外叠一层（兜底）
    return { item, x, side: firstSide, slot: place(first, x) };
  });
});

/** 上下各占几层，决定轨道上下留白 */
const upLayers = computed(() =>
  Math.max(1, ...laidOut.value.filter((d) => d.side === 'up').map((d) => d.slot + 1)),
);
const downLayers = computed(() =>
  Math.max(0, ...laidOut.value.filter((d) => d.side === 'down').map((d) => d.slot + 1)),
);

/** 每个槽的纵向间距（px）：一层标签高约 44px，留 8px 间隙 */
const SLOT_STEP = 52;
/** 轴线上下各留的基础距离 */
const AXIS_PAD = 28;

const trackHeight = computed(() => {
  const above = AXIS_PAD + upLayers.value * SLOT_STEP;
  const below = AXIS_PAD + downLayers.value * SLOT_STEP;
  return above + below;
});

/** 轴线在轨道内的 y 位置 */
const axisY = computed(() => AXIS_PAD + upLayers.value * SLOT_STEP);

/**
 * 靠边标签的横向位移。
 *
 * 标签以点为中心（translateX(-50%)）时，首尾标签会溢出。这里算补偿：
 * 左侧不足半个标签宽就右推，右侧同理左推。
 */
const shiftOf = computed(() => {
  const half = LABEL_W.value / 2;
  return laidOut.value.map((d) => {
    if (d.x < half) return half - d.x;
    const right = axisWidth.value - d.x;
    if (right < half) return -(half - right);
    return 0;
  });
});

/* ---------------- 刻度 ---------------- */

/**
 * 政权起止年，标在轴的两端。
 * 不再画均分刻度：非线性轴上「每 100 年一格」是假的，只会误导。
 */
const rangeLabel = computed(() => {
  const l = activeLane.value;
  if (!l) return '';
  return `${shortYear(l.start)} – ${shortYear(l.end)}`;
});

/** 轴是否有横向溢出（用于提示可滑动） */
const overflowHint = ref(false);

function checkOverflow() {
  const el = scrollEl.value;
  if (!el) return;
  overflowHint.value = el.scrollWidth > el.clientWidth + 4;
}

onMounted(() => {
  // 首帧后再测一次：字体加载与 island 挂载都会改变宽度
  requestAnimationFrame(checkOverflow);
});

// 切换政权或容器变化后重测
watch([activeLaneId, axisWidth, trackW], () => requestAnimationFrame(checkOverflow));

/* ---------------- 拖拽平移 ---------------- */

/**
 * 拖动状态。
 *
 * 只在「按下时落在空白处」才启动 —— 标签是 <a>，点在它上面要跳详情页，
 * 拖拽不能抢走那次点击。这也顺带免掉了「拖完松手误触跳转」的老问题：
 * 从空白处开始拖，松手时指针大概率仍在空白处，不会命中标签。
 */
const dragging = ref(false);
let dragFromX = 0;
let dragFromScroll = 0;

function onPointerDown(ev: PointerEvent) {
  const el = scrollEl.value;
  if (!el) return;

  // 点在标签（或标签内的年份/标题）上：交给浏览器处理跳转
  if ((ev.target as HTMLElement).closest('a')) return;

  // 只响应左键。中键、右键留给浏览器默认行为（新标签打开、上下文菜单）
  if (ev.pointerType === 'mouse' && ev.button !== 0) return;

  dragging.value = true;
  dragFromX = ev.clientX;
  dragFromScroll = el.scrollLeft;
  el.setPointerCapture(ev.pointerId);
}

function onPointerMove(ev: PointerEvent) {
  if (!dragging.value) return;
  const el = scrollEl.value;
  if (!el) return;
  // 指针向右移 = 内容跟着右移 = scrollLeft 减小
  el.scrollLeft = dragFromScroll - (ev.clientX - dragFromX);
}

function onPointerUp(ev: PointerEvent) {
  if (!dragging.value) return;
  dragging.value = false;
  scrollEl.value?.releasePointerCapture(ev.pointerId);
}

/* ---------------- 滚轮映射为横向 ---------------- */

/**
 * 把纵向滚轮映射成横向滚动。
 *
 * 普通鼠标只有一个滚轮，而这里横轴才是主体。若不映射，用户会以为「滚不动」。
 *
 * 关键：滚到两端时必须放行（不 preventDefault），否则用户在时间轴上滚到底后
 * 页面就再也滚不动了 —— 这是这类实现最常见的坑。
 */
function onWheel(ev: WheelEvent) {
  const el = scrollEl.value;
  if (!el) return;

  // 触控板的横向滑动（deltaX 主导）交给浏览器原生处理，不要重复叠加
  if (Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) return;

  const maxScroll = el.scrollWidth - el.clientWidth;
  if (maxScroll <= 0) return;

  const atStart = el.scrollLeft <= 0;
  const atEnd = el.scrollLeft >= maxScroll - 1;
  if ((ev.deltaY < 0 && atStart) || (ev.deltaY > 0 && atEnd)) return;

  ev.preventDefault();
  el.scrollLeft += ev.deltaY;
}

/* ---------------- 政权标签条：拖拽 / 滚轮 / 滚到选中项 ---------------- */

const tabsEl = ref<HTMLElement | null>(null);

const tabsDragging = ref(false);
let tabsFromX = 0;
let tabsFromScroll = 0;

/**
 * 标签条的拖拽。
 *
 * 与时间轴同样的取舍：按下时若落在标签上，放行给 click（那是点选政权的主路径）；
 * 只有空白处才启动拖拽。滚轮已在滚动条隐藏的前提下成为主要操作手段，
 * 而拖拽解决「鼠标没有横向滚轮、又不想去够细滚动条」的场景。
 */
function onTabsPointerDown(ev: PointerEvent) {
  const el = tabsEl.value;
  if (!el) return;

  // 点在某个政权标签上：让它被点选
  if ((ev.target as HTMLElement).closest('.lay-b__tab')) return;
  if (ev.pointerType === 'mouse' && ev.button !== 0) return;

  tabsDragging.value = true;
  tabsFromX = ev.clientX;
  tabsFromScroll = el.scrollLeft;
  el.setPointerCapture(ev.pointerId);
}

function onTabsPointerMove(ev: PointerEvent) {
  if (!tabsDragging.value) return;
  const el = tabsEl.value;
  if (!el) return;
  el.scrollLeft = tabsFromScroll - (ev.clientX - tabsFromX);
}

function onTabsPointerUp(ev: PointerEvent) {
  if (!tabsDragging.value) return;
  tabsDragging.value = false;
  tabsEl.value?.releasePointerCapture(ev.pointerId);
}

/** 纵向滚轮映射为标签条的横向滚动。两端放行，否则页面滚不动。 */
function onTabsWheel(ev: WheelEvent) {
  const el = tabsEl.value;
  if (!el) return;
  if (Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) return;

  const maxScroll = el.scrollWidth - el.clientWidth;
  if (maxScroll <= 0) return;

  const atStart = el.scrollLeft <= 0;
  const atEnd = el.scrollLeft >= maxScroll - 1;
  if ((ev.deltaY < 0 && atStart) || (ev.deltaY > 0 && atEnd)) return;

  ev.preventDefault();
  el.scrollLeft += ev.deltaY;
}

/**
 * 把选中的政权标签滚进可见区。
 *
 * 这是「时间线显示唐、顶部却看不到任何高亮」的正解：
 * 唐在标签条第 19 位，若不滚动就永远在视野外，读者会以为没有选中任何政权。
 *
 * 用 scrollLeft 手算而不是 scrollIntoView：后者会把整个页面一起滚动，
 * 用户在页面上方浏览时突然被拽下去，体验很差。
 */
function scrollTabIntoView(id: string) {
  const el = tabsEl.value;
  if (!el) return;
  const tab = el.querySelector<HTMLElement>(`[data-lane-id="${id}"]`);
  if (!tab) return;

  // offsetLeft 相对 offsetParent，这里标签条是定位祖先，可直接用
  const left = tab.offsetLeft;
  const right = left + tab.offsetWidth;
  const viewLeft = el.scrollLeft;
  const viewRight = viewLeft + el.clientWidth;

  // 两侧各留 8px 余量，避免标签贴边
  if (left < viewLeft) el.scrollLeft = left - 8;
  else if (right > viewRight) el.scrollLeft = right - el.clientWidth + 8;
}

/**
 * 切政权或首次挂载后，把选中项滚进视野。
 *
 * 包一层 requestAnimationFrame：字体未加载完时标签宽度会变，
 * 同步测量算出的位置会偏。与 checkOverflow 的处理保持一致。
 */
watch(activeLaneId, (id) => requestAnimationFrame(() => scrollTabIntoView(id)));

onMounted(() => {
  requestAnimationFrame(() => scrollTabIntoView(activeLaneId.value));
});
</script>

<template>
  <div class="lay-b">
    <div
      ref="tabsEl"
      class="lay-b__tabs"
      :class="{ 'lay-b__tabs--dragging': tabsDragging }"
      role="tablist"
      aria-label="政权"
      @pointerdown="onTabsPointerDown"
      @pointermove="onTabsPointerMove"
      @pointerup="onTabsPointerUp"
      @pointercancel="onTabsPointerUp"
      @wheel="onTabsWheel"
    >
      <button
        v-for="l in sortedLanes"
        :key="l.id"
        type="button"
        role="tab"
        :data-lane-id="l.id"
        class="lay-b__tab"
        :class="{ 'lay-b__tab--active': activeLaneId === l.id }"
        :aria-selected="activeLaneId === l.id"
        @click="activeLaneId = l.id"
      >
        <span class="lay-b__dot" :style="{ background: `var(--color-lane-${l.laneIndex})` }" />
        {{ l.label }}
      </button>
    </div>

    <div class="lay-b__stage">
      <div class="lay-b__bar">
        <span class="u-ui lay-b__label-text">{{ activeLane?.label ?? '未选择' }}</span>
        <span class="num u-ui lay-b__range">{{ rangeLabel }}</span>
        <span class="num u-ui lay-b__count">{{ laneItems.length }} 条</span>
      </div>

      <p v-if="!laneItems.length" class="lay-b__empty u-ui">该政权暂无收录事件。</p>

      <template v-else>
        <div
          ref="scrollEl"
          class="lay-b__scroll"
          :class="{ 'lay-b__scroll--dragging': dragging }"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
          @wheel="onWheel"
        >
          <div class="lay-b__track" :style="{ width: `${axisWidth}px`, height: `${trackHeight}px` }">
            <!-- 轴线 -->
            <div class="lay-b__axis" :style="{ top: `${axisY}px` }" />

            <ul class="lay-b__points">
              <li
                v-for="(d, i) in laidOut"
                :key="d.item.id"
                class="lay-b__point"
                :style="{ left: `${d.x}px`, top: `${axisY}px` }"
              >
                <!-- 从事件点引到标签的竖线，表明两者是同一个事件 -->
                <span
                  class="lay-b__stem"
                  :class="`lay-b__stem--${d.side}`"
                  aria-hidden="true"
                />
                <span class="lay-b__marker" />

                <a
                  class="lay-b__label"
                  :class="`lay-b__label--${d.side}`"
                  :href="eventHref(d.item.id)"
                  :title="d.item.title"
                  :style="{
                    transform: `translateX(calc(-50% + ${shiftOf[i]}px))`,
                    top:
                      d.side === 'up'
                        ? `${-(AXIS_PAD + (d.slot + 1) * SLOT_STEP - 8)}px`
                        : `${AXIS_PAD + d.slot * SLOT_STEP + 8}px`,
                  }"
                >
                  <span class="num lay-b__year">{{ shortYear(d.item.year) }}</span>
                  <span class="lay-b__title">{{ d.item.title }}</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <p class="lay-b__hint u-ui">
          <template v-if="overflowHint">
            ← 拖动空白处或滚动滚轮横向查看 · 横轴按事件间隔压缩，非等比例 →
          </template>
          <template v-else>横轴按事件间隔压缩，非等比例</template>
        </p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.lay-b {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

/* ---------- 政权标签条 ---------- */

.lay-b__tabs {
  display: flex;
  gap: var(--sp-1);
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: var(--sp-1);
  border-bottom: 1px solid var(--color-border);
  cursor: grab;
}

.lay-b__tabs::-webkit-scrollbar {
  display: none;
}

/* 拖拽中：光标变抓握，禁掉文字选中，否则横拖会选中一路上的政权名 */
.lay-b__tabs--dragging {
  cursor: grabbing;
  user-select: none;
}

.lay-b__tab {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  padding: 0 var(--sp-3);
  min-height: var(--control-md);
  line-height: var(--control-lh);
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  cursor: pointer;
  font-family: var(--font-ui);
  font-size: var(--fs-sm);
  color: var(--color-ink-muted);
  white-space: nowrap;
}

.lay-b__tab:hover {
  color: var(--color-ink-strong);
}

.lay-b__tab--active {
  color: var(--color-ink-strong);
  border-bottom-color: var(--color-accent);
  font-weight: var(--fw-medium);
  /*
   * 补背景色：标签条有 28 项且可横向滚动，只靠下划线 + 字重
   * 很难在一排里一眼找到当前选中的是哪个。
   */
  background: var(--color-paper-alt);
}

.lay-b__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 1px;
  flex: none;
}

/* ---------- 舞台 ---------- */

.lay-b__stage {
  padding: var(--sp-4) 0;
}

.lay-b__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--sp-3);
  padding: 0 var(--sp-2) var(--sp-4);
  font-size: var(--fs-2xs);
  color: var(--color-ink-faint);
}

.lay-b__label-text {
  letter-spacing: var(--ls-wider);
  text-transform: uppercase;
}

.lay-b__range {
  color: var(--color-accent);
}

.lay-b__count {
  margin-left: auto;
}

/* ---------- 滚动容器 ---------- */

/*
 * 横轴总宽 2400–3100px，超出容器就滚动。
 * touch-action: pan-x 让触屏的横向滑动交给浏览器原生滚动，
 * 纵向仍归页面——否则手指一碰轨道页面就滚不动。
 */
.lay-b__scroll {
  overflow-x: auto;
  overflow-y: hidden;
  padding-inline: var(--sp-2);
  touch-action: pan-x;
  /*
   * 隐藏滚动条，但仍可滚动。
   * Chrome/Safari 走 ::-webkit-scrollbar，Firefox 走 scrollbar-width，
   * 两个都要写才跨浏览器生效。
   *
   * 隐藏的理由：横轴是内容主体，一条灰条横在下面既抢视觉又压缩高度；
   * 而且拖动与滚轮已经覆盖了全部滚动操作。
   */
  scrollbar-width: none;
  cursor: grab;
}

.lay-b__scroll::-webkit-scrollbar {
  display: none;
}

/*
 * 拖拽中：光标变抓握，并禁掉文字选中。
 * 不禁的话横拖会一路选中标签文字，松手后满屏蓝色高亮。
 * 用 class 切换而不是内联样式，拖完能自动恢复。
 */
.lay-b__scroll--dragging {
  cursor: grabbing;
  user-select: none;
}

.lay-b__track {
  position: relative;
  /* 上下两侧的标签是绝对定位的，需要额外空间不被裁切 */
  margin-block: var(--sp-8);
}

.lay-b__axis {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--color-border);
}

.lay-b__points {
  position: relative;
  height: 100%;
}

/* 点位本身占 0 尺寸，标签与竖线以它为锚 */
.lay-b__point {
  position: absolute;
  width: 0;
  height: 0;
}

.lay-b__marker {
  position: absolute;
  top: 0;
  left: 0;
  width: 8px;
  height: 8px;
  /* translate 居中而非负 margin：负 margin 会被 stylelint 的间距规则拦下 */
  transform: translate(-50%, -50%);
  border-radius: var(--radius-full);
  background: var(--color-accent);
  border: 2px solid var(--color-paper);
  transition: transform var(--dur-fast) var(--ease-standard);
}

/* 竖线：从点向上或向下延伸到标签，表明是同一条轴上的事件 */
.lay-b__stem {
  position: absolute;
  left: 0;
  width: 1px;
  background: var(--color-border);
}

.lay-b__stem--up {
  bottom: 0;
  height: 20px;
}

.lay-b__stem--down {
  top: 0;
  height: 20px;
}

/*
 * 标签定位：
 * top 由内联样式给出（按 slot 与方向计算），left 与 transform 也来自内联。
 * 这里只管排版本身。
 */
.lay-b__label {
  position: absolute;
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: max-content;
  max-width: 9rem;
  /* 标签是可点的链接，光标要盖掉容器的 grab */
  cursor: pointer;
}

/* 上层标签贴底对齐（文字向上长），下层标签贴顶对齐 */
.lay-b__label--up {
  align-items: center;
  text-align: center;
  transform-origin: bottom center;
}

.lay-b__label--down {
  align-items: center;
  text-align: center;
  transform-origin: top center;
}

.lay-b__year {
  font-size: var(--fs-2xs);
  color: var(--color-accent);
  white-space: nowrap;
}

/* 超长标题单行截断，完整内容在 title 属性里 */
.lay-b__title {
  font-size: var(--fs-xs);
  color: var(--color-ink-muted);
  line-height: var(--lh-normal);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.lay-b__label:hover .lay-b__title {
  color: var(--color-ink-strong);
}

.lay-b__label:hover ~ .lay-b__marker,
.lay-b__point:hover .lay-b__marker {
  transform: translate(-50%, -50%) scale(1.4);
}

/* ---------- 提示与空态 ---------- */

.lay-b__hint {
  margin-top: var(--sp-2);
  padding-inline: var(--sp-2);
  font-size: var(--fs-2xs);
  color: var(--color-ink-faint);
}

.lay-b__empty {
  padding: var(--sp-10);
  text-align: center;
  font-size: var(--fs-sm);
  color: var(--color-ink-faint);
}

/* ---------- 窄屏 ---------- */

@media (max-width: 767px) {
  .lay-b__label {
    max-width: 6.5rem;
  }

  .lay-b__bar {
    gap: var(--sp-2);
  }
}
</style>
