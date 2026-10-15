'use client';

/** 分页组件：带方向图标与悬停抬升微交互 */
import Link from 'next/link';
import { cx } from '@/lib/utils';

export default function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  const pages: Array<number | '...'> = [];
  const push = (p: number) => {
    if (!pages.includes(p) && p >= 1 && p <= totalPages) pages.push(p);
  };
  push(1);
  if (page > 3) pages.push('...');
  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) push(i);
  if (page < totalPages - 2) pages.push('...');
  push(totalPages);

  return (
    <nav className="flex flex-wrap items-center justify-center gap-2 mt-12" aria-label="分页导航">
      {page > 1 ? (
        <Link
          href={buildHref(page - 1)}
          className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-sm font-medium bg-[var(--t-card)] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 hover:-translate-y-0.5 transition-all shadow-sm"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M12.5 15L7.5 10l5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          上一页
        </Link>
      ) : (
        <span className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed select-none">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M12.5 15L7.5 10l5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          上一页
        </span>
      )}

      <div className="flex items-center gap-1.5">
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`e${i}`} className="px-2 py-1.5 text-slate-400 select-none font-mono">
              …
            </span>
          ) : (
            <Link
              key={p}
              href={buildHref(p)}
              className={cx(
                'min-w-9 h-9 px-3 inline-flex items-center justify-center rounded-xl text-sm font-mono border transition-all',
                p === page
                  ? 'bg-brand-600 text-white border-brand-600 font-semibold shadow-sm scale-105'
                  : 'bg-[var(--t-card)] dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 hover:-translate-y-0.5',
              )}
            >
              {p}
            </Link>
          ),
        )}
      </div>

      {page < totalPages ? (
        <Link
          href={buildHref(page + 1)}
          className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-sm font-medium bg-[var(--t-card)] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 hover:-translate-y-0.5 transition-all shadow-sm"
        >
          下一页
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M7.5 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      ) : (
        <span className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed select-none">
          下一页
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M7.5 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
    </nav>
  );
}
