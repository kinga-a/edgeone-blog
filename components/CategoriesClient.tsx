'use client';

/** 分类列表页（图 2 样式：图标 + 名称 + 描述 + 文章数 + 卡片内文章列表） */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Category, PostSummary } from '@/lib/types';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/utils';

const CATEGORY_ICONS: Record<string, string> = {
  'frontend': 'frontend',
  'backend': 'backend',
  'database': 'database',
  'devops': 'devops',
  'tools': 'tools',
  'notes': 'notes',
};

function CategoryIcon({ slug }: { slug: string }) {
  // 文档图标：纸色底 + 朱砂描边，不同分类名映射不同图标
  const kind = CATEGORY_ICONS[slug] || 'notes';
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none' as const, stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const icon = {
    frontend: (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" />
        <path d="M3 9h18M9 4v16" stroke="currentColor" />
        <path d="M6 14l2 1.5-2 1.5M12 17h4" stroke="currentColor" strokeLinecap="round" />
      </svg>
    ),
    backend: (
      <svg {...common}>
        <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" />
        <circle cx="9" cy="9" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="15" cy="9" r="1.4" fill="currentColor" stroke="none" />
        <path d="M9 14h6M9 16.5h4" stroke="currentColor" strokeLinecap="round" />
      </svg>
    ),
    database: (
      <svg {...common}>
        <ellipse cx="12" cy="6" rx="8" ry="3" stroke="currentColor" />
        <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" stroke="currentColor" />
        <path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" stroke="currentColor" />
      </svg>
    ),
    devops: (
      <svg {...common}>
        <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" stroke="currentColor" />
        <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" stroke="currentColor" />
      </svg>
    ),
    tools: (
      <svg {...common}>
        <path d="M14.7 6.3a4.5 4.5 0 0 0-6 5.6L4 16.6V20h3.4l4.7-4.7a4.5 4.5 0 0 0 5.6-6L14 13l-3-3 3.7-3.7z" stroke="currentColor" strokeLinejoin="round" />
      </svg>
    ),
    notes: (
      <svg {...common}>
        <path d="M6 3h9l4 4v14H6V3z" stroke="currentColor" strokeLinejoin="round" />
        <path d="M15 3v5h4M9 12h6M9 16h6" stroke="currentColor" strokeLinecap="round" />
      </svg>
    ),
  }[kind] || null;
  return (
    <span
      aria-hidden="true"
      className="shrink-0 w-14 h-14 rounded-[14px] bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center"
    >
      {icon}
    </span>
  );
}

export default function CategoriesClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [postsByCat, setPostsByCat] = useState<Record<string, PostSummary[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.listCategories().then((d) => {
      if (!alive || !d?.ok) { setLoading(false); return; }
      setCategories(d.items);
      Promise.all(d.items.map((c) => api.listPosts({ category: c.slug, pageSize: 3 }).catch(() => null)))
        .then((lists) => {
          if (!alive) return;
          const map: Record<string, PostSummary[]> = {};
          d.items.forEach((c, i) => {
            if (lists[i]?.ok) map[c.id] = lists[i].items;
          });
          setPostsByCat(map);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }).catch(() => setLoading(false));
    return () => { alive = false; };
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">分类</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">共 {categories.length || '—'} 个分类</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-6 rounded-2xl border border-slate-200 dark:border-slate-700/60">
              <div className="flex items-start gap-4">
                <div className="skeleton w-14 h-14 rounded-[14px]" aria-hidden="true" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-5 w-1/3 rounded" aria-hidden="true" />
                  <div className="skeleton h-4 w-2/3 rounded" aria-hidden="true" />
                  <div className="skeleton h-4 w-24 rounded" aria-hidden="true" />
                </div>
              </div>
              <div className="skeleton h-4 w-full rounded mt-5" aria-hidden="true" />
              <div className="skeleton h-4 w-4/5 rounded mt-2" aria-hidden="true" />
            </div>
          ))}
        </div>
      ) : categories.length ? (
        <div className="space-y-4">
          {categories.map((c) => {
            const posts = postsByCat[c.id] || [];
            return (
              <div
                key={c.id}
                className="group p-7 rounded-[14px] bg-[var(--t-card)] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 hover:border-brand-400 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <CategoryIcon slug={c.slug} />
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/categories/${c.slug}/`}
                      className="text-2xl font-semibold text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors"
                    >
                      {c.name}
                    </Link>
                    {c.description && (
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{c.description}</p>
                    )}
                    <span className="mt-2 inline-block text-xs text-brand-600 dark:text-brand-400 font-mono">
                      {c.postCount || 0} 篇文章
                    </span>
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
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-slate-400">暂无分类</div>
      )}
    </div>
  );
}
