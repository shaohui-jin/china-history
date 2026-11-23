/**
 * Pagefind 是构建产物，不在 node_modules 里，TypeScript 找不到它。
 * 这里给出最小可用的类型声明，避免动态 import 报错。
 */
declare module '/pagefind/pagefind.js' {
  export interface PagefindResultData {
    url: string;
    excerpt: string;
    meta: Record<string, string | undefined>;
    content?: string;
    word_count?: number;
  }

  export interface PagefindResult {
    data: () => Promise<PagefindResultData>;
  }

  export function search(query: string): Promise<{ results: PagefindResult[] }>;
  export function options(opts: Record<string, unknown>): Promise<void>;
  export function init(): Promise<void>;
}
