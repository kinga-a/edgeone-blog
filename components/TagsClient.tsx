'use client';

/** 标签云页：按文章数缩放字号 */
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
      if (d?.ok) setTags(d.items);
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { alive = false; };
  }, []);

  const max = Math.max(1, ...tags.map((t) => t.postCount || 0));

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100 mb-6">标签</h1>
      {loading ? (
        <div className="flex flex-wrap gap-3 items-center">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton h-7 w-20 rounded-full" aria-hidden="true" />
          ))}
        </div>
      ) : tags.length ? (
        <div className="flex flex-wrap gap-3 items-center">
          {tags.map((t) => {
            const size = 0.9 + ((t.postCount || 0) / max) * 0.7;
            return (
              <Link
                key={t.id}
                href={`/posts/?tag=${encodeURIComponent(t.id)}`}
                className="px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-brand-600 dark:text-brand-400 hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-all"
                style={{ fontSize: `${size}rem` }}
              >
                #{t.name}
                <span className="ml-1 text-xs text-slate-400">({t.postCount || 0})</span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-slate-400">暂无标签</div>
      )}
    </div>
  );
}
