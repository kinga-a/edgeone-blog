'use client';

/** 标签页（与分类页同款卡片样式：图标 + 名称 + 文章数 + 卡片内文章列表） */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PostSummary, Tag } from '@/lib/types';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/utils';

/** 标签图标：统一用 # 号渐变方块，随标签名哈希取色 */
function TagBadge({ name }: { name: string }) {
  const palettes = [
    'bg-gradient-to-br from-violet-500 to-purple-600',
    'bg-gradient-to-br from-sky-500 to-blue-600',
    'bg-gradient-to-br from-emerald-500 to-teal-600',
    'bg-gradient-to-br from-orange-500 to-amber-600',
    'bg-gradient-to-br from-pink-500 to-rose-600',
    'bg-gradient-to-br from-indigo-500 to-blue-600',
  ];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const cls = palettes[h % palettes.length];
  return (
    <span
      aria-hidden="true"
      className={`shrink-0 w-14 h-14 rounded-[14px] ${cls} text-white flex items-center justify-center font-bold text-xl`}
    >
      #
    </span>
  );
}

export default function TagsClient() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagPosts, setTagPosts] = useState<Record<string, PostSummary[]>>({});

  useEffect(() => {
    let alive = true;
    api.listTags().then((d) => {
      if (!alive) return;
      const items = d?.items || [];
      setTags(items);
      Promise.all(
        items.map((t) =>
          api.listPosts({ tag: t.id, page: 1, pageSize: 5 }).catch(() => ({ items: [] as PostSummary[] }))
        )
      ).then((results) => {
        if (!alive) return;
        const map: Record<string, PostSummary[]> = {};
        items.forEach((t, i) => { map[t.id] = results[i]?.items || []; });
        setTagPosts(map);
        setLoading(false);
      });
    }).catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">标签</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">共 {tags.length || '—'} 个标签</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-6 rounded-2xl border border-slate-200 dark:border-slate-700/60">
              <div className="flex items-start gap-4">
                <div className="skeleton w-14 h-14 rounded-[14px]" aria-hidden="true" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-5 w-1/3 rounded" aria-hidden="true" />
                  <div className="skeleton h-4 w-24 rounded" aria-hidden="true" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : tags.length ? (
        <div className="space-y-4">
          {tags.map((t) => {
            const posts = tagPosts[t.id] || [];
            const hasMore = (t.postCount || 0) > posts.length;
            return (
              <div
                key={t.id}
                className="group p-7 rounded-[14px] bg-[var(--t-card)] border border-slate-200 dark:border-slate-700/60 hover:border-brand-400 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <TagBadge name={t.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <Link
                        href={`/posts/?tag=${encodeURIComponent(t.id)}`}
                        className="text-2xl font-semibold text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors"
                      >
                        #{t.name}
                      </Link>
                      <span className="shrink-0 text-xs text-brand-600 dark:text-brand-400 font-mono">
                        {t.postCount || 0} 篇文章
                      </span>
                    </div>
                  </div>
                </div>

                {posts.length > 0 && (
                  <ul className="mt-4">
                    {posts.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-baseline justify-between gap-4 py-2.5 border-b border-slate-100 dark:border-slate-700/50 last:border-b-0"
                      >
                        <Link
                          href={`/posts/${p.slug}/`}
                          className="text-[15px] text-slate-700 dark:text-slate-200 hover:text-brand-600 dark:hover:text-brand-400 transition-colors truncate"
                        >
                          {p.title}
                        </Link>
                        <time className="shrink-0 text-xs text-slate-400 font-mono">{fmtDate(p.publishedAt || p.createdAt)}</time>
                      </li>
                    ))}
                  </ul>
                )}
                {hasMore && (
                  <Link
                    href={`/posts/?tag=${encodeURIComponent(t.id)}`}
                    className="mt-3 inline-flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 hover:gap-2 transition-all"
                  >
                    查看全部 {t.postCount || posts.length} 篇 →
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-slate-400">暂无标签</div>
      )}
    </div>
  );
}
