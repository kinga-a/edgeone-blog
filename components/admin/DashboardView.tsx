'use client';

/** 仪表盘：访问统计 + 内容概览 + 热门文章 */
import { useEffect, useState } from 'react';
import { Card, Loading, Empty, Badge } from './ui';
import type { AdminStats } from '@/lib/types';
import { api } from '@/lib/api';

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

  const cards = [
    { label: '总访问量', value: stats.visits.total, tone: 'text-brand-600 dark:text-brand-400' },
    { label: '今日访问', value: stats.visits.today, tone: 'text-emerald-600 dark:text-emerald-400' },
    { label: '文章总数', value: stats.totalPosts, tone: 'text-slate-900 dark:text-slate-100' },
    { label: '已发布', value: stats.publishedPosts, tone: 'text-slate-900 dark:text-slate-100' },
    { label: '草稿', value: stats.draftPosts, tone: 'text-slate-900 dark:text-slate-100' },
    { label: '评论总数', value: stats.totalComments, tone: 'text-slate-900 dark:text-slate-100' },
    { label: '待审核评论', value: stats.pendingComments, tone: stats.pendingComments ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100' },
    { label: '分类 / 标签', value: `${stats.totalCategories} / ${stats.totalTags}`, tone: 'text-slate-900 dark:text-slate-100' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">仪表盘</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">博客内容与访问数据总览</p>
      </div>

      {/* 指标卡 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="!p-4">
            <div className="text-xs text-slate-400">{c.label}</div>
            <div className={`mt-1.5 text-2xl font-bold ${c.tone}`}>{c.value}</div>
          </Card>
        ))}
      </div>

      {/* 近 30 天访问趋势 */}
      {days.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">近 30 天访问趋势</h2>
          <div className="flex items-end gap-1 h-32">
            {days.slice(-30).map(([date, count]) => (
              <div key={date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <span className="text-[10px] text-slate-400">{count}</span>
                <div
                  className="w-full rounded-t bg-gradient-to-t from-brand-600 to-brand-400 dark:from-brand-700 dark:to-brand-500"
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

      {/* 热门文章 */}
      <Card>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">热门文章 Top 10</h2>
        {stats.topPosts.length ? (
          <div className="space-y-2">
            {stats.topPosts.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 text-sm">
                <span className="w-5 text-slate-400 text-xs">{i + 1}</span>
                <a href={`/posts/${p.slug}/`} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-slate-700 dark:text-slate-200 hover:text-brand-600 dark:hover:text-brand-400">
                  {p.title}
                </a>
                <Badge tone={p.status === 'published' ? 'green' : 'gray'}>{p.status === 'published' ? '已发布' : '草稿'}</Badge>
                <span className="text-xs text-slate-400 w-16 text-right">{p.views} 阅读</span>
                <span className="text-xs text-slate-400 w-14 text-right">{p.likes} 赞</span>
              </div>
            ))}
          </div>
        ) : (
          <Empty text="暂无数据" />
        )}
      </Card>
    </div>
  );
}
