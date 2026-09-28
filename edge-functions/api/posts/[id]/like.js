import { json, fail, publicHeaders } from '../../_lib/response.js';
import { getPostByIdOrSlug, trackLike, getLikes, isPostPubliclyVisible } from '../../_lib/data.js';
import { getKv, Keys, rateLimitHit } from '../../_lib/kv.js';
import { clientIp } from '../../_lib/auth.js';

/** 点赞防刷：同 IP 每分钟最多 10 次（超限静默返回当前值，不报错） */
const LIKE_LIMIT = 10;
const LIKE_WINDOW_MS = 60 * 1000;

/** POST /api/posts/:id/like — 文章点赞（仅公开文章） */
export async function onRequestPost({ request, env, params }) {
  const post = await getPostByIdOrSlug(env, params.id);
  if (!post) return fail(404, '文章不存在');
  if (!isPostPubliclyVisible(post)) return fail(404, '文章不存在或未发布');
  const hit = await rateLimitHit(getKv(env), Keys.rateLimit('like', clientIp(request)), LIKE_LIMIT, LIKE_WINDOW_MS);
  if (!hit.ok) return json({ ok: true, count: await getLikes(env, post.id) }, { headers: publicHeaders() });
  const count = await trackLike(env, post.id);
  return json({ ok: true, count }, { headers: publicHeaders() });
}

export const onRequest = onRequestPost;
