/**
 * subset-font 没有自带类型声明，这里补最小可用定义。
 * 该包基于 harfbuzz 的 wasm 版做字体子集化。
 */
declare module 'subset-font' {
  interface SubsetFontOptions {
    /** 输出格式，支持 'sfnt' | 'woff' | 'woff2' | 'truetype' */
    targetFormat?: 'sfnt' | 'woff' | 'woff2' | 'truetype';
    /** 保留哪些 OpenType 特性表，默认去掉大部分 */
    preserveNameIds?: number[];
    /** 变体字体的轴设置 */
    variationAxes?: Record<string, number | { min: number; max: number; default: number }>;
  }

  /** 用给定的文本子集化字体，返回新字体的字节 */
  function subsetFont(
    font: Buffer | Uint8Array,
    text: string,
    options?: SubsetFontOptions,
  ): Promise<Buffer>;

  export = subsetFont;
}
