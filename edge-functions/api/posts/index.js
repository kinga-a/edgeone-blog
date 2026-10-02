import { json, fail, readJson, parseSearchParams, intParam, publicHeaders } from '../_lib/response.js';
import { getPostList, getPublicPosts, createPost, getCategories, getTags, ensureTagByName, getPostStatsBatch } from '../_lib/data.js';import { requireAdmin } from '../_lib/auth.js';

/**
 * GET /api/posts — 文章列表
 * 参数：page, pageSize, category, tag, status, q, sort, scope
 * 可见性规则：
 * - 未登录：仅「已发布 + 公开」文章
 * - 已登录管理员（前台请求）：已发布文章全量（公开 + 私人）
 * - 后台请求（scope=admin 且已登录）：全量（含草稿与私人），配合 status 筛选
 * POST /api/posts — 新建文章（管理员）
 */
export async function onRequestGet({ request, env }) {
  const params = parseSearchParams(request.url);
  const page = intParam(params.page, 1);
  const pageSize = Math.min(intParam(params.pageSize, 10), 50);
  const categoryId = params.category || '';
  const tagId = params.tag || '';
  const status = params.status || '';
  const q = (params.q || '').trim().toLowerCase();

  const admin = await requireAdmin(request, env).catch(() => ({ ok: false }));
  const adminScope = params.scope === 'admin' && admin.ok;
  let list;
  if (admin.ok) {
    list = await getPostList(env);
    // 前台已登录只看已发布（公开 + 私人）；后台 scope=admin 保留草稿全量
    if (!adminScope) list = list.filter((p) => p.status === 'published');
  } else {
    list = await getPublicPosts(env);
  }
  if (status) list = list.filter((p) => p.status === status);
  if (categoryId) list = list.filter((p) => p.categoryId === categoryId);
  if (tagId) list = list.filter((p) => (p.tags || []).includes(tagId));
  if (q) list = list.filter((p) =>
    p.title.toLowerCase().includes(q) ||
    (p.summary || '').toLowerCase().includes(q)
  );

  const total = list.length;
  const start = (page - 1) * pageSize;
  const rawItems = list.slice(start, start + pageSize);

  // 附加分类名 + 统计（views/likes/comments）
  const categories = await getCategories(env);
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const statsMap = await getPostStatsBatch(env, rawItems.map((p) => p.id));
  const items = rawItems.map((p) => {
    const s = statsMap.get(p.id) || { views: 0, likes: 0, comments: 0 };
    return {
      ...p,
      categoryName: catMap.get(p.categoryId) || '',
      views: s.views,
      likes: s.likes,
      commentCount: s.comments,
    };
  });

  return json({
    ok: true,
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }, { headers: publicHeaders() });
}

export async function onRequestPost({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  const body = await readJson(request);
  if (!body) return fail(400, '请求体无效');
  try {
    // 支持通过名称自动解析分类 / 创建标签
    if (Array.isArray(body.categoryName) && !body.categoryId) {
      const categories = await getCategories(env);
      const hit = categories.find((c) => c.name === body.categoryName || c.slug === body.categoryName);
      if (hit) body.categoryId = hit.id;
    }
    // 统一规范化 tags：前端可能传 id 数组或名字数组，统一转成 id
    const rawTags = Array.isArray(body.tags) && body.tags.length ? body.tags
      : (Array.isArray(body.tagNames) && body.tagNames.length ? body.tagNames : []);
    if (rawTags.length) {
      const allTags = await getTags(env);
      const ids = [];
      for (const t of rawTags) {
        const v = String(t || '').trim();
        if (!v) continue;
        const byId = allTags.find((x) => x.id === v);
        if (byId) { ids.push(byId.id); continue; }
        const byName = allTags.find((x) => x.name === v || x.slug === v);
        ids.push(byName ? byName.id : (await ensureTagByName(env, v)).id);
      }
      body.tags = ids;
    } else {
      body.tags = [];
    }
    const post = await createPost(env, body);
    return json({ ok: true, post }, { status: 201 });
  } catch (e) {
    return fail(400, e.message || '创建文章失败');
  }
}

export const onRequest = onRequestPost;
