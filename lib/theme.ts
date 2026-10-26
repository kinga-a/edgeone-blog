/** 主题共享常量与判定逻辑（无 'use client'，服务端/客户端均可导入） */

export const THEME_KEY = 'blog-theme';

/** 与 globals.css 的 --t-slate-50 / --t-slate-900 页面实际背景色保持一致，
 *  供 <meta name="theme-color"> 使用（Safari 状态栏/地址栏取色） */
export const THEME_COLOR_LIGHT = '#faf7f2';
export const THEME_COLOR_DARK = '#1c1a17';

/** 浏览器环境下解析当前应生效的主题：localStorage 站内开关优先，其次系统偏好 */
export function resolveInitialDark(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}
