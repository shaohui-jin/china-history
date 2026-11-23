import { readFileSync } from 'node:fs';
const file = process.argv[2] ?? 'docs/baseline/lighthouse-mobile.json';
const r = JSON.parse(readFileSync(file, 'utf8'));
const a = r.audits;
const pct = (s) => (s == null ? 'n/a' : (s * 100).toFixed(0));
console.log('source  ', file);
console.log('score   ', pct(r.categories.performance.score));
for (const k of ['first-contentful-paint', 'largest-contentful-paint', 'speed-index', 'total-blocking-time', 'cumulative-layout-shift']) {
  console.log(k.padEnd(26), a[k]?.displayValue);
}
const net = a['network-requests'].details.items;
console.log('requests', net.length, '| total KB', (a.diagnostics.details.items[0].totalByteWeight / 1024).toFixed(0));
console.log('\n-- 资源 --');
for (const i of net.sort((x, y) => y.transferSize - x.transferSize).slice(0, 10)) {
  // 只打印 pathname：不同端口 / 不同 base 下都能读，不会残留 localhost:4331 之类硬编码
  const path = new URL(i.url).pathname;
  console.log(String((i.transferSize / 1024).toFixed(0)).padStart(5) + 'KB  ' + (i.resourceType ?? '').padEnd(10) + ' ' + path);
}
const rb = a['render-blocking-insight'];
console.log('\nrender-blocking:', rb?.score, rb?.displayValue ?? '', JSON.stringify(rb?.details?.items ?? []).slice(0, 300));
console.log('LCP element:', a['lcp-breakdown-insight']?.details?.items?.[1]?.selector ?? '');
console.log('LCP subparts:', JSON.stringify(a['lcp-breakdown-insight']?.details?.items?.[0]?.items ?? []));
