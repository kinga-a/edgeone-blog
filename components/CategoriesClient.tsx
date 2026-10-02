'use client';

/** 分类列表页（图 2 样式：图标 + 名称 + 描述 + 文章数 + 卡片内文章列表） */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Category, PostSummary } from '@/lib/types';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/utils';
import { CATEGORY_ICON_SET, resolveCategoryIcon, sanitizeSvg, categoryIconGradientClass } from '@/lib/site-icons';

/** 旧版按 slug 推断图标的兜底映射（分类未设置自定义图标时使用） */
const LEGACY_ICON_BY_SLUG: Record<string, string> = {
  frontend: 'layout',
  backend: 'server',
  database: 'database',
  devops: 'gear',
  tools: 'wrench',
  notes: 'doc',
  network: 'network',
  cloud: 'cloud',
};

function CategoryIcon({ slug, icon }: { slug: string; icon?: string }) {
  // 分类自定义图标优先：粘贴的 SVG / 内置图标 key；无自定义时按 slug 兜底；最后默认 doc
  const r = resolveCategoryIcon(icon);
  const key = r.kind === 'key' ? r.value : (r.kind === 'none' ? (LEGACY_ICON_BY_SLUG[slug] || 'doc') : '');
  const inner = key ? CATEGORY_ICON_SET[key] : '';
  const gradCls = r.kind === 'svg' ? '' : (categoryIconGradientClass(key || 'doc'));
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none' as const, stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const };
  return (
    <span
      aria-hidden="true"
      className={`shrink-0 w-14 h-14 rounded-[14px] ${gradCls} text-white flex items-center justify-center`}
    >
      {r.kind === 'svg' ? (
        <span dangerouslySetInnerHTML={{ __html: r.value }} />
      ) : inner ? (
        <svg {...common}>
          <g dangerouslySetInnerHTML={{ __html: sanitizeSvg(inner) }} />
        </svg>
      ) : null}
    </span>
  );
}

export default function CategoriesClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.listCategories()
      .then((d) => {
        if (!alive) return;
        if (d?.ok) setCategories(d.items);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
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
            const allPosts = c.posts || [];
            const posts = allPosts.slice(0, 4);
            const hasMore = allPosts.length > 4;
            return (
              <div
                key={c.id}
                className="group p-7 rounded-[14px] bg-[var(--t-card)] border border-slate-200 dark:border-slate-700/60 hover:border-brand-400 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <CategoryIcon slug={c.slug} icon={c.icon} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <Link
                        href={`/categories/${c.slug}/`}
                        className="text-2xl font-semibold text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors"
                      >
                        {c.name}
                      </Link>
                      <span className="shrink-0 text-xs text-brand-600 dark:text-brand-400 font-mono">
                        {c.postCount || 0} 篇文章
                      </span>
                    </div>
                    {c.description && (
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{c.description}</p>
                    )}
                  </div>
                </div>

                {posts.length > 0 && (
                  <ul className="mt-4">
                    {posts.map((p) => (
                      <li
                        key={p.slug}
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
                    href={`/categories/${c.slug}/`}
                    className="mt-3 inline-flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 hover:gap-2 transition-all"
                  >
                    查看全部 {c.postCount || allPosts.length} 篇 →
                  </Link>
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
