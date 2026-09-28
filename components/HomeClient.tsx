'use client';

/** 首页：站点信息 + 最新文章 + 分类概览 + 访问统计埋点 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import PostCard from './PostCard';
import type { Category, PostSummary, SiteConfig } from '@/lib/types';
import { api } from '@/lib/api';

export default function HomeClient() {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.getConfig().catch(() => null),
      api.listPosts({ page: 1, pageSize: 6, status: 'published' }).catch(() => null),
      api.listCategories().catch(() => null),
      api.trackVisit().catch(() => null),
    ]).then(([cfg, list, cats]) => {
      if (!alive) return;
      if (cfg?.ok) setConfig(cfg.config);
      if (list?.ok) setPosts(list.items);
      if (cats?.ok) setCategories(cats.items);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-20 text-center text-slate-400">加载中…</div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      {/* Hero */}
      <section className="text-center py-12 fade-in-up">
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight bg-gradient-to-r from-brand-600 via-brand-500 to-indigo-500 bg-clip-text text-transparent">
          {config?.title || '我的博客'}
        </h1>
        <p className="mt-4 text-base sm:text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
          {config?.subtitle || '记录思考，分享知识'}
        </p>
        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <Link href="/posts/" className="px-5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors shadow-sm shadow-brand-600/30">
            浏览文章
          </Link>
          <Link href="/about/" className="px-5 py-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium border border-slate-200 dark:border-slate-700 hover:border-brand-400 transition-colors">
            关于我
          </Link>
        </div>
      </section>

      {/* 最新文章 */}
      <section className="mt-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">最新文章</h2>
          <Link href="/posts/" className="text-sm text-brand-600 dark:text-brand-400 hover:underline">查看全部 →</Link>
        </div>
        {posts.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        ) : (
          <div className="text-center py-16 text-slate-400">
            还没有文章，去后台发布第一篇吧～
          </div>
        )}
      </section>

      {/* 分类概览 */}
      {categories.length > 0 && (
        <section className="mt-14">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">分类</h2>
            <Link href="/categories/" className="text-sm text-brand-600 dark:text-brand-400 hover:underline">全部分类 →</Link>
          </div>
          <div className="flex flex-wrap gap-3">
            {categories.slice(0, 12).map((c) => (
              <Link
                key={c.id}
                href={`/categories/${c.slug}/`}
                className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200 hover:border-brand-400 transition-colors"
              >
                {c.name}
                <span className="ml-1.5 text-xs text-slate-400">({c.postCount || 0})</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
