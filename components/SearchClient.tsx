'use client';

/** 搜索页：输入关键词 → 调用 /api/search 全文检索（带图标、清空按钮、加载骨架与美化卡片） */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Spinner } from './Skeleton';
import type { PostSummary } from '@/lib/types';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/utils';

export default function SearchClient() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<PostSummary[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = async () => {
    const keyword = q.trim();
    if (!keyword) return;
    setLoading(true);
    try {
      const d = await api.search(keyword);
      setItems(d.items);
    } catch {
      setItems([]);
    }
    setSearched(true);
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-slate-100">站内搜索</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">输入关键词快速检索文章标题、摘要与正文内容</p>
      </div>

      <div className="flex gap-2.5 mb-8">
        <div className="relative flex-1">
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            aria-hidden="true"
          >
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.7" />
            <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            placeholder="输入关键词搜索文章标题、摘要、正文…"
            className="w-full pl-11 pr-10 py-3.5 rounded-xl bg-[var(--t-card)] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none shadow-sm"
          />
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ('');
                setSearched(false);
                setItems([]);
                inputRef.current?.focus();
              }}
              aria-label="清空输入"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              ×
            </button>
          )}
        </div>
        <button
          onClick={doSearch}
          disabled={loading || !q.trim()}
          className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 active:scale-[0.98] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {loading && <Spinner className="w-4 h-4" />}
          {loading ? '搜索中…' : '搜索'}
        </button>
      </div>

      {loading ? (
        <div className="space-y-3" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {searched && (
            <div className="mb-4 text-sm text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>
                找到 <strong className="text-brand-600 dark:text-brand-400 font-mono">{items.length}</strong> 篇与「{q.trim()}」相关的文章
              </span>
            </div>
          )}

          {items.length ? (
            <ul className="space-y-3">
              {items.map((p) => (
                <li key={p.id} className="fade-in-up">
                  <Link
                    href={`/posts/${p.slug}/`}
                    className="group block p-5 rounded-2xl bg-[var(--t-card)] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-brand-400 dark:hover:border-brand-400 hover:-translate-y-0.5 transition-all shadow-[var(--shadow-xs)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-display font-semibold text-lg text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                        {p.title}
                      </h3>
                      <span className="text-xs font-mono text-slate-400 shrink-0">{fmtDate(p.publishedAt || p.createdAt)}</span>
                    </div>
                    {p.summary && (
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {p.summary}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                      {p.categoryName && (
                        <span className="px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-600 dark:text-brand-400 font-medium">
                          {p.categoryName}
                        </span>
                      )}
                      <span className="font-mono">{p.readingTime || 1} 分钟阅读</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            searched && (
              <div className="text-center py-16 px-4 rounded-2xl bg-[var(--t-card)] border border-slate-200 dark:border-slate-800 text-slate-400">
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" className="mx-auto mb-4 opacity-50" aria-hidden="true">
                  <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M15.5 15.5L20 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M8 10.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <p className="text-slate-600 dark:text-slate-300 font-medium">没有找到匹配的文章</p>
                <p className="mt-1 text-sm text-slate-400">试试缩短关键词或更换其它搜索词</p>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
