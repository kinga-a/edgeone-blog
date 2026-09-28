'use client';

/** 分类列表页 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Category } from '@/lib/types';
import { api } from '@/lib/api';

export default function CategoriesClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.listCategories().then((d) => {
      if (!alive) return;
      if (d?.ok) setCategories(d.items);
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { alive = false; };
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100 mb-6">分类</h1>
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60">
              <div className="skeleton h-8 w-8 rounded-lg mb-3" aria-hidden="true" />
              <div className="skeleton h-5 w-2/3 rounded mb-2" aria-hidden="true" />
              <div className="skeleton h-4 w-full rounded" aria-hidden="true" />
              <div className="skeleton h-4 w-1/3 rounded mt-3" aria-hidden="true" />
            </div>
          ))}
        </div>
      ) : categories.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/categories/${c.slug}/`}
              className="group p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 hover:border-brand-400 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                  {c.name}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400">
                  {c.postCount || 0} 篇
                </span>
              </div>
              {c.description && (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{c.description}</p>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-slate-400">暂无分类</div>
      )}
    </div>
  );
}
