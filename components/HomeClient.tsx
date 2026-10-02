'use client';

/** 首页（纸墨编辑风）：刊头 Hero + 精选文章 + 最新文章 + 分类速览 + 访问统计埋点 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import PostCard from './PostCard';
import Reveal from './Reveal';
import type { Category, PostSummary, SiteConfig } from '@/lib/types';
import { api } from '@/lib/api';
import { fmtDate, mediaUrl, defaultCoverFor } from '@/lib/utils';
import { CATEGORY_ICON_SET, resolveCategoryIcon, sanitizeSvg, categoryIconGradientClass } from '@/lib/site-icons';

function FeaturedCard({ post }: { post: PostSummary }) {
  const cover = post.coverUrl || (post.coverKey ? mediaUrl(post.coverKey) : '') || defaultCoverFor(post.id);
  return (
    <Link href={`/posts/${post.slug}/`} className="featured-card">
      <div className="card-cover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover} alt={post.title} loading="lazy" className="w-full h-full object-cover" />
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
  const cover = post.coverUrl || (post.coverKey ? mediaUrl(post.coverKey) : '') || defaultCoverFor(post.id);
  return (
    <Link href={`/posts/${post.slug}/`} className="featured-small">
      <div className="card-cover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover} alt={post.title} loading="lazy" className="w-full h-full object-cover" />
      </div>
      <div className="card-info">
        <div className="card-meta">
          {post.categoryName && <span className="card-category">{post.categoryName}</span>}
          {post.categoryName && <span>·</span>}
          <span>{fmtDate(post.publishedAt || post.createdAt)}</span>
          <span>·</span>
          <span>{post.readingTime || 1} 分钟阅读</span>
        </div>
        <h3 className="card-title">{post.title}</h3>
        {post.summary && <p className="card-excerpt">{post.summary}</p>}
      </div>
    </Link>
  );
}

export default function HomeClient() {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [featuredList, setFeatured] = useState<PostSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.getConfig().catch(() => null),
      api.listPosts({ page: 1, pageSize: 6, status: 'published' }).catch(() => null),
      api.listCategories().catch(() => null),
      api.getFeaturedPosts().catch(() => null),
      api.trackVisit().catch(() => null),
    ]).then(([cfg, list, cats, feat]) => {
      if (!alive) return;
      if (cfg?.ok) setConfig(cfg.config);
      if (list?.ok) setPosts(list.items);
      if (cats?.ok) setCategories(cats.items);
      if (feat?.ok && Array.isArray(feat.items)) setFeatured(feat.items);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 pb-10">
        {/* 刊头骨架 */}
        <div className="py-12">
          <div className="skeleton h-3 w-24 rounded mb-6" aria-hidden="true" />
          <div className="skeleton h-10 w-2/3 rounded mb-3" aria-hidden="true" />
          <div className="skeleton h-5 w-1/2 rounded mb-4" aria-hidden="true" />
          <div className="skeleton h-4 w-3/5 rounded mb-2" aria-hidden="true" />
          <div className="skeleton h-4 w-2/5 rounded" aria-hidden="true" />
        </div>
        {/* 精选骨架 */}
        <div className="featured-section">
          <div className="article-card">
            <div className="skeleton card-cover w-full" aria-hidden="true" />
            <div className="card-body">
              <div className="skeleton h-3 w-28 rounded" aria-hidden="true" />
              <div className="skeleton h-6 w-4/5 rounded" aria-hidden="true" />
              <div className="skeleton h-4 w-full rounded" aria-hidden="true" />
              <div className="skeleton h-4 w-2/3 rounded" aria-hidden="true" />
            </div>
          </div>
          <div className="featured-side">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="featured-small">
                <div className="skeleton w-[100px] aspect-square rounded-[10px] shrink-0" aria-hidden="true" />
                <div className="card-info flex-1">
                  <div className="skeleton h-3 w-24 rounded" aria-hidden="true" />
                  <div className="skeleton h-4 w-4/5 rounded" aria-hidden="true" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 精选文章：站点配置指定（featured）优先；未指定或指定不足时用最新文章兜底
  const featured = featuredList[0] || posts[0];
  const restFeatured = featuredList.slice(1);
  const sidePosts = [
    ...restFeatured,
    ...posts.filter((p) => p.id !== featured?.id && !restFeatured.some((f) => f.id === p.id)),
  ].slice(0, 2);
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
        <Reveal className="mt-2">
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
        </Reveal>
      )}

      {/* 最新文章 */}
      <Reveal className="mt-12" delay={80}>
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
      </Reveal>

      {/* 分类速览 */}
      {categories.length > 0 && (
        <Reveal className="mt-12" delay={120}>
          <div className="section-header">
            <h2 className="section-title">
              分类速览<span className="mono-num">03</span>
            </h2>
            <Link href="/categories/" className="section-link">全部分类 →</Link>
          </div>
          <div className="category-grid">
            {categories.slice(0, 8).map((c) => {
              const r = resolveCategoryIcon(c.icon);
              const key = r.kind === 'key' ? r.value : (r.kind === 'none' ? 'doc' : '');
              const inner = key ? CATEGORY_ICON_SET[key] : '';
              const gradCls = r.kind === 'svg' ? '' : (categoryIconGradientClass(key || 'doc'));
              return (
                <Link key={c.id} href={`/categories/${c.slug}/`} className="category-card">
                  <span className={`category-card-icon ${gradCls}`} aria-hidden="true">
                    {r.kind === 'svg' ? (
                      <span dangerouslySetInnerHTML={{ __html: r.value }} />
                    ) : inner ? (
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <g dangerouslySetInnerHTML={{ __html: sanitizeSvg(inner) }} />
                      </svg>
                    ) : null}
                  </span>
                  <span className="category-card-name">{c.name}</span>
                  {c.description && <span className="category-card-desc">{c.description}</span>}
                  <span className="category-card-count">{c.postCount || 0} 篇文章</span>
                </Link>
              );
            })}
          </div>
        </Reveal>
      )}
    </div>
  );
}
