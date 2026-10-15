'use client';

/** 仪表盘：欢迎区 + 核心指标 + 访问趋势（带柔和面积渐变填充） + 热门文章 TOP5 + 快捷入口/待办 */
import { useEffect, useState } from 'react';
import { Card, Loading, Empty, Badge } from './ui';
import type { AdminStats } from '@/lib/types';
import { api } from '@/lib/api';

/** 近 30 天访问趋势：折线图 + 面积渐变填充（悬停显示数值，点击固定数值，再点取消） */
function TrendChart({ data }: { data: [string, number][] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);

  const n = data.length;
  const max = Math.max(1, ...data.map(([, v]) => v));
  const padX = 4;
  const padY = 12;
  const pos = (i: number) => {
    const x = n <= 1 ? 50 : padX + (i / (n - 1)) * (100 - padX * 2);
    const y = padY + (1 - data[i][1] / max) * (100 - padY * 2);
    return { x, y };
  };
  const line = data
    .map((_, i) => {
      const { x, y } = pos(i);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
  const firstPos = pos(0);
  const lastPos = pos(Math.max(0, n - 1));
  const area = `${line} L${lastPos.x.toFixed(2)} 96 L${firstPos.x.toFixed(2)} 96 Z`;
  const active = pinned ?? hover;

  return (
    <div
      className="relative h-40 select-none"
      role="img"
      aria-label={`近 30 天访问趋势，共 ${n} 天，峰值 ${max} 次访问`}
      onMouseLeave={() => { if (pinned === null) setHover(null); }}
    >
      {/* 折线 + 柔和面积填充 */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="trendAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--t-brand-500)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--t-brand-500)" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <line x1="4" y1="25" x2="96" y2="25" stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeDasharray="2 2" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <line x1="4" y1="55" x2="96" y2="55" stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeDasharray="2 2" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <line x1="4" y1="85" x2="96" y2="85" stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeDasharray="2 2" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {n > 1 && <path d={area} fill="url(#trendAreaGrad)" />}
        <path
          d={line}
          fill="none"
          stroke="var(--t-brand-600)"
          strokeWidth="2.2"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {/* 数据点 + tooltip */}
      {data.map(([date, count], i) => {
        const { x, y } = pos(i);
        const on = active === i;
        return (
          <div key={date}>
            {on && (
              <div
                className="absolute z-10 px-2.5 py-1 rounded-lg bg-[var(--t-slate-900)] text-[var(--t-slate-50)] dark:bg-[var(--t-slate-50)] dark:text-[var(--t-slate-900)] text-[11px] font-mono leading-none shadow-lg pointer-events-none whitespace-nowrap tabular-nums"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform:
                    i === 0 ? 'translate(0, calc(-100% - 10px))'
                      : i === n - 1 ? 'translate(-100%, calc(-100% - 10px))'
                      : 'translate(-50%, calc(-100% - 10px))',
                }}
              >
                {date.slice(5).replace('-', '/')} · {count} 次
              </div>
            )}
            <div
              className={`absolute rounded-full cursor-pointer transition-all duration-150 ${
                on
                  ? 'w-3.5 h-3.5 bg-brand-600 dark:bg-brand-400 ring-2 ring-white dark:ring-[var(--t-slate-900)] shadow'
                  : 'w-2 h-2 bg-brand-400 dark:bg-brand-500 hover:bg-brand-600 dark:hover:bg-brand-400 hover:scale-125'
              }`}
              style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
              onMouseEnter={() => setHover(i)}
              onClick={() => setPinned(pinned === i ? null : i)}
              aria-hidden="true"
            />
          </div>
        );
      })}
    </div>
  );
}

/** 统计卡图标 */
function StatIcon({ d }: { d: string }) {
  return (
    <span className="w-11 h-11 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_2px_6px_rgba(154,67,24,0.2)] shrink-0">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
      </svg>
    </span>
  );
}

const ICONS = {
  visits: 'M3 13h4l2-7 4 14 2-8h6',
  today: 'M12 8v4l3 3M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  posts: 'M6 3h9l4 4v14H6V3zM15 3v5h4M9 13h6M9 17h6',
  comments: 'M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5zM8 10h.01M12 10h.01M16 10h.01',
  published: 'M9 12l2 2 4-4M12 3l8 3v6c0 4.5-3.2 7.6-8 9-4.8-1.4-8-4.5-8-9V6l8-3z',
  draft: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z',
  pending: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  tags: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
};

/** 快捷入口 */
const QUICK = [
  { label: '写文章', hash: '#/posts/new', icon: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z' },
  { label: '文章管理', hash: '#/posts', icon: 'M6 3h9l4 4v14H6V3zM15 3v5h4M9 13h6M9 17h6' },
  { label: '评论审核', hash: '#/comments', icon: 'M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5zM8 10h.01M12 10h.01M16 10h.01' },
  { label: '分类管理', hash: '#/categories', icon: 'M4 5a2 2 0 0 1 2-2h6v16H6a2 2 0 0 0-2 2V5zM14 3h4a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2h-4V3z' },
  { label: '标签管理', hash: '#/tags', icon: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01' },
  { label: '站点设置', hash: '#/settings', icon: 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM12 12l8-4.5M12 12v9M12 12L4 7.5' },
];

export default function DashboardView() {
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    let alive = true;
    api.getStats().then((d) => {
      if (!alive) return;
      if (d?.ok) setStats(d.stats);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!stats) return <Loading />;

  const days = Object.entries(stats.visits.days || {}).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const trendData = days.slice(-30);

  const mainCards = [
    { label: '总访问量', value: stats.visits.total, icon: ICONS.visits },
    { label: '今日访问', value: stats.visits.today, icon: ICONS.today },
    { label: '文章总数', value: stats.totalPosts, icon: ICONS.posts },
    { label: '评论总数', value: stats.totalComments, icon: ICONS.comments },
  ];
  const subCards = [
    { label: '已发布', value: stats.publishedPosts, icon: ICONS.published },
    { label: '草稿', value: stats.draftPosts, icon: ICONS.draft },
    { label: '待审核评论', value: stats.pendingComments, icon: ICONS.pending, warn: stats.pendingComments > 0 },
    { label: '分类 / 标签', value: `${stats.totalCategories} / ${stats.totalTags}`, icon: ICONS.tags },
  ];

  const topPosts = stats.topPosts.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* 欢迎区 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[var(--t-card)] dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-[var(--shadow-xs)]">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-display">您好，欢迎回来</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">博客内容与实时访问数据总览</p>
        </div>
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <Badge tone="blue">数据已同步</Badge>
          <a
            href="#/posts/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-brand-600 text-white hover:bg-brand-700 transition-all shadow-sm"
          >
            ＋ 写新文章
          </a>
        </div>
      </div>

      {/* 核心指标 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {mainCards.map((c) => (
          <Card key={c.label} className="!p-4 flex items-center gap-3.5 hover:-translate-y-0.5 transition-transform">
            <StatIcon d={c.icon} />
            <div className="min-w-0">
              <div className="text-xs text-slate-400">{c.label}</div>
              <div className="mt-0.5 text-2xl font-bold text-slate-900 dark:text-slate-100 truncate tabular-nums">{c.value}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* 次级指标 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {subCards.map((c) => (
          <Card key={c.label} className="!p-4 flex items-center gap-3 hover:-translate-y-0.5 transition-transform">
            <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d={c.icon} />
              </svg>
            </span>
            <div className="min-w-0">
              <div className="text-xs text-slate-400">{c.label}</div>
              <div className={`mt-0.5 text-xl font-bold truncate tabular-nums ${c.warn ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}`}>
                {c.value}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* 左区：趋势 + 排行；右区：快捷入口 + 待办 */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* 近 30 天访问趋势 */}
          {trendData.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">近 30 天访问趋势</h2>
                <span className="text-xs font-mono text-slate-400 tabular-nums">峰值 {Math.max(...trendData.map(([, v]) => v))} 次</span>
              </div>
              <TrendChart data={trendData} />
              <div className="mt-2 flex justify-between text-[11px] font-mono text-slate-400 tabular-nums">
                <span>{trendData[0]?.[0]}</span>
                <span>{trendData[trendData.length - 1]?.[0]}</span>
              </div>
            </Card>
          )}

          {/* 热门文章 TOP5 */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">热门文章 TOP5</h2>
              <a href="#/posts" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">查看全部 →</a>
            </div>
            {topPosts.length ? (
              <div className="space-y-1">
                {topPosts.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-4 py-2.5 px-2 -mx-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-0 transition-colors">
                    <span className={`w-7 text-lg font-display font-bold ${i < 3 ? 'text-brand-600 dark:text-brand-400' : 'text-slate-300 dark:text-slate-600'}`}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <a href={`/posts/${p.slug}/`} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-brand-600 dark:hover:text-brand-400">
                      {p.title}
                    </a>
                    <Badge tone={p.status === 'published' ? 'green' : 'gray'}>{p.status === 'published' ? '已发布' : '草稿'}</Badge>
                    <span className="text-xs font-mono text-slate-400 w-16 text-right shrink-0 tabular-nums">{p.views} 阅读</span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty text="暂无数据" />
            )}
          </Card>
        </div>

        {/* 右栏 */}
        <div className="space-y-6">
          {/* 快捷入口 */}
          <Card>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">快捷入口</h2>
            <div className="grid grid-cols-3 gap-2.5">
              {QUICK.map((q) => (
                <a
                  key={q.label}
                  href={q.hash}
                  className="flex flex-col items-center gap-2 px-2 py-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-brand-50 hover:border-brand-200 dark:hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 hover:-translate-y-0.5 transition-all"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d={q.icon} />
                  </svg>
                  <span className="text-xs font-medium">{q.label}</span>
                </a>
              ))}
            </div>
          </Card>

          {/* 待办 */}
          <Card>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">待办事项</h2>
            <div className="space-y-2.5">
              {[
                { label: '草稿文章', value: stats.draftPosts, href: '#/posts' },
                { label: '待审核评论', value: stats.pendingComments, href: '#/comments', warn: stats.pendingComments > 0 },
                { label: '已发布文章', value: stats.publishedPosts, href: '#/posts' },
                { label: '分类 / 标签', value: `${stats.totalCategories} / ${stats.totalTags}`, href: '#/categories' },
              ].map((t) => (
                <a key={t.label} href={t.href} className="flex items-center justify-between py-2 px-2.5 -mx-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-0 transition-colors">
                  <span className="text-sm text-slate-600 dark:text-slate-300">{t.label}</span>
                  <span className={`text-sm font-mono font-semibold tabular-nums ${t.warn ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}`}>
                    {t.value}
                  </span>
                </a>
              ))}
            </div>
          </Card>

          {/* 平台信息 */}
          <Card>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">平台信息</h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">框架</span><span className="font-mono text-xs text-slate-700 dark:text-slate-200">Next.js</span></div>
              <div className="flex justify-between"><span className="text-slate-400">样式</span><span className="font-mono text-xs text-slate-700 dark:text-slate-200">Tailwind CSS</span></div>
              <div className="flex justify-between"><span className="text-slate-400">托管</span><span className="font-mono text-xs text-slate-700 dark:text-slate-200">EdgeOne Pages</span></div>
              <div className="flex justify-between"><span className="text-slate-400">存储</span><span className="font-mono text-xs text-slate-700 dark:text-slate-200">EdgeOne KV / Blob</span></div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
