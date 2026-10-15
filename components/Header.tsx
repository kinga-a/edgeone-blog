'use client';

/** 站点导航头部：当前路径高亮 + 主题切换 + 移动端抽屉菜单（支持 ESC 关闭与图标导航） */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import ThemeToggle from './ThemeToggle';

const NAV = [
  { href: '/', label: '首页', icon: 'M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1v-9.5z' },
  { href: '/posts/', label: '文章', icon: 'M6 3h9l4 4v14H6V3zM14 3v5h5M9 12h6M9 16h4' },
  { href: '/archives/', label: '归档', icon: 'M4 6h16M4 12h16M4 18h10' },
  { href: '/about/', label: '关于', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0' },
];

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('我的博客');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && d.config?.title) {
          setTitle(d.config.title);
          document.title = d.config.title;
        }
      })
      .catch(() => {});
  }, []);

  // 滚动后显示底部边框与柔和阴影
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 抽屉打开时锁定页面滚动 + 支持 ESC 关闭
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/' || pathname === '';
    return pathname.startsWith(href);
  };

  return (
    <>
      <header className={`site-header ${scrolled ? 'scrolled' : ''}`}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 tracking-tight group">
            <span className="w-9 h-9 rounded-[8px] bg-brand-600 flex items-center justify-center text-white text-lg font-bold font-display shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_2px_6px_rgba(154,67,24,0.25)] transition-transform duration-200 group-hover:scale-105 group-hover:-rotate-2">
              B
            </span>
            <span className="text-[17px] font-display font-semibold text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
              {title}
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`nav-link ${isActive(n.href) ? 'active' : ''}`}
              >
                {n.label}
              </Link>
            ))}
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1.5" aria-hidden="true" />
            <Link
              href="/search/"
              aria-label="搜索"
              title="搜索文章"
              className={`icon-btn ${pathname.startsWith('/search') ? '!border-brand-500 !text-brand-600 dark:!text-brand-400' : ''}`}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.7" />
                <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </Link>
            <span className="ml-1 flex items-center">
              <ThemeToggle />
            </span>
          </nav>

          <div className="md:hidden flex items-center gap-1.5">
            <Link
              href="/search/"
              aria-label="搜索"
              title="搜索"
              className="icon-btn"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.7" />
                <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </Link>
            <ThemeToggle />
            <button
              className="icon-btn"
              onClick={() => setOpen((v) => !v)}
              aria-label="打开菜单"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {open && (
        <>
          <div className="drawer-overlay open" onClick={() => setOpen(false)} />
          <aside className="drawer open" role="dialog" aria-label="导航菜单">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-200 dark:border-slate-800">
              <span className="w-7 h-7 rounded-md bg-brand-600 flex items-center justify-center text-white text-sm font-bold font-display">
                B
              </span>
              <span className="text-sm font-display font-semibold text-slate-900 dark:text-slate-100 truncate">
                {title}
              </span>
            </div>
            <button
              className="icon-btn drawer-close"
              onClick={() => setOpen(false)}
              aria-label="关闭菜单"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
            <ul className="drawer-nav !mt-5">
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className={isActive(n.href) ? 'active' : ''}
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="opacity-75">
                        <path d={n.icon} />
                      </svg>
                      {n.label}
                    </span>
                    <span className="text-xs opacity-50">→</span>
                  </Link>
                </li>
              ))}
              <li className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-800">
                <Link
                  href="/search/"
                  onClick={() => setOpen(false)}
                  className={pathname.startsWith('/search') ? 'active' : ''}
                >
                  <span className="inline-flex items-center gap-2.5">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="opacity-75">
                      <circle cx="9" cy="9" r="6" />
                      <path d="M14 14l4 4" />
                    </svg>
                    搜索文章
                  </span>
                  <span className="text-xs opacity-50">→</span>
                </Link>
              </li>
            </ul>
          </aside>
        </>
      )}
    </>
  );
}
