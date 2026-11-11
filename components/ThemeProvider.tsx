'use client';

/** 暗色模式：class 策略 + localStorage 持久化（在应用挂载前注入初始脚本避免闪烁） */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

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

/** iOS 26/27 Safari 不会在 class 变化时自动重采样浏览器 UI 颜色：它的采样器优先读
    视口顶部 sticky/fixed 元素的背景（本站吸顶头带 backdrop-filter，会被采样器忽略，
    WebKit 319479），且只在元素出现/布局/滚动变化时才重读——这正是「切完主题必须再
    点开汉堡菜单（抽屉）才生效」的原因：抽屉是无 backdrop-filter 的 fixed 元素，
    背景跟随主题，打开它才逼采样器重读。本函数在切换主题时复刻抽屉的触发条件：
    ① 插入全屏 fixed 探针（背景=新主题色、opacity:0，采样器仍会读）短暂保持后移除
    ② body overflow 抖动（等效抽屉打开时的布局变化）
    ③ 1px 程序化滚动（WebKit 306074：滚动时重采样）
    组合方案曾于 2026-10-26 在真机验证有效（提交 1a8dcaf），后被 feec681 同步源码时
    误删，本次恢复。桌面浏览器执行它无副作用。 */
function forceIOSChromeRefresh(color: string) {
  try {
    document.getElementById('theme-chrome-probe')?.remove();
    const probe = document.createElement('div');
    probe.id = 'theme-chrome-probe';
    probe.style.cssText =
      'position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;opacity:0;pointer-events:none;background-color:' +
      color +
      ';';
    document.body.appendChild(probe);
    setTimeout(() => probe.remove(), 150);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      document.body.style.overflow = prevOverflow;
    }, 80);

    const y = window.scrollY;
    window.scrollTo(0, y + 1);
    setTimeout(() => window.scrollTo(0, y), 120);
  } catch {
    /* ignore */
  }
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);
  const appliedOnceRef = useRef(false);

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
    // 首次应用是首屏同步（内联脚本已在绘制前定好浏览器 UI），不需要触发重采样；
    // 之后每次用户切换主题，复刻抽屉机制逼 iOS Safari 立即重采样新主题色。
    if (appliedOnceRef.current) {
      forceIOSChromeRefresh(dark ? '#292524' : '#faf7f1');
    } else {
      appliedOnceRef.current = true;
    }
  }, [dark, mounted]);

  const toggle = () => setDark((d) => !d);

  return <ThemeContext.Provider value={{ dark, toggle }}>{children}</ThemeContext.Provider>;
}
