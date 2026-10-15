import { json, fail } from '../_lib/response.js';
import { getVisitStats, getPostList, getComments, getViews, getLikes, getCategories, getTags, buildVisitSeries, summarizeVisitSeries } from '../_lib/data.js';
import { requireAdmin } from '../_lib/auth.js';
import { getKv } from '../_lib/kv.js';

/** 趋势图窗口长度（自然日，含今天） */
const TREND_SPAN = 30;

/** GET /api/stats — 后台访问统计总览（管理员） */
export async function onRequestGet({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  const [visit, posts, comments, categories, tags] = await Promise.all([
    getVisitStats(env),
    getPostList(env),
    getComments(env),
    getCategories(env),
    getTags(env),
  ]);

  // 文章维度统计
  const postStats = [];
  for (const p of posts) {
    const [views, likes] = await Promise.all([getViews(env, p.id), getLikes(env, p.id)]);
    postStats.push({ id: p.id, slug: p.slug, title: p.title, status: p.status, views, likes, publishedAt: p.publishedAt });
  }
  postStats.sort((a, b) => b.views - a.views);

  // 近 TREND_SPAN 个自然日的访问序列：KV 只存有访问的日子，这里按日历补 0，
  // 保证前端曲线的每个点都对得上真实日期。
  const series = buildVisitSeries(visit.days, { span: TREND_SPAN });

  return json({
    ok: true,
    stats: {
      visits: visit,
      trend: { span: TREND_SPAN, series, ...summarizeVisitSeries(series) },
      totalPosts: posts.length,
      publishedPosts: posts.filter((p) => p.status === 'published').length,
      draftPosts: posts.filter((p) => p.status === 'draft').length,
      totalComments: comments.length,
      pendingComments: comments.filter((c) => c.status === 'pending').length,
      totalCategories: categories.length,
      totalTags: tags.length,
      topPosts: postStats.slice(0, 10),
    },
  });
}

export const onRequest = onRequestGet;
