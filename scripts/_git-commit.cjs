/**
 * 用 commit-tree 提交，避开 shell 包装层自动追加的 Co-authored-by trailer。
 *
 * 用法：node scripts/_git-commit.cjs <消息文件路径>
 * 消息文件用 UTF-8 无 BOM 写入。
 */
const { execFileSync } = require('child_process');
const { readFileSync, unlinkSync } = require('fs');

const msgFile = process.argv[2];
if (!msgFile) { console.error('缺少消息文件路径'); process.exit(1); }

const git = (args, opts = {}) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts });

// 1. 写 tree
const tree = git(['write-tree']).trim();
console.log('tree =', tree);

// 2. 取父提交
let parent = null;
try { parent = git(['rev-parse', 'HEAD']).trim(); } catch { /* 首个提交 */ }

// 3. 构造提交
const args = ['commit-tree', tree];
if (parent) args.push('-p', parent);
args.push('-F', msgFile);

const newHash = git(args).trim();
console.log('commit =', newHash);

// 4. 移动分支并更新 index（不碰工作区）
git(['update-ref', 'refs/heads/master', newHash]);
git(['reset', '--soft', newHash]);

// 5. 校验没有 trailer
const body = git(['log', '-1', '--format=%B', newHash]);
if (/Co-authored-by:\s*Cursor|cursoragent/i.test(body)) {
  console.error('!! 提交信息仍含 Cursor trailer，已中止');
  process.exit(1);
}
console.log('✓ 提交信息干净');

unlinkSync(msgFile);
console.log('---');
console.log(git(['log', '--oneline', '-1']));
