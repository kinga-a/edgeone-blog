import { json, fail, publicHeaders } from '../../_lib/response.js';
import { getPostByIdOrSlug, relatedPosts } from '../../_lib/data.js';

/** GET /api/posts/:id/related — 相关文章推荐 */
export async function onRequestGet({ env, params }) {
  const post = await getPostByIdOrSlug(env, params.id);
  if (!post) return fail(404, '文章不存在');
  const items = await relatedPosts(env, post, 5);
  return json({ ok: true, items }, { headers: publicHeaders() });
}

export const onRequest = onRequestGet;
