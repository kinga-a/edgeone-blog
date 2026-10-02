'use client';

/** 标签云页：pill 样式，名字后面跟文章数 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Tag } from '@/lib/types';
import { api } from '@/lib/api';

export default function TagsClient() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.listTags().then((d) => {
      if (!alive) return;
      setTags(d?.items || []);
      setLoading(false);
    }).catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">标签</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">共 {tags.length || '—'} 个标签</p>
      </div>

      {loading ? (
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-10 w-24 rounded-full" aria-hidden="true" />
          ))}
        </div>
      ) : tags.length ? (
        <div className="flex flex-wrap gap-3">
          {tags.map((t) => (
            <Link
              key={t.id}
              href={`/posts/?tag=${encodeURIComponent(t.id)}`}
              className="inline-flex items-baseline gap-1.5 px-5 py-2.5 rounded-full bg-[var(--t-card)] border border-slate-200 dark:border-slate-700/60 text-[15px] text-slate-700 dark:text-slate-200 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
            >
              <span className="text-brand-600 dark:text-brand-400 font-medium">#</span>
              <span>{t.name}</span>
              <span className="text-xs text-slate-400 font-mono">({t.postCount || 0})</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center text-slate-400">暂无标签</div>
      )}
    </div>
  );
}
