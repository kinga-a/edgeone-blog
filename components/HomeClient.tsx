'use client';

/** 首页（纸墨编辑风）：刊头 Hero + 精选文章 + 最新文章 + 分类速览 + 访问统计埋点 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import PostCard from './PostCard';
import type { Category, PostSummary, SiteConfig } from '@/lib/types';
import { api } from '@/lib/api';
import { fmtDate, mediaUrl, coverClassFor, catIconClassFor } from '@/lib/utils';

function FeaturedCard({ post }: { post: PostSummary }) {
  const cover = post.coverUrl || (post.coverKey ? mediaUrl(post.coverKey) : '');
  const fallbackCls = coverClassFor();
  return (
    <Link href={`/posts/${post.slug}/`} className="featured-card">
      <div className={`card-cover ${cover ? '' : fallbackCls}`}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={post.title} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <>
            <span className="cover-label">{post.categoryName || post.title.slice(0, 1)}</span>
            <span className="cover-mark" aria-hidden="true" />
          </>
        )}
      </div>
      <div className="card-body">
        <div className="card-meta">
          {post.categoryName && <span className="card-category">{post.categoryName}</span>}
          {post.categoryName && <span>·</span>}
          <span>{fmtDate(post.publishedAt || post.createdAt)}</span>
          <span>·</span>
          <span>{post.readingTime || 1} 分钟阅读</span>
        </div>
        <h2 className="card-title">{post.title}</h2>
        {post.summary && <p className="card-excerpt">{post.summary}</p>}
      </div>
    </Link>
  );
}

function FeaturedSmall({ post }: { post: PostSummary }) {
  const cover = post.coverUrl || (post.coverKey ? mediaUrl(post.coverKey) : '');
  const fallbackCls = coverClassFor();
  return (
    <Link href={`/posts/${post.slug}/`} className="featured-small">
      <div className={`card-cover ${cover ? '' : fallbackCls}`}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={post.title} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <>
            <span className="cover-label">{post.categoryName || post.title.slice(0, 1)}</span>
            <span className="cover-mark" aria-hidden="true" />
          </>
        )}
      </div>
      <div className="card-info">
        <div className="card-meta">
          {post.categoryName && <span className="card-category">{post.categoryName}</span>}
        </div>
        <h3 className="card-title">{post.title}</h3>
      </div>
    </Link>
  );
}

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

  const featured = posts[0];
  const sidePosts = posts.slice(1, 3);
  const latestPosts = posts.slice(0, 6);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 pb-10">
      {/* 刊头 Hero */}
      <section className="hero fade-in-up">
        <div className="hero-grid">
          <div className="hero-text">
            <div className="hero-vol">VOL.{new Date().getFullYear()} · 记录与思考</div>
            <h1 className="hero-title font-display">{config?.title || '我的博客'}</h1>
            <p className="hero-subtitle font-display" style={{ fontWeight: 400 }}>
              {config?.subtitle || '记录思考，分享知识'}
            </p>
            <p className="hero-desc">
              互联网干货 · 技术踩坑记录 · 工具分享 · 网络观察随笔——用文字存档思考，把零散的认知沉淀成可回看的内容。
            </p>
            <div className="hero-actions">
              <Link href="/posts/" className="btn-primary">浏览文章</Link>
              <Link href="/about/" className="btn-ghost">关于我 →</Link>
            </div>
          </div>
          <div className="hero-deco" aria-hidden="true">
            <div className="hero-deco-paper"></div>
            <div className="hero-deco-paper-2"></div>
          </div>
        </div>
      </section>

      {/* 精选文章 */}
      {featured && (
        <section className="mt-2">
          <div className="section-header">
            <h2 className="section-title">
              精选文章<span className="mono-num">01</span>
            </h2>
            <Link href="/posts/" className="section-link">查看全部 →</Link>
          </div>
          <div className="featured-section">
            <FeaturedCard post={featured} />
            <div className="featured-side">
              {sidePosts.map((p) => (
                <FeaturedSmall key={p.id} post={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 最新文章 */}
      <section className="mt-12">
        <div className="section-header">
          <h2 className="section-title">
            最新文章<span className="mono-num">02</span>
          </h2>
        </div>
        {latestPosts.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {latestPosts.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        ) : (
          <div className="text-center py-16 text-slate-400">
            还没有文章，去后台发布第一篇吧～
          </div>
        )}
      </section>

      {/* 分类速览 */}
      {categories.length > 0 && (
        <section className="mt-12">
          <div className="section-header">
            <h2 className="section-title">
              分类速览<span className="mono-num">03</span>
            </h2>
            <Link href="/categories/" className="section-link">全部分类 →</Link>
          </div>
          <div className="category-grid">
            {categories.slice(0, 8).map((c) => (
              <Link key={c.id} href={`/categories/${c.slug}/`} className="category-card">
                <span className={`category-card-icon ${catIconClassFor()}`} aria-hidden="true">
                  {c.name.slice(0, 1)}
                </span>
                <span className="category-card-name">{c.name}</span>
                {c.description && <span className="category-card-desc">{c.description}</span>}
                <span className="category-card-count">{c.postCount || 0} 篇文章</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
