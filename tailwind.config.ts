import type { Config } from 'tailwindcss';

/**
 * 「纸墨编辑风」设计系统（参考 blog.y11.fun 美化原型设计规范）：
 * - slate 系：暖纸底 + 墨色文字（亮/暗共用一阶，暗色下自然呈暖墨黑底）
 * - brand 系：朱砂强调色，CSS 变量驱动，暗色模式自动提亮（#E08A5A）
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'var(--t-brand-50)',
          100: 'var(--t-brand-100)',
          200: 'var(--t-brand-200)',
          300: 'var(--t-brand-300)',
          400: 'var(--t-brand-400)',
          500: 'var(--t-brand-500)',
          600: 'var(--t-brand-600)',
          700: 'var(--t-brand-700)',
          800: 'var(--t-brand-800)',
          900: 'var(--t-brand-900)',
        },
        slate: {
          50: 'var(--t-slate-50)',
          100: 'var(--t-slate-100)',
          200: 'var(--t-slate-200)',
          300: 'var(--t-slate-300)',
          400: 'var(--t-slate-400)',
          500: 'var(--t-slate-500)',
          600: 'var(--t-slate-600)',
          700: 'var(--t-slate-700)',
          800: 'var(--t-slate-800)',
          900: 'var(--t-slate-900)',
          950: 'var(--t-slate-950)',
        },
        ink: {
          DEFAULT: '#292524',
          soft: '#57534E',
        },
      },
      fontFamily: {
        display: [
          '"Noto Serif SC"',
          '"Source Han Serif SC"',
          '"Source Han Serif CN"',
          '"Songti SC"',
          'STSong',
          'SimSun',
          'serif',
        ],
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'PingFang SC',
          'Microsoft YaHei',
          'Segoe UI',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', '"JetBrains Mono"', 'monospace'],
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            code: {
              fontWeight: '400',
            },
          },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};

export default config;
