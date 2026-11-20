'use client';

/** 首页（纸墨编辑风）：期刊刊头 Masthead + 精选头条 Lede + 最新目录 Journal + 热门排行 Top List */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Reveal from './Reveal';
import type { PostSummary, SiteConfig } from '@/lib/types';
import { api } from '@/lib/api';
import { fmtDate, mediaUrl, defaultCoverFor } from '@/lib/utils';

/** 淡入图片：加载完成前透明（容器底色占位），完成后平滑显形。头条图优先加载，不用懒加载 */
function FadeImg({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      fetchPriority="high"
      decoding="async"
      onLoad={() => setLoaded(true)}
      className={`img-fade${loaded ? ' img-fade-in' : ''}`}
    />
  );
}

/** 刊头骨架（配置接口未返回时占位） */
function HeroSkeleton() {
  return (
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
  );
}

/** 头条骨架（精选/列表接口未返回时占位） */
function LedeSkeleton() {
  return (
    <div className="lede mt-2">
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
  );
}

/** 目录骨架（列表接口未返回时占位） */
function JournalSkeleton() {
  return (
    <div className="mt-16 space-y-3">
      <div className="skeleton h-7 w-32 rounded-md mb-4" aria-hidden="true" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-16 rounded-xl"
          style={{ '--sk-delay': `${-(i * 0.24).toFixed(2)}s` } as React.CSSProperties}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function FeaturedCarousel({ posts }: { posts: PostSummary[] }) {
  const quantity = posts.length;
  const colors = ['224, 138, 90', '154, 67, 24', '217, 119, 6', '180, 83, 9', '249, 115, 22', '234, 88, 12', '245, 158, 11', '161, 98, 7', '146, 64, 14', '217, 119, 6'];
  const [cur, setCur] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  // 尊重系统「减弱动态」偏好：开启时不自动滚动
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  // 把当前索引同步到轨道的 --cur 变量，驱动 CSS 变换
  useEffect(() => {
    if (trackRef.current) trackRef.current.style.setProperty('--cur', String(cur));
  }, [cur]);

  // 自动滚动：每 5s 切换到下一篇；hover 或键盘聚焦时暂停
  useEffect(() => {
    if (quantity <= 1 || reduced || paused) return;
    const id = setInterval(() => setCur((c) => (c + 1) % quantity), 5000);
    return () => clearInterval(id);
  }, [quantity, paused, reduced]);

  return (
    <div
      className="featured-carousel"
      role="region"
      aria-label="精选文章轮播"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="featured-carousel-track" ref={trackRef}>
        {posts.map((post, index) => {
          const cover = post.coverUrl || (post.coverKey ? mediaUrl(post.coverKey) : '') || defaultCoverFor(post.id);
          const no = String(index + 1).padStart(2, '0');
          return (
            <article
              key={post.id}
              className="featured-carousel-card"
              style={{ '--i': index, '--n': quantity, '--color-card': colors[index % colors.length] } as React.CSSProperties}
            >
              <a href={`/posts/${post.slug}/`} className="featured-carousel-link" aria-label={`阅读精选文章：${post.title}`}>
                <div className="featured-carousel-image">
                  <FadeImg src={cover} alt={post.title} />
                </div>
                <div className="featured-carousel-content">
                  <span className="featured-carousel-no">FEATURED · NO.{no}</span>
                  <h3 className="featured-carousel-title font-display">{post.title}</h3>
                  {post.summary && <p className="featured-carousel-summary">{post.summary}</p>}
                  <div className="featured-carousel-meta">
                    {fmtDate(post.publishedAt || post.createdAt)} · {post.readingTime || 1} 分钟阅读
                  </div>
                </div>
              </a>
            </article>
          );
        })}
      </div>
      {quantity > 1 && (
        <div className="featured-carousel-nav" aria-label="精选文章切换">
          {posts.map((post, index) => (
            <button
              key={post.id}
              type="button"
              className="featured-carousel-dot"
              aria-label={`查看第 ${index + 1} 篇：${post.title}`}
              aria-current={index === cur ? 'true' : undefined}
              onClick={() => setCur(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** 精选文章：平铺卡片（一排 3 个），点击卡片进入对应文章 */
function FeaturedGrid({ posts }: { posts: PostSummary[] }) {
  return (
    <div className="featured-grid">
      {posts.map((post, index) => {
        const cover = post.coverUrl || (post.coverKey ? mediaUrl(post.coverKey) : '') || defaultCoverFor(post.id);
        const no = String(index + 1).padStart(2, '0');
        return (
          <a key={post.id} href={`/posts/${post.slug}/`} className="featured-grid-card group" aria-label={`阅读精选文章：${post.title}`}>
            <div className="featured-grid-cover">
              <FadeImg src={cover} alt={post.title} />
            </div>
            <div className="featured-grid-body">
              <div className="flex items-center gap-2">
                <span className="featured-grid-no">NO.{no}</span>
                {post.categoryName && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-brand-50 text-brand-600 dark:text-brand-400">
                    {post.categoryName}
                  </span>
                )}
              </div>
              <h3 className="featured-grid-title font-display">{post.title}</h3>
              {post.summary && <p className="featured-grid-summary">{post.summary}</p>}
              <div className="featured-grid-foot">
                <span className="card-meta">
                  {fmtDate(post.publishedAt || post.createdAt)} · {post.readingTime || 1} 分钟阅读 · {post.views || 0} 阅读
                </span>
                <span className="featured-grid-link">阅读全文 →</span>
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}

/** 期刊目录条目（最新文章）：日期 + 标题 + 摘要 + 阅读时长 */
function JournalItem({ post }: { post: PostSummary }) {
  return (
    <a href={`/posts/${post.slug}/`} className="journal-item group">
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
    </a>
  );
}

/** 排行条目（热门文章）：大号衬线编号 + 标题 + 阅读量 */
function TopItem({ post, index }: { post: PostSummary; index: number }) {
  return (
    <a href={`/posts/${post.slug}/`} className="top-item">
      <div className="top-no">{String(index + 1).padStart(2, '0')}</div>
      <div className="top-main">
        <h3 className="top-title">{post.title}</h3>
        <div className="top-meta">
          {post.views || 0} 阅读 · {fmtDate(post.publishedAt || post.createdAt)}
        </div>
      </div>
    </a>
  );
}

export default function HomeClient() {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [featuredList, setFeatured] = useState<PostSummary[]>([]);
  // 三个接口各自独立就绪：哪个先返回就先渲染对应区块，不再互相等待
  const [cfgReady, setCfgReady] = useState(false);
  const [listReady, setListReady] = useState(false);
  const [featReady, setFeatReady] = useState(false);
  const [heroQuote, setHeroQuote] = useState('');
  const [heroQuoteAuthor, setHeroQuoteAuthor] = useState('');

  useEffect(() => {
    let alive = true;
    // 访问统计是一次 KV 写操作，不进首屏阻塞路径，单独发出不等结果
    api.trackVisit().catch(() => null);
    api.getConfigCached().catch(() => null).then((cfg) => {
      if (!alive) return;
      if (cfg?.ok) setConfig(cfg.config);
      setCfgReady(true);
    });
    api.listPostsCached({ page: 1, pageSize: 15, status: 'published', cover: 'none' }).catch(() => null).then((list) => {
      if (!alive) return;
      if (list?.ok) setPosts(list.items);
      setListReady(true);
    });
    api.getFeaturedPosts().catch(() => null).then((feat) => {
      if (!alive) return;
      if (feat?.ok && Array.isArray(feat.items)) setFeatured(feat.items);
      setFeatReady(true);
    });
    return () => { alive = false; };
  }, []);

  // 首页装饰卡文字：heroQuote 为 https 接口 URL 则拉取每日诗句，否则直接显示固定文字。
  // JSON 接口（如 https://v1.jinrishici.com/rensheng.json）返回 {content, author} → 诗句 + "—— 作者"；
  // 纯文本接口/固定文字 → 仅一行。
  useEffect(() => {
    const q = (config?.heroQuote || '').trim();
    if (!q) { setHeroQuote(''); setHeroQuoteAuthor(''); return; }
    if (/^https?:\/\//i.test(q)) {
      let alive = true;
      fetch(q, { headers: { accept: 'text/plain, application/json' } })
        .then((r) => (r.ok ? r.text() : ''))
        .then((t) => {
          if (!alive) return;
          const trimmed = (t || '').trim();
          if (!trimmed) { setHeroQuote(''); setHeroQuoteAuthor(''); return; }
          if (trimmed.startsWith('{')) {
            try {
              const j = JSON.parse(trimmed);
              setHeroQuote((j.content || '').trim());
              setHeroQuoteAuthor((j.author || '').trim());
              return;
            } catch { /* 非 JSON，落回纯文本 */ }
          }
          setHeroQuote(trimmed);
          setHeroQuoteAuthor('');
        })
        .catch(() => { if (alive) { setHeroQuote(''); setHeroQuoteAuthor(''); } });
      return () => { alive = false; };
    }
    setHeroQuote(q);
    setHeroQuoteAuthor('');
  }, [config]);


  // 精选：按后台勾选数量与顺序展示；未勾选时自动取最新 1 篇
  const featured = featuredList.length > 0 ? featuredList : posts.slice(0, 1);
  const featuredIds = new Set(featured.map((p) => p.id));
  // 目录列表：排除全部精选文章，取最新 5 篇
  const latest = posts.filter((p) => !featuredIds.has(p.id)).slice(0, 5);
  // 热门：按阅读量排序取 Top 6，排除精选与目录已展示的文章
  const shownIds = new Set<string>(featuredIds);
  latest.forEach((p) => shownIds.add(p.id));
  const hot = [...posts]
    .filter((p) => !shownIds.has(p.id))
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 6);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 pb-10">
      {/* 期刊刊头：眉题 + 大标题 + 引言 + CTA（左文右纸墨装饰，沿用 b3 分支 hero-grid 布局） */}
      {!cfgReady ? <HeroSkeleton /> : (
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
            <div className={`hero-deco-paper-2${heroQuote ? ' has-quote' : ''}`}>
              {heroQuote ? (
                <div className="hero-deco-quote">
                  <p className="hero-deco-quote-line">{heroQuote}</p>
                  {heroQuoteAuthor ? <p className="hero-deco-quote-author">—— {heroQuoteAuthor}</p> : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
      )}

      {/* 精选头条：精选或列表任一就绪即可先行渲染，都未就绪时显示骨架 */}
      {!(featReady || listReady) ? <LedeSkeleton /> : featured.length > 0 ? (
        <Reveal className="mt-2">
          <div className="section-header">
            <h2 className="section-title">
              精选文章
              <span className="mono-num">01</span>
            </h2>
            <Link href="/posts/" className="section-link">全部文章 →</Link>
          </div>
          {config?.featuredLayout === 'carousel'
            ? <FeaturedCarousel posts={featured} />
            : <FeaturedGrid posts={featured} />}
        </Reveal>
      ) : null}

      {/* 最新目录：列表未就绪时显示骨架 */}
      {!listReady ? <JournalSkeleton /> : (
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
      )}

      {/* 热门排行 */}
      {listReady && hot.length > 0 && (
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
