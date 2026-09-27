import { json, fail, readJson, parseSearchParams, intParam, publicHeaders } from '../_lib/response.js';
import { getPostList, createPost, getCategories, getTags, ensureTagByName } from '../_lib/data.js';
import { requireAdmin } from '../_lib/auth.js';

/**
 * GET /api/posts — 文章列表（公开）
 * 参数：page, pageSize, category, tag, status, q, sort
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

  let list = await getPostList(env);
  if (status) list = list.filter((p) => p.status === status);
  if (categoryId) list = list.filter((p) => p.categoryId === categoryId);
  if (tagId) list = list.filter((p) => (p.tags || []).includes(tagId));
  if (q) list = list.filter((p) =>
    p.title.toLowerCase().includes(q) ||
    (p.summary || '').toLowerCase().includes(q)
  );

  const total = list.length;
  const start = (page - 1) * pageSize;
  const items = list.slice(start, start + pageSize);

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
    if (body.categoryName && !body.categoryId) {
      const categories = await getCategories(env);
      const hit = categories.find((c) => c.name === body.categoryName || c.slug === body.categoryName);
      if (hit) body.categoryId = hit.id;
    }
    if (Array.isArray(body.tagNames) && body.tagNames.length && !body.tags?.length) {
      const tags = await getTags(env);
      const ids = [];
      for (const name of body.tagNames) {
        const hit = tags.find((t) => t.name === name || t.slug === name);
        ids.push(hit ? hit.id : (await ensureTagByName(env, name)).id);
      }
      body.tags = ids;
    }
    const post = await createPost(env, body);
    return json({ ok: true, post }, { status: 201 });
  } catch (e) {
    return fail(400, e.message || '创建文章失败');
  }
}

export const onRequest = onRequestPost;
