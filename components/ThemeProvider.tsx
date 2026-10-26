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
    // iOS Safari 监听 theme-color meta 的 content 属性变化即时刷新信号栏/地址栏
    // （remove/append 替换节点不触发，必须 setAttribute 原地改）；随后去重保单 meta。
    // 色值与页面主体背景（--t-slate-50/900）一致
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
  }, [dark, mounted]);

  const toggle = () => setDark((d) => !d);

  return <ThemeContext.Provider value={{ dark, toggle }}>{children}</ThemeContext.Provider>;
}
