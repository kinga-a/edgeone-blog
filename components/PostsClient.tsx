'use client';

/** 文章列表：分页 + 分类/标签筛选 + 关键词搜索 */
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PostCard from './PostCard';
import Pagination from './Pagination';
import { PostCardSkeleton } from './Skeleton';
import type { Category, PostSummary, Tag } from '@/lib/types';
import { api } from '@/lib/api';

export default function PostsClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const category = searchParams.get('category') || '';
  const tag = searchParams.get('tag') || '';
  const q = searchParams.get('q') || '';

  const [items, setItems] = useState<PostSummary[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState(q);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([
      api.listPosts({ page, pageSize: 10, category, tag, q }),
      api.listCategories().catch(() => null),
      api.listTags().catch(() => null),
    ])
      .then(([list, cats, tgs]) => {
        if (!alive) return;
        if (list?.ok) {
          setItems(list.items);
          setTotalPages(list.totalPages);
          setTotal(list.total);
        }
        if (cats?.ok) setCategories(cats.items);
        if (tgs?.ok) setTags(tgs.items);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e?.message || '加载失败，请稍后重试');
        setLoading(false);
      });
    return () => { alive = false; };
  }, [page, category, tag, q, reloadKey]);

  const buildHref = useCallback(
    (p: number) => {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (tag) params.set('tag', tag);
      if (q) params.set('q', q);
      params.set('page', String(p));
      return `/posts/?${params.toString()}`;
    },
    [category, tag, q],
  );

  const submitSearch = () => {
    const params = new URLSearchParams();
    if (keyword.trim()) params.set('q', keyword.trim());
    params.set('page', '1');
    router.push(`/posts/?${params.toString()}`);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">文章</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{loading ? '加载中…' : `共 ${total} 篇文章`}</p>
        </div>
        <div className="flex gap-2">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
            placeholder="搜索文章…"
            className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:border-brand-500"
          />
          <button onClick={submitSearch} className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors">
            搜索
          </button>
        </div>
      </div>

      {/* 筛选器 */}
      {(categories.length > 0 || tags.length > 0) && (
        <div className="mb-8 space-y-3">
          {categories.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 w-12 shrink-0">分类</span>
              <button
                onClick={() => router.push(buildHref(1).replace(/category=[^&]*&?/, ''))}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${!category ? 'bg-brand-600 text-white border-brand-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
              >
                全部
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (tag) params.set('tag', tag);
                    if (q) params.set('q', q);
                    params.set('category', c.id);
                    params.set('page', '1');
                    router.push(`/posts/?${params.toString()}`);
                  }}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${category === c.id ? 'bg-brand-600 text-white border-brand-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 w-12 shrink-0">标签</span>
              <button
                onClick={() => router.push(buildHref(1).replace(/tag=[^&]*&?/, ''))}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${!tag ? 'bg-brand-600 text-white border-brand-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
              >
                全部
              </button>
              {tags.slice(0, 20).map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (category) params.set('category', category);
                    if (q) params.set('q', q);
                    params.set('tag', t.id);
                    params.set('page', '1');
                    router.push(`/posts/?${params.toString()}`);
                  }}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${tag === t.id ? 'bg-brand-600 text-white border-brand-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
                >
                  #{t.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <PostCardSkeleton key={i} />)}
        </div>
      ) : error ? (
        <div className="text-center py-16 text-slate-400">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="mx-auto mb-4 opacity-50" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p>{error}</p>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="mt-4 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            点击重试
          </button>
        </div>
      ) : items.length ? (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            {items.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
          <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />
        </>
      ) : (
        <div className="text-center py-16 text-slate-400">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="mx-auto mb-4 opacity-50" aria-hidden="true">
            <path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p>没有找到匹配的文章</p>
          <p className="mt-1 text-sm text-slate-400/70">换个关键词或筛选条件试试</p>
        </div>
      )}
    </div>
  );
}
