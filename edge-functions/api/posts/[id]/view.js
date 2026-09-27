import { json, fail, publicHeaders } from '../../_lib/response.js';
import { getPostByIdOrSlug, trackView, isPostPubliclyVisible } from '../../_lib/data.js';

/** POST /api/posts/:id/view — 阅读量 +1（由文章页脚本调用，仅公开文章） */
export async function onRequestPost({ env, params }) {
  const post = await getPostByIdOrSlug(env, params.id);
  if (!post) return fail(404, '文章不存在');
  if (!isPostPubliclyVisible(post)) return fail(404, '文章不存在或未发布');
  const count = await trackView(env, post.id);
  return json({ ok: true, count }, { headers: publicHeaders() });
}
