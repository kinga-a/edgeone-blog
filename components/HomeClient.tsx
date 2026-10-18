'use client';

/** 首页（纸墨编辑风）：期刊刊头 Masthead + 精选头条 Lede + 最新目录 Journal + 热门排行 Top List */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Reveal from './Reveal';
import type { PostSummary, SiteConfig } from '@/lib/types';
import { api } from '@/lib/api';
import { fmtDate, mediaUrl, defaultCoverFor } from '@/lib/utils';

/** 头条（精选文章）：左文右图非对称排版 */
function LedeItem({ post, index }: { post: PostSummary; index: number }) {
  const cover = post.coverUrl || (post.coverKey ? mediaUrl(post.coverKey) : '') || defaultCoverFor(post.id);
  const no = String(index + 1).padStart(2, '0');
  return (
    <Link href={`/posts/${post.slug}/`} prefetch={false} className="lede group">
      <div className="lede-body">
        <div className="flex items-center gap-2.5">
          <span className="lede-no">FEATURED · NO.{no}</span>
          {post.categoryName && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-600 dark:text-brand-400">
              {post.categoryName}
            </span>
          )}
        </div>
        <h2 className="lede-title font-display">{post.title}</h2>
        {post.summary && <p className="lede-excerpt">{post.summary}</p>}
        <div className="mt-auto pt-2 flex items-center justify-between gap-4 flex-wrap">
          <div className="card-meta">
            <span>{fmtDate(post.publishedAt || post.createdAt)}</span>
            <span className="meta-dot">·</span>
            <span>{post.readingTime || 1} 分钟阅读</span>
            <span className="meta-dot">·</span>
            <span title="阅读量">{post.views || 0} 阅读</span>
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 dark:text-brand-400 group-hover:translate-x-1 transition-transform">
            阅读全文
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>
      <div className="lede-cover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover} alt={post.title} loading="lazy" />
      </div>
    </Link>
  );
}

/** 期刊目录条目（最新文章）：日期 + 标题 + 摘要 + 阅读时长 */
function JournalItem({ post }: { post: PostSummary }) {
  return (
    <Link href={`/posts/${post.slug}/`} prefetch={false} className="journal-item group">
      <div className="journal-date">{fmtDate(post.publishedAt || post.createdAt)}</div>
      <div className="journal-main">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="journal-title">{post.title}</h3>
          {post.categoryName && (
            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              {post.categoryName}
            </span>
          )}
        </div>
        {post.summary && <p className="journal-excerpt">{post.summary}</p>}
      </div>
      <div className="journal-meta">
        <span>{post.readingTime || 1} 分钟</span>
        <span className="journal-arrow" aria-hidden="true">→</span>
      </div>
    </Link>
  );
}

/** 排行条目（热门文章）：大号衬线编号 + 标题 + 阅读量 */
function TopItem({ post, index }: { post: PostSummary; index: number }) {
  return (
    <Link href={`/posts/${post.slug}/`} prefetch={false} className="top-item">
      <div className="top-no">{String(index + 1).padStart(2, '0')}</div>
      <div className="top-main">
        <h3 className="top-title">{post.title}</h3>
        <div className="top-meta">
          {post.views || 0} 阅读 · {fmtDate(post.publishedAt || post.createdAt)}
        </div>
      </div>
    </Link>
  );
}

