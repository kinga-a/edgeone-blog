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
    点开汉堡菜单（抽屉）才生效」的原因。
    抽屉能触发的本质（逐项对照 .drawer 的 CSS）：fixed 定位、贴住视口顶边、
    背景是不透明的主题表面色（var(--t-slate-50)）、无 backdrop-filter、且会持续
    停留在 DOM 里。早先按「采样器会读 opacity:0 元素」这一未经真机证实的说法做的
    透明探针（85ccfc0/1a8dcaf）实测无效——透明元素对采样器等于不存在。
    本函数忠实复刻抽屉：主题 class 翻转后插入一个全屏 fixed 探针，背景直接引用
    同一个主题变量（插入时已是新主题色）、完全不透明、z-index 与抽屉同层（160），
    停留约 350ms 后淡出移除；同时保持 body overflow hidden 同一窗口（抽屉打开期间
    的页面状态），并附带 1px 程序化滚动（WebKit 306074）作第三重触发。 */
function forceIOSChromeRefresh() {
  try {
    document.getElementById('theme-chrome-probe')?.remove();
    const probe = document.createElement('div');
    probe.id = 'theme-chrome-probe';
    probe.style.cssText =
      'position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;opacity:1;pointer-events:none;z-index:160;background-color:var(--t-slate-50);transition:opacity 0.25s ease;';
    document.body.appendChild(probe);
    setTimeout(() => {
      probe.style.opacity = '0';
      setTimeout(() => probe.remove(), 260);
    }, 350);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      document.body.style.overflow = prevOverflow;
    }, 350);

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
  const appliedRef = useRef(false);
  const animTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setDark(getInitialDark());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    // 用户切换（非首次应用）时，先给 html 挂上 .theme-anim，让全站颜色在 0.3s 内
    // 一起平滑过渡（CSS 见 globals.css），窗口结束自动移除；首次应用是首屏同步，
    // 颜色由内联脚本在绘制前定好，不需要也不应该有过渡。
    if (appliedRef.current) {
      root.classList.add('theme-anim');
      if (animTimerRef.current) window.clearTimeout(animTimerRef.current);
      animTimerRef.current = window.setTimeout(() => root.classList.remove('theme-anim'), 340);
    }
    root.classList.toggle('dark', dark);
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    applyBrowserChrome(dark);
    try {
      localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
    appliedRef.current = true;
    // 每次应用主题（含首屏挂载后的首次同步）都复刻抽屉机制逼 iOS Safari 重采样：
    // 只靠 html 背景色时，采样器在首帧读到的仍是旧色，状态栏会停在白色。
    forceIOSChromeRefresh();
  }, [dark, mounted]);

  const toggle = () => setDark((d) => !d);

  return <ThemeContext.Provider value={{ dark, toggle }}>{children}</ThemeContext.Provider>;
}
