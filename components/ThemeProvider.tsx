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
    // iOS 26/27 状态栏颜色采样 html/body 背景（header 有 backdrop-filter 时停止采样顶部条、
    // 回退 html/body 背景），theme-color meta 已不生效，仅在视口布局变化时重读
    // （WebKit 306074/319479；真机验证：打开菜单 drawer 触发 body overflow hidden 后状态栏才更新）。
    // 因此切主题后同步 meta（兼容 iOS 15-17）并组合触发 iOS 重采样。
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
    forceIOSStatusBarRefresh();
  }, [dark, mounted]);

  const toggle = () => setDark((d) => !d);

  return <ThemeContext.Provider value={{ dark, toggle }}>{children}</ThemeContext.Provider>;
}

/** iOS 26/27 状态栏重采样触发：与打开菜单 drawer（body overflow hidden）等效的视口/布局变化。
 *  程序化 1px 滚动实测无效，组合三种触发提高命中：
 *  ① body overflow hidden 抖动（菜单按钮验证过的机制）
 *  ② 向下滚动 1px（WebKit 306074：滚动时重采样）
 *  ③ 临时 fixed 合成层（新图层出现触发重绘） */
function forceIOSStatusBarRefresh() {
  try {
    // ① overflow 变化 → 视口滚动条/布局变化（打开菜单的等效触发），保持 80ms 确保完成重采样
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      document.body.style.overflow = prevOverflow;
    }, 80);
    // ② 向下滚动 1px，120ms 后恢复原位
    const y = window.scrollY;
    window.scrollTo(0, y + 1);
    setTimeout(() => {
      window.scrollTo(0, y);
    }, 120);
    // ③ 临时 fixed 元素：新合成层出现触发一次重绘
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;left:0;width:2px;height:2px;opacity:0.02;pointer-events:none;z-index:-1;';
    document.body.appendChild(probe);
    setTimeout(() => probe.remove(), 100);
  } catch {
    /* ignore */
  }
}
