'use client';

/** 站点导航头部：当前路径高亮 + 主题切换 + 搜索浮层 + 移动端抽屉菜单（支持 ESC 关闭与图标导航） */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
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

  // 抽屉 / 搜索浮层打开时锁定页面滚动 + 支持 ESC 关闭
  useEffect(() => {
    document.body.style.overflow = open || searchOpen ? 'hidden' : '';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setSearchOpen(false);
      }
    };
    if (open || searchOpen) window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, searchOpen]);

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
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="搜索"
              title="搜索文章"
              className={`icon-btn ${pathname.startsWith('/search') ? '!border-brand-500 !text-brand-600 dark:!text-brand-400' : ''}`}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.7" />
                <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </button>
            <span className="ml-1 flex items-center">
              <ThemeToggle />
            </span>
          </nav>

          <div className="md:hidden flex items-center gap-1.5">
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="搜索"
              title="搜索"
              className="icon-btn"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.7" />
                <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </button>
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
            </ul>
          </aside>
        </>
      )}

      {/* 搜索浮层：× / ESC / 点击遮罩关闭；回车跳转 /search/?q= 直达结果 */}
      {searchOpen && (
        <>
          <div className="search-overlay open" onClick={() => setSearchOpen(false)} />
          <div className="search-pop open" role="dialog" aria-label="站内搜索">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 dark:border-slate-800">
              <span className="text-sm font-display font-semibold text-slate-900 dark:text-slate-100">站内搜索</span>
              <button
                className="icon-btn"
                onClick={() => setSearchOpen(false)}
                aria-label="关闭搜索"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form
              className="flex items-center gap-2 mt-4"
              onSubmit={(e) => {
                e.preventDefault();
                const kw = searchQ.trim();
                if (!kw) return;
                setSearchOpen(false);
                router.push(`/search/?q=${encodeURIComponent(kw)}`);
              }}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-slate-400 shrink-0" aria-hidden="true">
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.7" />
                <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              <input
                autoFocus
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="搜索文章标题、摘要、正文…"
                aria-label="搜索关键词"
                className="flex-1 min-w-0 bg-transparent text-sm text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={!searchQ.trim()}
                className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                搜索
              </button>
            </form>
          </div>
        </>
      )}
    </>
  );
}
