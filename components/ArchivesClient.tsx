'use client';

/** 归档页：按年份/月份分组的时间线 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { PostSummary } from '@/lib/types';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/utils';

export default function ArchivesClient() {
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.listPosts({ page: 1, pageSize: 200, status: 'published' }).then((d) => {
      if (!alive) return;
      if (d?.ok) setPosts(d.items);
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { alive = false; };
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, PostSummary[]>();
    for (const p of posts) {
      const key = (p.publishedAt || p.createdAt || '').slice(0, 7);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [posts]);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100 mb-2">归档</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">共 {posts.length} 篇文章</p>
      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="skeleton h-5 w-24 rounded" aria-hidden="true" />
              <div className="space-y-2 border-l-2 border-slate-200 dark:border-slate-700 ml-2 pl-6">
                <div className="skeleton h-4 w-3/4 rounded" aria-hidden="true" />
                <div className="skeleton h-4 w-1/2 rounded" aria-hidden="true" />
              </div>
            </div>
          ))}
        </div>
      ) : groups.length ? (
        <div className="space-y-8">
          {groups.map(([month, items]) => (
            <section key={month}>
              <h2 className="text-lg font-bold text-brand-600 dark:text-brand-400 mb-4 flex items-center gap-2">
                {month}
                <span className="text-xs font-normal text-slate-400">{items.length} 篇</span>
              </h2>
              <ul className="space-y-3 border-l-2 border-slate-200 dark:border-slate-700 ml-2 pl-6">
                {items.map((p) => (
                  <li key={p.id} className="relative">
                    <span className="absolute -left-[31px] top-2 w-2.5 h-2.5 rounded-full bg-brand-500 ring-4 ring-brand-50 dark:ring-slate-900" />
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <Link href={`/posts/${p.slug}/`} className="text-slate-800 dark:text-slate-200 hover:text-brand-600 dark:hover:text-brand-400 font-medium">
                        {p.title}
                      </Link>
                      <span className="text-xs text-slate-400 shrink-0">{fmtDate(p.publishedAt || p.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-slate-400">暂无文章</div>
      )}
    </div>
  );
}
