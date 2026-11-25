/**
 * 读者纠错：拼 GitHub 新建 issue 的预填 URL。
 *
 * 为什么用 GitHub Issue 而不做站内表单：
 * 本站是纯静态部署（GitHub Pages），没有接收端。做站内表单需要把仓库的
 * 写权限 token 放在服务端，任何人打开站点就能用它往仓库写文件，
 * 还要额外加验证码与限流。而 GitHub 的 issue 编辑框本身就是完整的
 * markdown 环境 —— 用户可以直接 Ctrl+V 粘贴截图，GitHub 自动上传到
 * 它的图床并插入图片链接，比自建上传更好用。
 *
 * URL 长度：正文模板约 500 字，encodeURIComponent 后约 1.5KB，
 * GitHub 对 URL 的上限约 8KB，余量充足。
 */

/** 仓库全名，用于拼 issue 地址 */
const REPO = 'shaohui-jin/china-history';

/** 仓库主页，页脚「源码」链接用 */
export const REPO_URL = `https://github.com/${REPO}`;

export type ReportKind = 'event' | 'person' | 'polity' | 'page';

export interface ReportContext {
  kind: ReportKind;
  /** 条目标题，如「赤壁之战」。栏目页传栏目名 */
  title: string;
  /** 页面完整 URL */
  url: string;
}

/** 页面类型 → 模板里显示的中文名 */
const KIND_LABEL: Record<ReportKind, string> = {
  event: '事件',
  person: '人物',
  polity: '政权',
  page: '页面',
};

/**
 * 拼正文模板。
 *
 * 用「问题类型」复选框而非正文自由书写：多数纠错是「史料引错了」
 * 或「年代写错了」这两类，勾选比让读者自己想怎么描述更省事。
 *
 * 「依据」一节是必填的 —— 本站的编辑原则是所有史实必须能溯源，
 * 不能因为读者提了就以「大概是对的」收入。
 */
function buildBody(ctx: ReportContext): string {
  return `## 页面

- 类型：${KIND_LABEL[ctx.kind]}
- 标题：${ctx.title}
- 链接：${ctx.url}

## 问题类型

- [ ] 史实错误（时间、人物、地点、事件经过）
- [ ] 史料引用错误（书名、卷次、引文与原文不符）
- [ ] 文字错误（错别字、标点、断句）
- [ ] 排版或功能问题
- [ ] 其他

## 具体说明

（请描述您发现的问题，指出错误的内容与正确的说法）

## 依据

（请提供可查证的出处：书名卷次、页码或可靠链接。
本站的编辑原则是所有史实必须能溯源，这一项很重要）

## 截图（可选）

直接把截图粘贴到这里即可，GitHub 会自动上传。

---
由站点页脚的「报告错误」进入。
`;
}

/**
 * 生成 GitHub 新建 issue 的 URL。
 *
 * title 里的方括号会被编码成 %5B/%5D，GitHub 解码后正常显示为 [纠错]。
 * labels 若在仓库中不存在，GitHub 会静默忽略该参数，issue 仍能正常提交。
 */
export function reportIssueUrl(ctx: ReportContext): string {
  const params = new URLSearchParams({
    title: `[纠错] ${ctx.title}`,
    body: buildBody(ctx),
    labels: '纠错',
  });
  return `https://github.com/${REPO}/issues/new?${params.toString()}`;
}

/**
 * 从站内路径推断页面类型。
 *
 * 为什么在 Base 里推断而不是让每个页面传：8 个页面都传一遍容易漏，
 * 且新增页面时又会忘。路径前缀是稳定的约定，比人工传参可靠。
 */
export function inferKind(pathname: string): ReportKind {
  if (pathname.includes('/events/')) return 'event';
  if (pathname.includes('/people/')) return 'person';
  if (pathname.includes('/dynasties/')) return 'polity';
  return 'page';
}

/**
 * 把 Base 的 title 清洗成条目标题。
 *
 * 各页 title 的格式是「标题 · 史鉴」，首页是「史鉴 · 中国历史图谱」。
 * 去掉站名后缀，首页单独给一个可读的名字 —— 否则会变成「史鉴」，
 * 在 issue 标题里看不出指的是哪个页面。
 */
export function cleanTitle(title: string): string {
  if (title.startsWith('史鉴')) return '首页';
  return title.replace(/\s*·\s*史鉴\s*$/, '').trim() || '未命名页面';
}
