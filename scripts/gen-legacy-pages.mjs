/**
 * 构建后为旧 id 生成跳转页，保住 /people/<旧id>/ 与 /events/<旧id>/。
 *
 * 为什么不在 Astro 里做：旧 id 与新 id 同属 [id].astro 这一个动态路由，
 * 在 Astro 的 getStaticPaths 里无法同时产出「内容页」与「跳转页」——
 * 同一路径只能有一个产物。放到构建后直接写 dist 最省事。
 *
 * 用法：npm run build 会自动调用（见 package.json 的 build 脚本）。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');

/** 从 legacy-ids.ts 里抽出映射（避免为构建引入 TS 运行时） */
function loadMap(name) {
  const p = join(ROOT, 'src', 'lib', 'legacy-ids.ts');
  const text = readFileSync(p, 'utf8');
  const block = text.match(new RegExp(`${name}[^{]*\\{([\\s\\S]*?)\\}`));
  if (!block) return [];
  const pairs = [];
  for (const m of block[1].matchAll(/'([^']+)':\s*'([^']+)'/g)) {
    pairs.push([m[1], m[2]]);
  }
  return pairs;
}

/** BASE_PATH 可能是 '/repo'，跳转必须带上前缀 */
const BASE = (process.env.BASE_PATH ?? '/').replace(/\/$/, '');

function page(target, label) {
  return `<!doctype html>
<html lang="zh-Hans">
<head>
<meta charset="utf-8">
<title>页面已迁移</title>
<link rel="canonical" href="${target}">
<meta http-equiv="refresh" content="0; url=${target}">
<meta name="robots" content="noindex">
<style>
body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.7;color:#333}
a{color:#8b4513}
</style>
</head>
<body>
<p>此${label}已迁移到新地址。</p>
<p><a href="${target}">若未自动跳转，请点击这里</a></p>
</body>
</html>
`;
}

if (!existsSync(DIST)) {
  console.error('dist 不存在，先跑 npm run build');
  process.exit(1);
}

let written = 0;
for (const [collection, mapName, label] of [
  ['people', 'legacyPeopleIds', '条目'],
  ['events', 'legacyEventIds', '事件'],
]) {
  const pairs = loadMap(mapName);
  for (const [oldId, newId] of pairs) {
    const target = `${BASE}/${collection}/${newId}/`;
    const outPath = join(DIST, collection, oldId, 'index.html');
    // 若新 id 恰好等于旧 id（不该发生），跳过，避免覆盖正文页
    if (existsSync(join(DIST, collection, oldId)) && oldId === newId) continue;
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, page(target, label), 'utf8');
    written++;
  }
}

console.log(`[legacy-redirect] 已生成 ${written} 个跳转页`);