export default function HomeClient() {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [featuredList, setFeatured] = useState<PostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroQuote, setHeroQuote] = useState('');

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.getConfig().catch(() => null),
      api.listPosts({ page: 1, pageSize: 30, status: 'published' }).catch(() => null),
      api.getFeaturedPosts().catch(() => null),
      api.trackVisit().catch(() => null),
    ]).then(([cfg, list, feat]) => {
      if (!alive) return;
      if (cfg?.ok) setConfig(cfg.config);
      if (list?.ok) setPosts(list.items);
      if (feat?.ok && Array.isArray(feat.items)) setFeatured(feat.items);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  // 首页装饰卡文字：heroQuote 为 https 接口 URL 则拉取每日诗句，否则直接显示固定文字
  useEffect(() => {
    const q = (config?.heroQuote || '').trim();
    if (!q) { setHeroQuote(''); return; }
    if (/^https?:\/\//i.test(q)) {
      let alive = true;
      fetch(q, { headers: { accept: 'text/plain' } })
        .then((r) => (r.ok ? r.text() : ''))
        .then((t) => { if (alive) setHeroQuote((t || '').trim()); })
        .catch(() => { if (alive) setHeroQuote(''); });
      return () => { alive = false; };
    }
    setHeroQuote(q);
  }, [config]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 pb-12">
        {/* 刊头骨架 */}
        <div className="py-14">
          <div className="skeleton h-6 w-36 rounded-full mb-6" aria-hidden="true" />
          <div className="skeleton h-12 w-3/4 max-w-md rounded-xl mb-5" aria-hidden="true" />
          <div className="skeleton h-4 w-3/5 max-w-lg rounded mb-2.5" aria-hidden="true" />
          <div className="skeleton h-4 w-2/5 max-w-sm rounded mb-7" aria-hidden="true" />
          <div className="flex items-center gap-3">
            <div className="skeleton h-11 w-32 rounded-xl" aria-hidden="true" />
            <div className="skeleton h-11 w-28 rounded-xl" aria-hidden="true" />
          </div>
        </div>
        {/* 头条骨架 */}
        <div className="lede">
          <div className="space-y-3.5 py-2">
            <div className="skeleton h-4 w-28 rounded-full" aria-hidden="true" />
            <div className="skeleton h-8 w-4/5 rounded-lg" aria-hidden="true" />
            <div className="skeleton h-4 w-full rounded" aria-hidden="true" />
            <div className="skeleton h-4 w-2/3 rounded" aria-hidden="true" />
            <div className="pt-3 flex items-center justify-between">
              <div className="skeleton h-3.5 w-40 rounded" aria-hidden="true" />
              <div className="skeleton h-4 w-20 rounded" aria-hidden="true" />
            </div>
          </div>
          <div className="skeleton rounded-[14px] min-h-[230px]" aria-hidden="true" />
        </div>
        {/* 目录骨架 */}
        <div className="mt-16 space-y-3">
          <div className="skeleton h-7 w-32 rounded-md mb-4" aria-hidden="true" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="skeleton h-16 rounded-xl"
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    );
  }

  // 头条：站点配置指定（featured）优先；未指定或不足时用最新文章兜底
  const featured = featuredList[0] || posts[0];
  const restFeatured = featuredList.slice(1);
  const sidePosts = [
    ...restFeatured,
    ...posts.filter((p) => p.id !== featured?.id && !restFeatured.some((f) => f.id === p.id)),
  ].slice(0, 2);
  // 目录列表：精选副条 + 最新文章，去重后取前 5，排除头条
  const latest = [...sidePosts, ...posts]
    .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
    .filter((p) => p.id !== featured?.id)
    .slice(0, 5);
  // 热门：按阅读量排序取 Top 6，排除头条与目录已展示的文章
  const shownIds = new Set<string>();
  if (featured) shownIds.add(featured.id);
  latest.forEach((p) => shownIds.add(p.id));
  const hot = [...posts]
    .filter((p) => !shownIds.has(p.id))
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 6);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 pb-10">
      {/* 期刊刊头：眉题 + 大标题 + 引言 + CTA（左文右纸墨装饰，沿用 b3 分支 hero-grid 布局） */}
      <section className="hero fade-in-up">
        <div className="hero-grid">
          <div className="hero-text">
            <div className="hero-vol">VOL.{new Date().getFullYear()} · 记录与思考</div>
            <h1 className="hero-title font-display">{config?.title || '我的博客'}</h1>
            <p className="hero-desc">
              {config?.subtitle || '技术踩坑记录 · 工具分享 · 网络观察随笔——用文字存档思考，把零散的认知沉淀成可回看的内容。'}
            </p>
            <div className="hero-actions">
              <Link href="/posts/" className="btn-primary">
                <span>浏览文章</span>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link href="/archives/" className="btn-secondary">
                <span>时间归档</span>
              </Link>
              <Link href="/about/" className="btn-ghost">
                <span>关于我 →</span>
              </Link>
            </div>
          </div>
          <div className="hero-deco" aria-hidden="true">
            <div className="hero-deco-paper"></div>
            <div className="hero-deco-paper-2">
              {heroQuote ? <p className="hero-deco-quote">{heroQuote}</p> : null}
            </div>
          </div>
        </div>
      </section>

      {/* 精选头条 */}
      {featured && (
        <Reveal className="mt-2">
          <div className="section-header">
            <h2 className="section-title">
              精选文章
              <span className="mono-num">01</span>
            </h2>
            <Link href="/posts/" className="section-link">全部文章 →</Link>
          </div>
          <LedeItem post={featured} index={0} />
        </Reveal>
      )}

      {/* 最新目录 */}
      <Reveal className="mt-16" delay={80}>
        <div className="section-header">
          <h2 className="section-title">
            最新文章
            <span className="mono-num">02</span>
          </h2>
          <Link href="/posts/" className="section-link">全部文章 →</Link>
        </div>
        {latest.length ? (
          <div className="journal-list">
            {latest.map((p) => <JournalItem key={p.id} post={p} />)}
          </div>
        ) : (
          <div className="text-center py-16 rounded-2xl bg-[var(--t-card)] border border-slate-200 dark:border-slate-800 text-slate-400">
            还没有更多文章，去后台发布新作品吧～
          </div>
        )}
      </Reveal>

      {/* 热门排行 */}
      {hot.length > 0 && (
        <Reveal className="mt-16" delay={120}>
          <div className="section-header">
            <h2 className="section-title">
              热门文章
              <span className="mono-num">03</span>
            </h2>
          </div>
          <div className="top-list">
            {hot.map((p, i) => <TopItem key={p.id} post={p} index={i} />)}
          </div>
        </Reveal>
      )}
    </div>
  );
}
