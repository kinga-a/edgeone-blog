import { json, fail, publicHeaders } from '../../_lib/response.js';
import { getPostByIdOrSlug, trackLike } from '../../_lib/data.js';

/** POST /api/posts/:id/like — 文章点赞 */
export async function onRequestPost({ env, params }) {
  const post = await getPostByIdOrSlug(env, params.id);
  if (!post) return fail(404, '文章不存在');
  const count = await trackLike(env, post.id);
  return json({ ok: true, count }, { headers: publicHeaders() });
}

export const onRequest = onRequestPost;
