'use client';

/** 站点导航头部：当前路径高亮 + 主题切换（移动端折叠菜单） */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import ThemeToggle from './ThemeToggle';

const NAV = [
  { href: '/', label: '首页' },
  { href: '/posts/', label: '文章' },
  { href: '/categories/', label: '分类' },
  { href: '/tags/', label: '标签' },
  { href: '/archives/', label: '归档' },
  { href: '/about/', label: '关于' },
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

  // 滚动后显示底部边框（毛玻璃半透明始终生效，与页面底色融为一体）
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 抽屉打开时锁定页面滚动
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
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
            <span className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center text-white text-lg font-bold font-display">
              B
            </span>
            <span className="text-[17px] font-display font-semibold text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
              {title}
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`nav-link ${isActive(n.href) ? 'active' : ''}`}
              >
                {n.label}
              </Link>
            ))}
            <Link
              href="/search/"
              aria-label="搜索"
              title="搜索"
              className="ml-1 w-10 h-10 flex items-center justify-center rounded-[10px] text-slate-500 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors border border-transparent hover:border-brand-600/30"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
                <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </Link>
            <span className="ml-1.5 flex items-center">
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
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
                <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </Link>
            <ThemeToggle />
            <button
              className="icon-btn"
              onClick={() => setOpen((v) => !v)}
              aria-label="打开菜单"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {open && (
        <>
          <div className="drawer-overlay open" onClick={() => setOpen(false)} />
          <aside className="drawer open" role="dialog" aria-label="导航菜单">
            <button
              className="icon-btn drawer-close"
              onClick={() => setOpen(false)}
              aria-label="关闭菜单"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
            <ul className="drawer-nav">
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className={isActive(n.href) ? 'active' : ''}
                  >
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        </>
      )}
    </>
  );
}
