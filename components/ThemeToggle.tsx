'use client';

/** 主题切换胶囊开关：太阳/月亮滑块滑动切换（纸墨风，克制无多余动效） */
import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { dark, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? '切换到浅色模式' : '切换到暗色模式'}
      title={dark ? '切换到浅色模式' : '切换到暗色模式'}
      className="theme-toggle"
    >
      <span className={`theme-toggle-knob ${dark ? 'on' : ''}`}>
        {dark ? (
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="4.5" stroke="currentColor" strokeWidth="1.7" />
            <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M15.7 4.3l-1.4 1.4M5.7 14.3l-1.4 1.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M14.2 6.2a5 5 0 1 0 0 7.6 6.5 6.5 0 0 1-9.4-8.2A6 6 0 0 0 14.2 6.2z" fill="currentColor" />
          </svg>
        )}
      </span>
    </button>
  );
}
