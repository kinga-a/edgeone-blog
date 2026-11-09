'use client';

/** 暗色模式：class 策略 + localStorage 持久化（在应用挂载前注入初始脚本避免闪烁） */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const ThemeContext = createContext<{ dark: boolean; toggle: () => void }>({ dark: false, toggle: () => {} });

const THEME_KEY = 'blog-theme';

function getInitialDark(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function useTheme() {
  return useContext(ThemeContext);
}

/** 让浏览器 UI（Safari 工具栏、滚动条、表单控件）跟站内主题走：
    同步 color-scheme 与 theme-color，而不是只跟系统外观走。 */
function applyBrowserChrome(dark: boolean) {
  const color = dark ? '#292524' : '#faf7f1';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  if (metas.length) {
    metas.forEach((m) => {
      m.removeAttribute('media');
      m.setAttribute('content', color);
    });
  } else {
    const m = document.createElement('meta');
    m.name = 'theme-color';
    m.content = color;
    document.head.appendChild(m);
  }
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(getInitialDark());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    applyBrowserChrome(dark);
    try {
      localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  }, [dark, mounted]);

  const toggle = () => setDark((d) => !d);

  return <ThemeContext.Provider value={{ dark, toggle }}>{children}</ThemeContext.Provider>;
}
