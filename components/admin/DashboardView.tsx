'use client';

/** 仪表盘：欢迎区 + 核心指标 + 访问趋势 + 热门文章 TOP5 + 快捷入口/待办（参考浅蓝清新后台风格） */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, Loading, Empty, Btn, Badge } from './ui';
import type { AdminStats, TrendPoint, VisitStats } from '@/lib/types';
import { api } from '@/lib/api';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** 把 2026-10-15 转成可计算的 Date（按本地时区切日，避免 UTC 位移导致日期漂移） */
function parseDay(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** 轴上取整数步长：返回 { step, max }，保证 max >= 峰值且有 5 个刻度区间 */
function axisFor(rawMax: number) {
  const r = Math.max(1, Math.ceil(rawMax));
  const CANDIDATES = [1, 2, 3, 5, 6, 10, 15, 20, 30, 50, 100, 150, 200, 300, 500, 1000, 1500, 2000, 3000, 5000, 10000, 20000, 50000];
  const step = CANDIDATES.find((s) => s * 5 >= r) || 50000;
  return { step, max: step * 5 };
}

function axisLabel(n: number) {
  if (n >= 10000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(n);
}

/**
 * 近 30 天访问趋势：真实日历折线图。
 *
 * 序列由服务端按自然日补全（无访问的日子为 0），横轴做「日期 → 像素」线性映射，
 * 因此每个点都落在它真实的日期位置上，不再把稀疏记录摊平成一条与日期无关的曲线。
 * 含 Y 轴刻度 + 网格、底部日期轴（今天单独标出）、虚线段表示「站点访问」的 7 日均值、
 * 悬浮/点击/键盘方向键三种读数方式。
 */
function TrendChart({ data, movingAverage }: { data: TrendPoint[]; movingAverage: number[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = data.length;
  // 悬浮优先；移开后回落到点击固定的那天
  const show = hover ?? pinned;
  const { step, max: axisMax } = axisFor(Math.max(...data.map((d) => d.visits), 0));
  const hasData = data.some((d) => d.visits > 0);

  const PAD_L = 46;
  const PAD_R = 16;
  const PAD_T = 22;
  const PAD_B = 30;
  const H = 258;
  const plotW = Math.max(1, width - PAD_L - PAD_R);
  const plotH = H - PAD_T - PAD_B;
  const dx = n > 1 ? plotW / (n - 1) : 0;
  const px = (i: number) => PAD_L + i * dx;
  // 顶部留 12% 余量：满量程的尖峰也不会顶到绘图区上沿，读数卡片有余地且不压线
  const scaleMax = axisMax * 1.12;
  const py = (v: number) => PAD_T + plotH - (Math.min(v, scaleMax) / scaleMax) * plotH;
  const baseY = PAD_T + plotH;

  const idxFromX = (clientX: number) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect || dx <= 0) return 0;
    return Math.min(n - 1, Math.max(0, Math.round((clientX - rect.left - PAD_L) / dx)));
  };

  const total = data.reduce((a, d) => a + d.visits, 0);
  const average = n ? total / n : 0;
  const maPath = movingAverage
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)} ${py(v).toFixed(1)}`)
    .join(' ');
  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)} ${py(d.visits).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${px(n - 1).toFixed(1)} ${baseY} L${px(0).toFixed(1)} ${baseY} Z`;

  // 底部日期刻度：窄屏每 7 天一格，宽屏每 5 天一格；今天那一格一定出现
  const tickEvery = width > 0 && width < 520 ? 7 : 5;
  const tickIdx: number[] = [];
  for (let i = n - 1; i >= 0; i -= tickEvery) tickIdx.unshift(i);
  // 首端只有离下一格够远才补，否则窄屏上两个日期会叠在一起
  if (tickIdx[0] > tickEvery - 2) tickIdx.unshift(0);

  const cur = show !== null ? data[show] : null;
  const prev = show !== null && show > 0 ? data[show - 1] : null;
  const delta = cur && prev ? cur.visits - prev.visits : null;
  // 读数卡片限制在绘图区内：高点时落到曲线下方，避免顶出卡片被裁切
  const tipLeft = show !== null ? Math.min(Math.max(px(show), 78), Math.max(width - 78, 78)) : 0;
  // 读数卡片固定吸在绘图区上沿：纵轴有 12% 余量，最高点的 y 也低于卡片，不会互相遮挡
  const tipTop = 2;

  return (
    <div>
      {/* 汇总条：区间合计 / 日均 / 峰值，全部来自这条序列本身 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
        <span className="inline-flex items-center gap-1.5">
          <i className="w-3.5 h-0.5 rounded-full bg-brand-600 dark:bg-brand-400" aria-hidden="true" />
          每日访问
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="w-3.5 border-t border-dashed border-brand-500 dark:border-brand-400" aria-hidden="true" />
          7 日滑动均值
        </span>
        <span className="ml-auto">
          合计 {total.toLocaleString()} · 日均 {average.toFixed(1)} · 峰值 {Math.max(...data.map((d) => d.visits), 0).toLocaleString()}
        </span>
      </div>

      {/* overflow-hidden + SVG 绝对定位：否则 svg 的 width 会反过来撑住容器，
          ResizeObserver 只会量到"历史最大宽度"，窗口变窄时曲线就不会收缩 */}
      <div
        ref={boxRef}
        className="relative select-none overflow-hidden"
        style={{ height: H }}
        role="group"
        aria-label={`近 ${n} 天访问趋势：${data[0]?.date || ''} 至 ${data[n - 1]?.date || ''}，合计 ${total} 次，日均 ${average.toFixed(1)} 次`}
        onPointerLeave={() => setHover(null)}
      >
        {width > 0 && (
          <svg
            width={width}
            height={H}
            className="absolute inset-0 block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded-md"
            tabIndex={0}
            onPointerMove={(e) => setHover(idxFromX(e.clientX))}
            onPointerDown={(e) => {
              const i = idxFromX(e.clientX);
              setPinned((p) => (p === i ? null : i));
            }}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
              e.preventDefault();
              const from = show ?? n - 1;
              setPinned(Math.min(n - 1, Math.max(0, from + (e.key === 'ArrowLeft' ? -1 : 1))));
              setHover(null);
            }}
          >
            <defs>
              <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--t-brand-600)" stopOpacity="0.20" />
                <stop offset="100%" stopColor="var(--t-brand-600)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* 水平网格 + Y 轴刻度 */}
            {Array.from({ length: 6 }, (_, k) => k * step).map((v) => (
              <g key={`y${v}`}>
                <line
                  x1={PAD_L} x2={PAD_L + plotW} y1={py(v)} y2={py(v)}
                  stroke="var(--t-slate-200)" strokeWidth="1"
                  strokeDasharray={v === 0 ? undefined : '3 4'}
                />
                <text x={PAD_L - 8} y={py(v) + 3.5} textAnchor="end" fontSize="10" fill="var(--t-slate-400)">
                  {axisLabel(v)}
                </text>
              </g>
            ))}

            {/* 垂直网格：与底部日期刻度一一对应，读数可横向对齐 */}
            {tickIdx.map((i) => (
              <line key={`x${i}`} x1={px(i)} x2={px(i)} y1={PAD_T} y2={baseY} stroke="var(--t-slate-200)" strokeWidth="1" strokeDasharray="2 6" />
            ))}

            {/* 面积 + 折线 + 均值线 */}
            <path d={areaPath} fill="url(#trendArea)" stroke="none" />
            {hasData && (
              <path d={maPath} fill="none" stroke="var(--t-brand-500)" strokeWidth="1.5" strokeDasharray="4 4" strokeLinecap="round" opacity="0.75" />
            )}
            <path
              d={linePath} fill="none" stroke="var(--t-brand-600)" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
            />

            {/* 有访问的日子画点，今天额外描一圈 */}
            {data.map((d, i) => d.visits > 0 && (
              <circle
                key={`p${d.date}`} cx={px(i)} cy={py(d.visits)}
                r={show === i ? 4.5 : 2.5}
                fill={show === i ? 'var(--t-brand-600)' : 'var(--t-card)'}
                stroke="var(--t-brand-600)" strokeWidth="2"
                style={{ transition: 'r 120ms ease-out, fill 120ms ease-out' }}
              />
            ))}
            {n > 0 && data[n - 1].visits === 0 && (
              <circle cx={px(n - 1)} cy={py(0)} r="3" fill="var(--t-brand-600)" opacity="0.9" />
            )}

            {/* 悬浮准星 */}
            {show !== null && (
              <line x1={px(show)} x2={px(show)} y1={PAD_T - 6} y2={baseY} stroke="var(--t-brand-600)" strokeWidth="1" opacity="0.45" />
            )}

            {/* 底部日期轴 */}
            <line x1={PAD_L} x2={PAD_L + plotW} y1={baseY} y2={baseY} stroke="var(--t-slate-300)" strokeWidth="1" />
            {tickIdx.map((i) => {
              const d = data[i];
              if (!d) return null;
              const isToday = i === n - 1;
              return (
                <text
                  key={`t${d.date}`} x={px(i)} y={baseY + 16}
                  textAnchor={i === 0 ? 'start' : isToday ? 'end' : 'middle'}
                  fontSize="10"
                  fontWeight={isToday ? 600 : 400}
                  fill={isToday ? 'var(--t-brand-600)' : 'var(--t-slate-400)'}
                >
                  {isToday && width >= 520 ? `今天 ${d.date.slice(5)}` : d.date.slice(5)}
                </text>
              );
            })}
          </svg>
        )}

        {/* 读数卡片：悬浮 / 点击固定 / 键盘左右键都可读，包含日期、星期、当日访问与环比 */}
        {cur && (
          <div className="absolute z-10 -translate-x-1/2 pointer-events-none" style={{ left: tipLeft, top: tipTop }}>
            <div className="rounded-lg bg-[var(--t-slate-900)] dark:bg-[var(--t-slate-50)] text-[var(--t-slate-50)] dark:text-[var(--t-slate-900)] px-2.5 py-1.5 text-[11px] leading-tight shadow-lg whitespace-nowrap tabular-nums">
              <div className="font-medium">
                {cur.date} {WEEKDAYS[parseDay(cur.date).getDay()]}
                {pinned === show ? ' · 已固定' : ''}
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <span>访问 {cur.visits} 次</span>
                {delta !== null && (
                  <span className={delta > 0 ? 'text-emerald-300 dark:text-emerald-600' : 'text-rose-300 dark:text-rose-400'}>
                    {delta > 0 ? `+${delta}` : delta}
                  </span>
                )}
                <span className="opacity-70">7 日均 {movingAverage[show ?? 0]?.toFixed(1)}</span>
              </div>
            </div>
          </div>
        )}

        {/* 整段无数据时的空态，避免出现一条看似正常的假直线 */}
        {width > 0 && !hasData && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs text-slate-400 bg-[var(--t-card)] dark:bg-[var(--t-slate-900)] px-2 py-1 rounded-md border border-dashed border-slate-300 dark:border-slate-700">
              最近 {n} 天还没有访问记录
            </span>
          </div>
        )}
      </div>

      {pinned !== null && (
        <div className="mt-1 text-right">
          <button type="button" className="text-[11px] text-slate-400 hover:text-brand-600 dark:hover:text-brand-400" onClick={() => setPinned(null)}>
            取消固定读数
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * 服务端未返回 trend 时（例如函数未更新）在浏览器侧按日历补一遍，
 * 保证曲线仍然对齐真实日期。
 */
function buildFallbackTrend(visits: VisitStats): TrendPoint[] {
  const days = visits.days || {};
  const last = Object.keys(days).sort().pop() || visits.lastDate || new Date().toISOString().slice(0, 10);
  const out: TrendPoint[] = [];
  const base = parseDay(last);
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
    const p = (v: number) => String(v).padStart(2, '0');
    const key = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    out.push({ date: key, visits: Number(days[key]) || 0 });
  }
  return out;
}

/** 滑动平均：窗口内不足 7 天时按实际天数取均值 */
function movingAvg(values: number[], win = 7): number[] {
  return values.map((_, i) => {
    const from = Math.max(0, i - win + 1);
    let sum = 0;
    for (let k = from; k <= i; k += 1) sum += values[k];
    return Math.round((sum / (i - from + 1)) * 100) / 100;
  });
}

/** 统计卡图标：浅蓝渐变底（参考图风格） */
function StatIcon({ d }: { d: string }) {
  return (
    <span className="w-10 h-10 rounded-lg bg-brand-600 text-white flex items-center justify-center shadow-sm shrink-0">
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
  const [updatedAt, setUpdatedAt] = useState('');

  /** 拉取统计；keepData 用于静默轮询，避免列表闪回 loading */
  const load = useCallback((keepData: boolean) => {
    if (!keepData) setStats(null);
    return api.getStats().then((d) => {
      if (!d?.ok) return;
      setStats(d.stats);
      setUpdatedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    load(false);
    // 趋势曲线跟随真实访问数据刷新：页面可见时每 60 秒拉一次最新统计
    const tick = () => { if (document.visibilityState === 'visible' && alive) load(true); };
    const timer = window.setInterval(tick, 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  if (!stats) return <Loading />;

  const trend = stats.trend;
  const trendData = trend?.series?.length ? trend.series : buildFallbackTrend(stats.visits);
  const trendMa = trend?.series?.length && trend.movingAverage?.length === trend.series.length
    ? trend.movingAverage
    : movingAvg(trendData.map((d) => d.visits));

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
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-display">您好，欢迎回来</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">博客内容与访问数据总览</p>
        </div>
        <Badge tone="blue">{updatedAt ? `数据更新于 ${updatedAt}` : '正在加载数据'}</Badge>
      </div>

      {/* 核心指标（参考图 4 主卡） */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {mainCards.map((c) => (
          <Card key={c.label} className="!p-4 flex items-center gap-3">
            <StatIcon d={c.icon} />
            <div className="min-w-0">
              <div className="text-xs text-slate-400">{c.label}</div>
              <div className="mt-0.5 text-2xl font-bold text-slate-900 dark:text-slate-100 truncate tabular-nums">{c.value}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* 次级指标（参考图「销售额/采购额/库存总值」行） */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {subCards.map((c) => (
          <Card key={c.label} className="!p-4 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d={c.icon} />
              </svg>
            </span>
            <div className="min-w-0">
              <div className="text-xs text-slate-400">{c.label}</div>
              <div className={`mt-0.5 text-xl font-bold truncate tabular-nums ${c.warn ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}`}>{c.value}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* 左区：趋势 + 排行；右区：快捷入口 + 待办（参考图两栏布局） */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 min-w-0 space-y-6">
          {/* 近 30 天访问趋势：横轴对齐真实日历，悬浮/点击/键盘读数 */}
          {trendData.length > 0 && (
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">近 30 天访问趋势</h2>
                  <p className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
                    {trendData[0].date} ~ {trendData[trendData.length - 1].date}
                    {trend?.activeDays != null && ` · ${trend.activeDays}/${trendData.length} 天有访问`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {trend?.changeRatio != null && (
                    <span
                      className={`text-xs tabular-nums ${trend.changeRatio >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                      title="近 15 天相对前 15 天的访问变化"
                    >
                      {trend.changeRatio >= 0 ? '↑' : '↓'} {Math.abs(Math.round(trend.changeRatio * 100))}%
                    </span>
                  )}
                  <Btn size="sm" variant="secondary" onClick={() => load(true)}>刷新</Btn>
                </div>
              </div>
              <TrendChart data={trendData} movingAverage={trendMa} />
              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                <span>峰值 {Math.max(...trendData.map((d) => d.visits), 0).toLocaleString()} 次{trend?.peakDate ? `（${trend.peakDate.slice(5)}）` : ''}</span>
                <span className="tabular-nums">数据来源：站点访问埋点 · {updatedAt ? `更新于 ${updatedAt}` : '正在加载'}</span>
              </div>
            </Card>
          )}

          {/* 热门文章 TOP5（参考图「热销商品 TOP5」大号编号） */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">热门文章 TOP5</h2>
              <a href="#/posts" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">查看全部</a>
            </div>
            {topPosts.length ? (
              <div className="space-y-1">
                {topPosts.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-4 py-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                    <span className={`w-8 text-lg font-bold text-slate-200 dark:text-slate-600 ${i < 3 ? 'text-brand-500 dark:text-brand-400' : ''}`}>
                      {i + 1}
                    </span>
                    <a href={`/posts/${p.slug}/`} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-sm text-slate-700 dark:text-slate-200 hover:text-brand-600 dark:hover:text-brand-400">
                      {p.title}
                    </a>
                    <Badge tone={p.status === 'published' ? 'green' : 'gray'}>{p.status === 'published' ? '已发布' : '草稿'}</Badge>
                    <span className="text-xs text-slate-400 w-16 text-right shrink-0 tabular-nums">{p.views} 阅读</span>
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
                  className="flex flex-col items-center gap-2 px-2 py-3 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-brand-500/10 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
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
                  <span className={`text-sm font-semibold tabular-nums ${t.warn ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}`}>{t.value}</span>
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
