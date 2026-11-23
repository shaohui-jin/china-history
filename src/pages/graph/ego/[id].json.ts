/**
 * 图谱数据端点：为每个人物预生成二跳 ego 网络。
 *
 * 为什么不用客户端 import 全部数据：人物关系表在规模上来后会很大，
 * 一个人只看一个人的圈子，没必要下载所有人的关系。
 * 这里按 id 分文件，客户端按需 fetch。
 *
 * 注意：.ts 端点文件不能用 `---` frontmatter，直接写 ES 模块。
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { loadIndex, getEgoNetwork } from '../../../lib/content';

export const getStaticPaths: GetStaticPaths = async () => {
  const index = await loadIndex();
  return [...index.people.keys()].map((id) => ({ params: { id } }));
};

export const GET: APIRoute = async ({ params }) => {
  const id = params.id;
  if (!id) return new Response('missing id', { status: 400 });

  // 一次给到 2 跳，客户端可自由切换 depth 而无需再请求
  const net = await getEgoNetwork([id], 2, 200);

  return new Response(JSON.stringify(net), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
