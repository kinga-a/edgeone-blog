'use client';

/** 文章列表：分页 + 分类/标签筛选 + 关键词搜索（美化版搜索框与胶囊筛选面板） */
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PostCard from './PostCard';
import Pagination from './Pagination';
import { PostCardSkeleton, Spinner } from './Skeleton';
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
    setKeyword(q);
  }, [q]);

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
    if (category) params.set('category', category);
    if (tag) params.set('tag', tag);
    if (keyword.trim()) params.set('q', keyword.trim());
    params.set('page', '1');
    router.push(`/posts/?${params.toString()}`);
  };

  const clearFilters = () => {
    setKeyword('');
    router.push('/posts/');
  };

  const hasFilters = Boolean(category || tag || q);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-slate-100">全部文章</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {loading ? '正在加载文章列表…' : `共收录 ${total} 篇文章`}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              aria-hidden="true"
            >
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
              <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
              placeholder="搜索标题或摘要…"
              className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-[var(--t-card)] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none shadow-sm"
            />
            {keyword && (
              <button
                type="button"
                onClick={() => {
                  setKeyword('');
                  if (q) {
                    const params = new URLSearchParams();
                    if (category) params.set('category', category);
                    if (tag) params.set('tag', tag);
                    params.set('page', '1');
                    router.push(`/posts/?${params.toString()}`);
                  }
                }}
                aria-label="清空关键词"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                ×
              </button>
            )}
          </div>
          <button
            onClick={submitSearch}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 active:scale-[0.98] transition-all shadow-sm shrink-0 disabled:opacity-60"
          >
            {loading && <Spinner className="w-3.5 h-3.5" />}
            搜索
          </button>
        </div>
      </div>

      {/* 筛选器面板 */}
      {(categories.length > 0 || tags.length > 0) && (
        <div className="mb-8 p-4 sm:p-5 rounded-2xl bg-[var(--t-card)] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-[var(--shadow-xs)] space-y-3.5">
          {categories.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-400 w-11 shrink-0">分类</span>
              <button
                onClick={() => router.push(buildHref(1).replace(/category=[^&]*&?/, ''))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  !category
                    ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400'
                }`}
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    category === c.id
                      ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400'
                  }`}
                >
                  {c.name}
                  <span className={`ml-1.5 font-mono text-[11px] ${category === c.id ? 'text-white/80' : 'text-slate-400'}`}>
                    {c.postCount || 0}
                  </span>
                </button>
              ))}
            </div>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-700">
              <span className="text-xs font-medium text-slate-400 w-11 shrink-0">标签</span>
              <button
                onClick={() => router.push(buildHref(1).replace(/tag=[^&]*&?/, ''))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  !tag
                    ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400'
                }`}
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    tag === t.id
                      ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400'
                  }`}
                >
                  #{t.name}
                  <span className={`ml-1 font-mono text-[11px] ${tag === t.id ? 'text-white/80' : 'text-slate-400'}`}>
                    {t.postCount || 0}
                  </span>
                </button>
              ))}
            </div>
          )}
          {hasFilters && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500">
              <span>已启用筛选条件</span>
              <button
                type="button"
                onClick={clearFilters}
                className="text-brand-600 dark:text-brand-400 hover:underline font-medium"
              >
                重置全部筛选 ×
              </button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <PostCardSkeleton key={i} />)}
        </div>
      ) : error ? (
        <div className="text-center py-16 px-4 rounded-2xl bg-[var(--t-card)] border border-slate-200 dark:border-slate-800 text-slate-400">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="mx-auto mb-4 opacity-50" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p>{error}</p>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="mt-4 px-5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors shadow-sm"
          >
            点击重试
          </button>
        </div>
      ) : items.length ? (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
          <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />
        </>
      ) : (
        <div className="text-center py-16 px-4 rounded-2xl bg-[var(--t-card)] border border-slate-200 dark:border-slate-800 text-slate-400">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="mx-auto mb-4 opacity-50" aria-hidden="true">
            <path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p className="text-slate-600 dark:text-slate-300 font-medium">没有找到匹配的文章</p>
          <p className="mt-1 text-sm text-slate-400">换个关键词或筛选条件试试</p>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 transition-colors"
            >
              清除筛选条件
            </button>
          )}
        </div>
      )}
    </div>
  );
}
