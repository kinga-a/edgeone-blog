import { json, fail, publicHeaders } from '../../_lib/response.js';
import { getPostByIdOrSlug, relatedPosts, isPostPubliclyVisible } from '../../_lib/data.js';
import { requireAdmin } from '../../_lib/auth.js';

/** GET /api/posts/:id/related — 相关文章推荐（私人文章仅管理员可见） */
export async function onRequestGet({ request, env, params }) {
  const post = await getPostByIdOrSlug(env, params.id);
  if (!post) return fail(404, '文章不存在');
  const admin = await requireAdmin(request, env).catch(() => ({ ok: false }));
  if (!admin.ok && !isPostPubliclyVisible(post)) return fail(404, '文章不存在或未发布');
  const items = await relatedPosts(env, post, 5, admin.ok);
  return json({ ok: true, items }, { headers: publicHeaders() });
}

export const onRequest = onRequestGet;
