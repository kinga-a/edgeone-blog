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
    <Link href={`/posts/${post.slug}/`} className="lede">
      <div className="lede-body">
        <div className="lede-no">NO.{no}</div>
        <h2 className="lede-title">{post.title}</h2>
        {post.summary && <p className="lede-excerpt">{post.summary}</p>}
        <div className="card-meta">
          {post.categoryName && <span className="card-category">{post.categoryName}</span>}
          {post.categoryName && <span className="meta-dot">·</span>}
          <span>{fmtDate(post.publishedAt || post.createdAt)}</span>
          <span className="meta-dot">·</span>
          <span>{post.readingTime || 1} 分钟阅读</span>
          <span className="meta-dot">·</span>
          <span title="阅读量">{post.views || 0} 阅读</span>
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
    <Link href={`/posts/${post.slug}/`} className="journal-item">
      <div className="journal-date">{fmtDate(post.publishedAt || post.createdAt)}</div>
      <div className="journal-main">
        <h3 className="journal-title">{post.title}</h3>
        {post.summary && <p className="journal-excerpt">{post.summary}</p>}
      </div>
      <div className="journal-meta">{post.readingTime || 1} 分钟</div>
    </Link>
  );
}

/** 排行条目（热门文章）：大号衬线编号 + 标题 + 阅读量 */
function TopItem({ post, index }: { post: PostSummary; index: number }) {
  return (
    <Link href={`/posts/${post.slug}/`} className="top-item">
      <div className="top-no">{String(index + 1).padStart(2, '0')}</div>
      <div className="top-main">
        <h3 className="top-title">{post.title}</h3>
        <div className="top-meta">{post.views || 0} 阅读 · {fmtDate(post.publishedAt || post.createdAt)}</div>
      </div>
    </Link>
  );
}

export default function HomeClient() {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [featuredList, setFeatured] = useState<PostSummary[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 pb-10">
        {/* 刊头骨架 */}
        <div className="py-14">
          <div className="skeleton h-3 w-28 rounded mb-6" aria-hidden="true" />
          <div className="skeleton h-12 w-3/4 rounded mb-4" aria-hidden="true" />
          <div className="skeleton h-6 w-1/2 rounded mb-5" aria-hidden="true" />
          <div className="skeleton h-4 w-3/5 rounded mb-2" aria-hidden="true" />
          <div className="skeleton h-4 w-2/5 rounded" aria-hidden="true" />
        </div>
        {/* 头条骨架 */}
        <div className="lede">
          <div className="space-y-3">
            <div className="skeleton h-3 w-20 rounded" aria-hidden="true" />
            <div className="skeleton h-8 w-4/5 rounded" aria-hidden="true" />
            <div className="skeleton h-4 w-full rounded" aria-hidden="true" />
            <div className="skeleton h-4 w-2/3 rounded" aria-hidden="true" />
          </div>
          <div className="skeleton rounded-[10px] min-h-[220px]" aria-hidden="true" />
        </div>
        {/* 目录骨架 */}
        <div className="mt-12">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="skeleton h-16 rounded-none border-b border-slate-200 dark:border-slate-800"
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
      {/* 期刊刊头 */}
      <section className="hero fade-in-up">
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
      </section>

      {/* 精选头条 */}
      {featured && (
        <Reveal className="mt-2">
          <div className="section-header">
            <h2 className="section-title">精选文章</h2>
            <Link href="/posts/" className="section-link">查看全部 →</Link>
          </div>
          <LedeItem post={featured} index={0} />
        </Reveal>
      )}

      {/* 最新目录 */}
      <Reveal className="mt-12" delay={80}>
        <div className="section-header">
          <h2 className="section-title">最新文章</h2>
          <Link href="/posts/" className="section-link">全部文章 →</Link>
        </div>
        {latest.length ? (
          <div className="journal-list">
            {latest.map((p) => <JournalItem key={p.id} post={p} />)}
          </div>
        ) : (
          <div className="text-center py-16 text-slate-400">
            还没有文章，去后台发布第一篇吧～
          </div>
        )}
      </Reveal>

      {/* 热门排行 */}
      {hot.length > 0 && (
        <Reveal className="mt-12" delay={120}>
          <div className="section-header">
            <h2 className="section-title">热门文章</h2>
          </div>
          <div className="top-list">
            {hot.map((p, i) => <TopItem key={p.id} post={p} index={i} />)}
          </div>
        </Reveal>
      )}
    </div>
  );
}
