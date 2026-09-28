import { json, fail, readJson, publicHeaders } from '../_lib/response.js';
import { getCategoriesWithCounts, createCategory, getPublicPosts } from '../_lib/data.js';
import { requireAdmin } from '../_lib/auth.js';

/** GET /api/categories — 分类列表（公开，含文章数与近期文章） */
export async function onRequestGet({ env }) {
  const items = await getCategoriesWithCounts(env);
  const posts = await getPublicPosts(env);
  const map = {};
  for (const p of posts) {
    if (!p.categoryId) continue;
    (map[p.categoryId] || (map[p.categoryId] = [])).push({
      slug: p.slug,
      title: p.title,
      createdAt: p.createdAt,
      publishedAt: p.publishedAt || p.createdAt,
    });
  }
  for (const c of items) {
    c.posts = (map[c.id] || []).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 5);
  }
  return json({ ok: true, items }, { headers: publicHeaders() });
}

/** POST /api/categories — 新建分类（管理员） */
export async function onRequestPost({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  const body = await readJson(request);
  if (!body) return fail(400, '请求体无效');
  try {
    const category = await createCategory(env, body);
    return json({ ok: true, category }, { status: 201 });
  } catch (e) {
    return fail(400, e.message || '创建分类失败');
  }
}
