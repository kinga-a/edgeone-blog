import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /* 强调色：低饱和浅青蓝（teal 系） */
        brand: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        /* 中性色：柔和米白 / 深灰（暖灰系），低饱和、长时间阅读舒适 */
        slate: {
          50: '#faf9f7',
          100: '#f3f1ec',
          200: '#e6e2da',
          300: '#d4cfc4',
          400: '#a8a196',
          500: '#8a8378',
          600: '#6b6459',
          700: '#4b453c',
          800: '#2b2823',
          900: '#1c1a17',
          950: '#141210',
        },
        ink: {
          DEFAULT: '#1c1a17',
          soft: '#6b6459',
        },
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'PingFang SC',
          'Microsoft YaHei',
          'Segoe UI',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
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
