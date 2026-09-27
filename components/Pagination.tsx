'use client';

/** 分页组件 */
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
  const push = (p: number) => { if (!pages.includes(p) && p >= 1 && p <= totalPages) pages.push(p); };
  push(1);
  if (page > 3) pages.push('...');
  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) push(i);
  if (page < totalPages - 2) pages.push('...');
  push(totalPages);

  return (
    <nav className="flex items-center justify-center gap-1.5 mt-10">
      {page > 1 && (
        <Link href={buildHref(page - 1)} className="px-3 py-1.5 rounded-lg text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-400 transition-colors">
          上一页
        </Link>
      )}
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`e${i}`} className="px-2 py-1.5 text-slate-400">…</span>
        ) : (
          <Link
            key={p}
            href={buildHref(p)}
            className={cx(
              'min-w-9 px-3 py-1.5 rounded-lg text-sm text-center border transition-colors',
              p === page
                ? 'bg-brand-600 text-white border-brand-600 font-semibold'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-400',
            )}
          >
            {p}
          </Link>
        ),
      )}
      {page < totalPages && (
        <Link href={buildHref(page + 1)} className="px-3 py-1.5 rounded-lg text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-400 transition-colors">
          下一页
        </Link>
      )}
    </nav>
  );
}
