'use client';

/** 仪表盘：欢迎区 + 核心指标 + 访问趋势 + 热门文章 TOP5 + 快捷入口/待办（参考浅蓝清新后台风格） */
import { useEffect, useState } from 'react';
import { Card, Loading, Empty, Badge } from './ui';
import type { AdminStats } from '@/lib/types';
import { api } from '@/lib/api';

/** 统计卡图标：浅蓝渐变底（参考图风格） */
function StatIcon({ d }: { d: string }) {
  return (
    <span className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
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

/** 快捷入口（真实后台路由，参考图右侧「快捷入口」） */
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
  const maxDay = Math.max(1, ...days.map(([, v]) => v));

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
      {/* 欢迎区（参考图 B2B 工作台问候） */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">您好，欢迎回来</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">博客内容与访问数据总览</p>
        </div>
        <Badge tone="blue">数据已更新</Badge>
      </div>

      {/* 核心指标（参考图 4 主卡） */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {mainCards.map((c) => (
          <Card key={c.label} className="!p-4 flex items-center gap-3">
            <StatIcon d={c.icon} />
            <div className="min-w-0">
              <div className="text-xs text-slate-400">{c.label}</div>
              <div className="mt-0.5 text-2xl font-bold text-slate-900 dark:text-slate-100 truncate">{c.value}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* 次级指标（参考图「销售额/采购额/库存总值」行） */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {subCards.map((c) => (
          <Card key={c.label} className="!p-4 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d={c.icon} />
              </svg>
            </span>
            <div className="min-w-0">
              <div className="text-xs text-slate-400">{c.label}</div>
              <div className={`mt-0.5 text-xl font-bold truncate ${c.warn ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}`}>{c.value}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* 左区：趋势 + 排行；右区：快捷入口 + 待办（参考图两栏布局） */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* 近 30 天访问趋势（参考图渐变图表） */}
          {days.length > 0 && (
            <Card>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">近 30 天访问趋势</h2>
              <div className="flex items-end gap-1 h-32">
                {days.slice(-30).map(([date, count]) => (
                  <div key={date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <span className="text-[10px] text-slate-400">{count}</span>
                    <div
                      className="w-full rounded-t bg-blue-600 dark:bg-blue-500"
                      style={{ height: `${Math.max(4, (count / maxDay) * 100)}%` }}
                      title={`${date}: ${count}`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                <span>{days[0]?.[0]}</span>
                <span>{days[days.length - 1]?.[0]}</span>
              </div>
            </Card>
          )}

          {/* 热门文章 TOP5（参考图「热销商品 TOP5」大号编号） */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">热门文章 TOP5</h2>
              <a href="#/posts" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">查看全部</a>
            </div>
            {topPosts.length ? (
              <div className="space-y-1">
                {topPosts.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-4 py-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                    <span className={`w-8 text-lg font-bold text-slate-200 dark:text-slate-600 ${i < 3 ? 'text-blue-500 dark:text-blue-400' : ''}`}>
                      {i + 1}
                    </span>
                    <a href={`/posts/${p.slug}/`} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-sm text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400">
                      {p.title}
                    </a>
                    <Badge tone={p.status === 'published' ? 'green' : 'gray'}>{p.status === 'published' ? '已发布' : '草稿'}</Badge>
                    <span className="text-xs text-slate-400 w-16 text-right shrink-0">{p.views} 阅读</span>
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
          {/* 快捷入口（参考图 2×3 网格） */}
          <Card>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">快捷入口</h2>
            <div className="grid grid-cols-3 gap-3">
              {QUICK.map((q) => (
                <a
                  key={q.label}
                  href={q.hash}
                  className="flex flex-col items-center gap-2 px-2 py-3 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d={q.icon} />
                  </svg>
                  <span className="text-xs">{q.label}</span>
                </a>
              ))}
            </div>
          </Card>

          {/* 待办（参考图「今日待办」列表） */}
          <Card>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">待办事项</h2>
            <div className="space-y-3">
              {[
                { label: '草稿文章', value: stats.draftPosts, href: '#/posts' },
                { label: '待审核评论', value: stats.pendingComments, href: '#/comments', warn: stats.pendingComments > 0 },
                { label: '已发布文章', value: stats.publishedPosts, href: '#/posts' },
                { label: '分类 / 标签', value: `${stats.totalCategories} / ${stats.totalTags}`, href: '#/categories' },
              ].map((t) => (
                <a key={t.label} href={t.href} className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                  <span className="text-sm text-slate-600 dark:text-slate-300">{t.label}</span>
                  <span className={`text-sm font-semibold ${t.warn ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}`}>{t.value}</span>
                </a>
              ))}
            </div>
          </Card>

          {/* 平台信息（参考图「平台公告」；展示真实技术栈，不编造公告） */}
          <Card>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">平台信息</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">框架</span><span className="text-slate-700 dark:text-slate-200">Next.js</span></div>
              <div className="flex justify-between"><span className="text-slate-400">样式</span><span className="text-slate-700 dark:text-slate-200">Tailwind CSS</span></div>
              <div className="flex justify-between"><span className="text-slate-400">托管</span><span className="text-slate-700 dark:text-slate-200">EdgeOne Pages</span></div>
              <div className="flex justify-between"><span className="text-slate-400">存储</span><span className="text-slate-700 dark:text-slate-200">EdgeOne KV / Blob</span></div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
