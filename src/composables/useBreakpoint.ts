/**
 * 断点状态。
 *
 * 为什么需要它：canvas 与 Cytoscape 拿不到 media query 的结果。
 * 组件必须知道当前断点，才能选对应的 LOD 阈值、泳道高度、节点上限。
 *
 * 实现要点：
 * - 用 matchMedia 而不是监听 resize：resize 每秒触发几十次，matchMedia 只在跨断点时触发一次。
 * - SSR 安全：初始值固定为 'lg'，onMounted 后再读真实值，避免 hydration mismatch。
 * - 模块级单例：多个组件共享同一份监听，不重复注册。
 */
import { onBeforeUnmount, onMounted, readonly, ref } from 'vue';
import { breakpoint, type BreakpointKey } from '../design/tokens';

const ORDER: BreakpointKey[] = ['sm', 'md', 'lg', 'xl'];

/** 由视口宽度推算断点（取满足条件的最大断点） */
function resolve(width: number): BreakpointKey {
  // 从大到小找第一个满足的
  for (let i = ORDER.length - 1; i >= 0; i--) {
    const key = ORDER[i];
    if (width >= breakpoint[key]) return key;
  }
  return 'sm';
}

const current = ref<BreakpointKey>('lg');

let initialized = false;
let mqls: MediaQueryList[] = [];
let listeners: Array<{ mql: MediaQueryList; fn: (e: MediaQueryListEvent) => void }> = [];

function ensureInit() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const update = () => {
    current.value = resolve(window.innerWidth);
  };

  update();

  // 每个断点一条查询，跨过任一边界都会触发一次
  mqls = (Object.keys(breakpoint) as BreakpointKey[]).map(
    (k) => window.matchMedia(`(min-width: ${breakpoint[k]}px)`),
  );
  listeners = mqls.map((mql) => {
    const fn = () => update();
    mql.addEventListener('change', fn);
    return { mql, fn };
  });
}

/** 只读断点 ref。首次调用时自动接管监听。 */
export function useBreakpoint() {
  onMounted(ensureInit);
  return readonly(current);
}

/** 供非组件环境（如工具函数）读取当前断点 */
export function getBreakpoint(): BreakpointKey {
  if (typeof window === 'undefined') return 'lg';
  return resolve(window.innerWidth);
}

/** 是否为窄屏（手机形态），用于选择组件而非样式 */
export function isNarrow(bp: BreakpointKey): boolean {
  return bp === 'sm';
}

/** 清理监听（仅在需要热更新或测试时使用） */
export function disposeBreakpoint() {
  for (const { mql, fn } of listeners) mql.removeEventListener('change', fn);
  listeners = [];
  mqls = [];
  initialized = false;
}

// 卸载时不销毁全局监听：断点是全站共享的，组件反复挂载不该重复注册
onBeforeUnmount(() => {
  /* intentionally empty：保持单例存活 */
});
