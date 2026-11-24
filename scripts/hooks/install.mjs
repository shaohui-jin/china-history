/**
 * 把 scripts/hooks/ 下的钩子装到 .git/hooks/。
 *
 * 为什么需要这一步：.git/hooks 不进版本控制，新人 clone 下来什么也没有。
 * 由 package.json 的 prepare 脚本自动调用，npm install 后即生效。
 *
 * 覆盖策略：只覆盖「本脚本装的」和「不存在的」。别的钩子（比如临时写的）
 * 不静默覆盖，而是提示一句然后跳过 —— 钩子是开发者环境，误覆盖的代价
 * 比漏装更高。
 *
 * 用 Node 而不是 sh：Windows 下 npm 的 shell 不保证有 sh，而 node 是
 * 本项目的既定依赖。
 */
import { copyFileSync, existsSync, chmodSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = join(root, 'scripts', 'hooks');
const dst = join(root, '.git', 'hooks');

/** 需要安装的钩子名 */
const HOOKS = ['commit-msg'];

/** 用哪个标记判断「这个钩子是本脚本装的」 */
const MARKER = 'strip-ai-trailers';

function main() {
  // 不是 git 仓库（比如从 tarball 安装）就安静退出，不该因此让 npm install 失败
  if (!existsSync(dst)) {
    try {
      mkdirSync(dst, { recursive: true });
    } catch {
      return;
    }
  }

  for (const hook of HOOKS) {
    const from = join(src, hook);
    if (!existsSync(from)) continue;

    const to = join(dst, hook);
    if (existsSync(to)) {
      const existing = readFileSync(to, 'utf8');
      if (!existing.includes(MARKER)) {
        console.log(`[hooks] .git/hooks/${hook} 已存在且不是本脚本装的，跳过（如需安装请手动合并）`);
        continue;
      }
    }

    copyFileSync(from, to);
    try {
      chmodSync(to, 0o755);
    } catch {
      // Windows 上 chmod 是空操作，忽略
    }
    console.log(`[hooks] 已安装 ${hook}`);
  }
}

main();
