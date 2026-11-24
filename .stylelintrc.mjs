/**
 * 样式 lint：约束设计令牌的使用。
 *
 * 目标不是统一代码风格（那交给 prettier），而是防住这一类错误：
 * 有人直接写 #ff0000 / 14px / 1.5rem，绕过 tokens.generated.css 的令牌，
 * 于是换主题色或调字号时漏掉一处，页面出现对不齐的颜色与间距。
 *
 * 规则：
 * - 颜色必须 var(--color-*)
 * - 间距必须 var(--sp-*)
 * - 字号必须 var(--fs-*)
 * - 字重必须 var(--fw-*)
 *
 * 允许白名单：var() / 关键字（inherit、transparent、currentColor…）/
 * 函数式颜色（color-mix、rgb 内嵌在 var 里）/ 0 值 / 百分比。
 */
export default {
  extends: ['stylelint-config-standard'],
  plugins: ['stylelint-declaration-strict-value'],
  ignoreFiles: [
    // 生成物，内容由 scripts/gen-tokens.ts 与 build-fonts.ts 决定
    'src/styles/tokens.generated.css',
    'src/styles/fonts.generated.css',
    'dist/**',
    'node_modules/**',
  ],
  overrides: [
    {
      files: ['**/*.vue'],
      customSyntax: 'postcss-html',
    },
  ],
  rules: {
    'scale-unlimited/declaration-strict-value': [
      ['/color/', 'fill', 'stroke'],
      {
        ignoreVariables: true,
        ignoreFunctions: true,
        ignoreValues: {
          '': [
            'inherit',
            'transparent',
            'currentColor',
            'none',
            'unset',
            'initial',
            'revert',
            'auto',
          ],
        },
        disableFix: true,
        message: '颜色必须用 var(--color-*)，不要写裸色值',
      },
    ],

    /**
     * 间距与字号：**rem 必须走令牌，px / em 放行**。
     *
     * 为什么只禁 rem：
     * - 手写 rem 是真实风险。`gap: 1.25rem` 与 `--sp-5` 是同一个值，
     *   日后调整令牌刻度时，这一处会被漏掉，于是间距体系出现一个特例。
     * - px 与 em 在本项目里有明确的合法用途：
     *   · SVG 内部的 1:1 像素设计（EgoGraphDesktop 的 9px/10.5px/12px）
     *   · 1px/2px 这类描边级的微调（令牌刻度里没有这么细的值）
     *   · em 用于相对字号（0.7em 的上标、0.9em 的注文）
     *   强行令牌化这些会迫使在令牌表里塞进 2px、4.8px 这类无意义的项，
     *   反而破坏刻度。
     *
     * 规则：只要值里出现 `rem` 单位，就必须整体是 var(--sp-*) / var(--fs-*)。
     * calc() 内部出现 rem 也会被拦 —— 这是有意的，逼你把它写成令牌表达式。
     */
    'declaration-property-value-disallowed-list': [
      {
        '/^(margin|margin-top|margin-bottom|margin-left|margin-right|margin-inline|margin-block|margin-inline-start|margin-inline-end|padding|padding-top|padding-bottom|padding-left|padding-right|padding-inline|padding-block|padding-inline-start|padding-inline-end|gap|row-gap|column-gap|font-size)$/':
          [/rem/],
      },
      {
        message:
          'rem 间距/字号必须走令牌：用 var(--sp-N) / var(--fs-N)。' +
          '刻度外的微调请用 px（如 2px），SVG 内可用 px，相对字号用 em。',
      },
    ],

    /*
     * 控件高度必须走三档令牌：var(--control-sm|md|lg)。
     *
     * 2026-11 之前，9 个交互控件用了 var(--touch-target) / 2rem /
     * 1.875rem / 32px 四种写法，同一页面里按钮高矮参差。根因不是
     * 缺少刻度，而是没人拦着写裸值。
     *
     * disallowed-list 的「允许值」是白名单语义：这里只放行三种令牌
     * 与 0，其余一律报错。容器高度（画布占位等）改用 height，
     * 不走 min-height，因此不会被这条规则误伤。
     */
    'declaration-property-value-allowed-list': [
      {
        'min-height': [
          'var(--control-sm)',
          'var(--control-md)',
          'var(--control-lg)',
          '0',
        ],
      },
      {
        message:
          '控件高度必须用三档令牌：var(--control-sm|md|lg)，并配套 line-height: var(--control-lh)。' +
          '容器占位高度请改用 height 或 aspect-ratio。',
      },
    ],

    /*
     * 控件高度必须走三档令牌。
     *
     * 2026-11 之前，9 个交互控件用了 var(--touch-target) / 2rem /
     * 1.875rem / 32px 四种写法，同一页面里按钮高矮参差。根因不是
     * 缺少刻度，而是没人拦着写裸值。
     *
     * 用 strict-value 而不是 disallowed-list：后者的值匹配不支持
     * 负向先行断言，写不出「只要不是 var(--control-*) 就报错」。
     */
    'scale-unlimited/declaration-strict-value': [
      ['color', 'background-color', 'border-color', 'fill', 'stroke'].map((p) =>
        p === 'color' ? '/color/' : p,
      ),
      {
        ignoreVariables: true,
        ignoreFunctions: true,
        ignoreValues: {
          '': [
            'inherit',
            'transparent',
            'currentColor',
            'none',
            'unset',
            'initial',
            'revert',
            'auto',
          ],
        },
        disableFix: true,
        message: '颜色必须用 var(--color-*)，不要写裸色值',
      },
    ],

    // 以下几条放宽，避免与现有代码风格大量冲突
    'custom-property-pattern': null,
    'selector-class-pattern': null,
    'no-descending-specificity': null,
    'declaration-block-no-redundant-longhand-properties': null,
    'comment-empty-line-before': null,
    'declaration-empty-line-before': null,
    'at-rule-empty-line-before': null,
    'rule-empty-line-before': null,
    'value-keyword-case': null,
    'alpha-value-notation': null,
    'color-function-notation': null,
    'font-family-name-quotes': null,
    'shorthand-property-no-redundant-values': null,
    'media-feature-range-notation': null,
    'length-zero-no-unit': null,
    'number-max-precision': null,
    // iOS Safari 仍需要 -webkit-text-size-adjust，保留前缀
    'property-no-vendor-prefix': null,
    'selector-pseudo-class-no-unknown': [
      true,
      { ignorePseudoClasses: ['global', 'deep', 'slotted'] },
    ],
  },
};
