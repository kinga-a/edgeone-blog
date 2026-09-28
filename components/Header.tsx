'use client';

/** 站点导航头部：当前路径高亮 + 主题切换（移动端折叠菜单） */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTheme } from './ThemeProvider';
import { cx } from '@/lib/utils';

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
  const { dark, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('我的博客');

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

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/' || pathname === '';
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 tracking-tight group">
          <span className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center text-white text-sm font-bold font-display">
            B
          </span>
          <span className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
            {title}
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cx(
                'px-3 py-1.5 rounded-lg text-sm transition-colors',
                isActive(n.href)
                  ? 'text-brand-600 dark:text-brand-400 font-semibold bg-brand-50 dark:bg-brand-500/10'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800',
              )}
            >
              {n.label}
            </Link>
          ))}
          <Link
            href="/search/"
            aria-label="搜索"
            title="搜索"
            className="ml-1 w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
              <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </Link>
          <button
            onClick={toggle}
            aria-label="切换主题"
            className="ml-0.5 w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {dark ? '☀️' : '🌙'}
          </button>
        </nav>

        <button
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          onClick={() => setOpen((v) => !v)}
          aria-label="菜单"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {open && (
        <nav className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 space-y-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className={cx(
                'block px-3 py-2 rounded-lg text-sm',
                isActive(n.href)
                  ? 'text-brand-600 dark:text-brand-400 font-semibold bg-brand-50 dark:bg-brand-500/10'
                  : 'text-slate-600 dark:text-slate-300',
              )}
            >
              {n.label}
            </Link>
          ))}
          <Link
            href="/search/"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300"
          >
            🔍 搜索
          </Link>
          <button
            onClick={toggle}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300"
          >
            {dark ? '☀️ 浅色模式' : '🌙 暗色模式'}
          </button>
        </nav>
      )}
    </header>
  );
}
