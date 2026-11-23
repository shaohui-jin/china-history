/**
 * robots.txt 动态端点。
 *
 * 为什么不放 public/：public 下是静态文件，域名或 base 变了不会跟着变。
 * 这里读 `import.meta.env.SITE`（构建时由 SITE_URL 注入），
 * 本地 dev、子路径部署、自定义域名三种情况都能输出正确的 sitemap 地址。
 */
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  /**
   * 注意：`site` 只含 origin（https://user.github.io），**不含 base**。
   * 项目站部署在 /<repo>/ 下，sitemap 也在那个前缀里，所以必须自己拼
   * BASE_URL，否则 robots 指向一个不存在的地址。
   */
  const baseRaw = import.meta.env.BASE_URL ?? '/';
  // BASE_URL 已保证以 / 结尾（'/' 或 '/repo/'），直接拼即可
  const base = baseRaw.endsWith('/') ? baseRaw : `${baseRaw}/`;
  const sitemapUrl = site ? new URL(`${base}sitemap-index.xml`, site).href : null;

  const lines = ['User-agent: *', 'Allow: /'];

  if (sitemapUrl) {
    lines.push('', `Sitemap: ${sitemapUrl}`);
  }

  return new Response(lines.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
