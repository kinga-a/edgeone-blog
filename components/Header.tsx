'use client';

/** 站点导航头部：当前路径高亮 + 主题切换 + 搜索浮层（内嵌实时结果）+ 移动端抽屉菜单（支持 ESC 关闭与图标导航） */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import ThemeToggle from './ThemeToggle';
import { Spinner } from './Skeleton';
import type { PostSummary } from '@/lib/types';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/utils';

const NAV = [
  { href: '/', label: '首页', icon: 'M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1v-9.5z' },
  { href: '/posts/', label: '文章', icon: 'M6 3h9l4 4v14H6V3zM14 3v5h5M9 12h6M9 16h4' },
  { href: '/archives/', label: '归档', icon: 'M4 6h16M4 12h16M4 18h10' },
  { href: '/about/', label: '关于', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0' },
];

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [results, setResults] = useState<PostSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
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

  // 搜索浮层：输入防抖 300ms 实时检索（与 /search 页同一检索接口与结果样式）
  useEffect(() => {
    if (!searchOpen) return;
    const kw = searchQ.trim();
    if (!kw) {
      setResults([]);
      setSearched(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const d = await api.search(kw);
        setResults(d.items);
      } catch {
        setResults([]);
      }
      setSearched(true);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ, searchOpen]);

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
              className="flex gap-2.5 mt-4"
              onSubmit={(e) => {
                e.preventDefault();
                const kw = searchQ.trim();
                if (!kw) return;
                // 提交时立即强制搜索（跳过防抖）
                setSearching(true);
                api.search(kw)
                  .then((d) => setResults(d.items))
                  .catch(() => setResults([]))
                  .finally(() => {
                    setSearched(true);
                    setSearching(false);
                  });
              }}
            >
              <div className="relative flex-1 min-w-0">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 20 20"
                  fill="none"
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  aria-hidden="true"
                >
                  <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
                <input
                  autoFocus
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="搜索文章标题、摘要、正文…"
                  aria-label="搜索关键词"
                  className="w-full pl-11 pr-10 py-3.5 rounded-xl bg-[var(--t-card)] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200 outline-none shadow-sm placeholder:text-slate-400"
                />
                {searchQ && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQ('');
                      setResults([]);
                      setSearched(false);
                      setSearching(false);
                    }}
                    aria-label="清空输入"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={!searchQ.trim() || searching}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 active:scale-[0.98] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {searching && <Spinner className="w-4 h-4" />}
                {searching ? '搜索中…' : '搜索'}
              </button>
            </form>

            {/* 浮层内嵌结果（与 /search 页同款卡片） */}
            {searching ? (
              <div className="mt-4 space-y-2.5" aria-hidden="true">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <>
                {searched && (
                  <div className="mt-4 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span>
                      找到 <strong className="text-brand-600 dark:text-brand-400 font-mono">{results.length}</strong> 篇与「{searchQ.trim()}」相关的文章
                    </span>
                  </div>
                )}
                {results.length ? (
                  <ul className="mt-2 space-y-2.5 max-h-[46vh] overflow-y-auto pr-1">
                    {results.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/posts/${p.slug}/`}
                          prefetch={false}
                          onClick={() => setSearchOpen(false)}
                          className="group block p-4 rounded-xl bg-[var(--t-card)] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-brand-400 dark:hover:border-brand-400 hover:-translate-y-0.5 transition-all shadow-[var(--shadow-xs)]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors truncate">
                              {p.title}
                            </h3>
                            <span className="text-xs font-mono text-slate-400 shrink-0">{fmtDate(p.publishedAt || p.createdAt)}</span>
                          </div>
                          {p.summary && (
                            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                              {p.summary}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
                            {p.categoryName && (
                              <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 dark:text-brand-400 font-medium">
                                {p.categoryName}
                              </span>
                            )}
                            <span className="font-mono">{p.readingTime || 1} 分钟阅读</span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  searched && (
                    <div className="mt-4 text-center py-8 rounded-xl bg-[var(--t-card)] border border-slate-200 dark:border-slate-800 text-slate-400">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="mx-auto mb-3 opacity-50" aria-hidden="true">
                        <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M15.5 15.5L20 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        <path d="M8 10.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      <p className="text-slate-600 dark:text-slate-300 font-medium text-sm">没有找到匹配的文章</p>
                      <p className="mt-1 text-[11px] text-slate-400">试试缩短关键词或更换其它搜索词</p>
                    </div>
                  )
                )}
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
