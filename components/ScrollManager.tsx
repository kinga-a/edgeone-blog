'use client';

/**
 * 修复：重新部署后首次刷新浏览器会恢复上次的滚动位置，导致首页停在中间。
 * 方案：禁用浏览器自动滚动恢复 + 每次页面加载强制滚到顶。
 */
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function ScrollManager() {
  const pathname = usePathname();

  useEffect(() => {
    // 禁用浏览器原生 scroll restoration，避免刷新后恢复到旧位置
    if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    // 当前路径变化时强制置顶（客户端导航）
    window.scrollTo(0, 0);

    // bfcache 恢复时（前进/后退/刷新）也强制置顶
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.scrollTo(0, 0);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [pathname]);

  return null;
}
