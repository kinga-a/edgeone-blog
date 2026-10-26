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
    forceIOSStatusBarRefresh(color);
  }, [dark, mounted]);

  const toggle = () => setDark((d) => !d);

  return <ThemeContext.Provider value={{ dark, toggle }}>{children}</ThemeContext.Provider>;
}

/** iOS 26/27 状态栏重采样触发。状态栏采样器优先读视口顶部 fixed/sticky 元素的背景色，
 *  但有 backdrop-filter 的元素会被忽略（WebKit 319479），且只在元素出现/布局变化时重采样
 *  （菜单 drawer 有效即因 fixed drawer 无 backdrop-filter、背景跟随主题）。
 *  故切主题时组合触发：
 *  ① 临时 fixed 元素覆盖顶部、背景色=主题色、opacity:0（采样器读 opacity:0 元素）——模拟 drawer
 *  ② body overflow hidden 抖动（视口/布局变化）
 *  ③ 向下滚动 1px（WebKit 306074：滚动时重采样） */
function forceIOSStatusBarRefresh(color: string) {
  try {
    // ① 关键：全屏 fixed 元素（与 drawer 同样覆盖顶部），背景色明确=主题色（opacity:0 仍被采样器读），
    //    保持 120ms 后移除；不设 z-index 以免被 body 背景盖住
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;opacity:0;pointer-events:none;background-color:' + color + ';';
    document.body.appendChild(probe);
    setTimeout(() => probe.remove(), 120);
    // ② overflow 变化 → 视口/布局变化，保持 80ms
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      document.body.style.overflow = prevOverflow;
    }, 80);
    // ③ 向下滚动 1px，120ms 后恢复原位
    const y = window.scrollY;
    window.scrollTo(0, y + 1);
    setTimeout(() => {
      window.scrollTo(0, y);
    }, 120);
  } catch {
    /* ignore */
  }
}
