import { json, publicHeaders } from '../_lib/response.js';
import { getPostList, getPublicPosts, getSiteConfig } from '../_lib/data.js';
import { requireAdmin } from '../_lib/auth.js';

/**
 * GET /api/posts/featured — 首页精选文章（按站点配置 featuredPostIds 顺序返回）
 * 可见性：未登录仅公开文章；已登录管理员可见全部已发布（含私人）
 * 未配置精选时返回空数组，由前端回退最新文章
 */
export async function onRequestGet({ request, env }) {
  const config = await getSiteConfig(env);
  const ids = Array.isArray(config.featuredPostIds) ? config.featuredPostIds.filter(Boolean) : [];

  const admin = await requireAdmin(request, env).catch(() => ({ ok: false }));
  let list;
  if (admin.ok) {
    list = await getPostList(env);
    list = list.filter((p) => p.status === 'published');
  } else {
    list = await getPublicPosts(env);
  }

  const byId = new Map(list.map((p) => [p.id, p]));
  const items = ids.map((id) => byId.get(id)).filter(Boolean);

  return json({ ok: true, items }, { headers: publicHeaders() });
}
