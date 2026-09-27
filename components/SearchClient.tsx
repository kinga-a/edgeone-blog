'use client';

/** 搜索页：输入关键词 → 调用 /api/search 全文检索 */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
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
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">搜索</h1>
      <div className="flex gap-2 mb-8">
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSearch()}
          placeholder="输入关键词搜索文章标题、摘要、正文…"
          className="flex-1 px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:border-brand-500"
        />
        <button
          onClick={doSearch}
          disabled={loading}
          className="px-6 py-3 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
        >
          {loading ? '搜索中…' : '搜索'}
        </button>
      </div>

      {searched && (
        <div className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          找到 {items.length} 篇与「{q.trim()}」相关的文章
        </div>
      )}

      {items.length ? (
        <ul className="space-y-3">
          {items.map((p) => (
            <li key={p.id}>
              <Link
                href={`/posts/${p.slug}/`}
                className="group block p-4 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 hover:border-brand-400 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    {p.title}
                  </h3>
                  <span className="text-xs text-slate-400 shrink-0">{fmtDate(p.publishedAt || p.createdAt)}</span>
                </div>
                {p.summary && <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{p.summary}</p>}
                {p.categoryName && <span className="mt-2 inline-block text-xs px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400">{p.categoryName}</span>}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        searched && !loading && <div className="text-center py-16 text-slate-400">没有找到匹配的文章</div>
      )}
    </div>
  );
}
