'use client';

/** 暗色模式：class 策略 + localStorage 持久化（初始值由 layout 中挂载前内联脚本决定，避免闪烁）
 *  并在主题切换时同步 <meta name="theme-color">，修复 iOS Safari 信号栏/地址栏不跟随站内主题的问题 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { THEME_KEY, THEME_COLOR_LIGHT, THEME_COLOR_DARK, resolveInitialDark } from '@/lib/theme';

export { THEME_KEY, THEME_COLOR_LIGHT, THEME_COLOR_DARK, resolveInitialDark };

const ThemeContext = createContext<{ dark: boolean; toggle: () => void }>({ dark: false, toggle: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(resolveInitialDark());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    // iOS 26/27 状态栏颜色来自 html/body 背景采样（header 有 backdrop-filter 时停止采样顶部条、
    // 回退 html/body 背景），且只在滚动/布局变化时重读（WebKit 306074/319479）。
    // 因此切主题后：① 同步 theme-color meta（兼容 iOS 15-17）② 强制 1px 滚动触发 iOS 重采样。
    const color = dark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT;
    let metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    if (metas.length === 0) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = color;
      document.head.appendChild(meta);
    } else {
      metas.forEach((m) => m.setAttribute('content', color));
      for (let i = 1; i < metas.length; i++) metas[i].remove();
    }
    try {
      localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
    // 强制 iOS 重读状态栏背景：向下滚 1px（滚动时重采样）再恢复原位；不可滚动时用 opacity 抖动触发重绘
    requestAnimationFrame(() => {
      try {
        const y = window.scrollY;
        window.scrollTo(0, y + 1);
        requestAnimationFrame(() => {
          if (window.scrollY !== y) {
            window.scrollTo(0, y);
          } else {
            document.documentElement.style.opacity = '0.9999';
            requestAnimationFrame(() => {
              document.documentElement.style.opacity = '';
            });
          }
        });
      } catch {
        /* ignore */
      }
    });
  }, [dark, mounted]);

  const toggle = () => setDark((d) => !d);

  return <ThemeContext.Provider value={{ dark, toggle }}>{children}</ThemeContext.Provider>;
}
