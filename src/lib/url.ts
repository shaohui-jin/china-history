/**
 * 站内路径工具。
 *
 * 为什么需要它：GitHub Pages 的项目站部署在子路径下
 * （https://user.github.io/repo/），此时站内绝对链接 `/people/x`
 * 会指向域名根而非仓库根，全部 404。
 *
 * Astro 提供 import.meta.env.BASE_URL（构建时由 base 配置注入），
 * 手动拼接是最可靠的做法——比相对路径稳定，比第三方库轻。
 *
 * 用法：
 *   import { url } from '../lib/url';
 *   <a href={url('people/zhuge-liang')}>…</a>
 *   <a href={url('/timeline')}>…</a>          // 前导斜杠可有可无
 *   <a href={url('graph?focus=zhuge-liang')}>  // query 原样保留
 */

/** BASE_URL 已保证以 / 结尾（'/' 或 '/repo/'） */
function base(): string {
  const b = import.meta.env.BASE_URL ?? '/';
  return b.endsWith('/') ? b : b + '/';
}

/**
 * 把站内路径补全为带 base 前缀的绝对路径。
 *
 * - 传入 'people/x' 或 '/people/x' 结果相同
 * - 外部链接（http://、https://、//、mailto:）原样返回
 * - 只传 '/' 时返回 base 本身（首页）
 */
export function url(path: string): string {
  // 外部链接不动
  if (/^(https?:)?\/\//.test(path) || path.startsWith('mailto:') || path.startsWith('#')) {
    return path;
  }

  const b = base();
  // 去掉前导斜杠，避免 base 后出现双斜杠
  const clean = path.replace(/^\/+/, '');
  return clean === '' ? b : b + clean;
}
