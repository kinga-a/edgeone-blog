'use client';

/** 归档页：按年份/月份分组的时间线（带月份计数徽章与卡片式悬浮交互） */
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
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-slate-100">时间归档</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">按时间脉络回看全部历史创作</p>
        </div>
        <div className="inline-flex items-center gap-2 self-start sm:self-auto px-3.5 py-1.5 rounded-full bg-[var(--t-card)] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-600 dark:text-slate-300 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-brand-500" />
          共 {posts.length} 篇文章 · {groups.length} 个月份
        </div>
      </div>

      {loading ? (
        <div className="space-y-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="skeleton h-6 w-28 rounded-lg" aria-hidden="true" />
              <div className="space-y-2.5 border-l-2 border-slate-200 dark:border-slate-700 ml-2.5 pl-6">
                <div className="skeleton h-12 w-full rounded-xl" aria-hidden="true" />
                <div className="skeleton h-12 w-5/6 rounded-xl" aria-hidden="true" />
              </div>
            </div>
          ))}
        </div>
      ) : groups.length ? (
        <div className="space-y-10">
          {groups.map(([month, items]) => (
            <section key={month} className="fade-in-up">
              <h2 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2.5">
                <span className="text-brand-600 dark:text-brand-400 font-mono">{month}</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-normal bg-brand-50 text-brand-600 dark:text-brand-400">
                  {items.length} 篇
                </span>
              </h2>
              <ul className="space-y-2.5 border-l-2 border-slate-200 dark:border-slate-700 ml-2.5 pl-6">
                {items.map((p) => (
                  <li key={p.id} className="relative group">
                    <span className="absolute -left-[31px] top-4 w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-brand-600 dark:group-hover:bg-brand-400 group-hover:scale-125 ring-4 ring-slate-50 dark:ring-slate-900 transition-all" />
                    <Link
                      href={`/posts/${p.slug}/`}
                      prefetch={false}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 rounded-xl bg-[var(--t-card)] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-brand-400 dark:hover:border-brand-400 hover:translate-x-1 transition-all shadow-[var(--shadow-xs)]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-slate-800 dark:text-slate-200 group-hover:text-brand-600 dark:group-hover:text-brand-400 font-medium truncate transition-colors">
                          {p.title}
                        </span>
                        {p.categoryName && (
                          <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 shrink-0">
                            {p.categoryName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 font-mono shrink-0">
                        <span>{p.readingTime || 1} 分钟</span>
                        <span>·</span>
                        <span>{fmtDate(p.publishedAt || p.createdAt)}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 rounded-2xl bg-[var(--t-card)] border border-slate-200 dark:border-slate-800 text-slate-400">
          暂无归档文章
        </div>
      )}
    </div>
  );
}
