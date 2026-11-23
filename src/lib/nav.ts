/**
 * 实体路徑构造器。
 *
 * 为什么单独一个文件：`url()` 依赖 `import.meta.env.BASE_URL`，在 .astro 里
 * 可以直接用，但 Vue 组件里如果手写模板字符串 `` `/people/${id}` ``，
 * 就会绕过 BASE_PATH —— GitHub Pages 项目站（base = '/<repo>'）下直接 404。
 *
 * 已有 5 处犯过这个错（RelationList / RelationGraph / GraphExplorer /
 * TimelineVertical）。统一走这里，任何人加新链接都不会漏掉 base。
 *
 * 用法：
 *   import { personHref, eventHref } from '../../lib/nav';
 *   <a :href="personHref(r.id)">…</a>
 */
import { url } from './url';

/** 人物传记页 */
export function personHref(id: string): string {
  return url(`people/${id}`);
}

/** 事件详情页 */
export function eventHref(id: string): string {
  return url(`events/${id}`);
}

/** 政权（朝代）页 */
export function dynastyHref(id: string): string {
  return url(`dynasties/${id}`);
}

/** 时间线页，可带 focus 参数 */
export function timelineHref(focus?: string): string {
  return focus ? url(`timeline?focus=${encodeURIComponent(focus)}`) : url('timeline');
}

/** 图谱页，可带 focus / depth */
export function graphHref(focus?: string, depth?: number): string {
  const params = new URLSearchParams();
  if (focus) params.set('focus', focus);
  if (depth !== undefined) params.set('depth', String(depth));
  const qs = params.toString();
  return qs ? url(`graph?${qs}`) : url('graph');
}
