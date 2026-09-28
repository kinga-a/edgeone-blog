import { json, fail, publicHeaders } from '../../_lib/response.js';
import { getPostByIdOrSlug, trackView, getViews, isPostPubliclyVisible } from '../../_lib/data.js';
import { getKv, Keys, rateLimitHit } from '../../_lib/kv.js';
import { clientIp } from '../../_lib/auth.js';

/** 阅读量防刷：同 IP 5 分钟内最多计 30 次（超限静默返回当前值，不报错） */
const VIEW_LIMIT = 30;
const VIEW_WINDOW_MS = 5 * 60 * 1000;

/** POST /api/posts/:id/view — 阅读量 +1（由文章页脚本调用，仅公开文章） */
export async function onRequestPost({ request, env, params }) {
  const post = await getPostByIdOrSlug(env, params.id);
  if (!post) return fail(404, '文章不存在');
  if (!isPostPubliclyVisible(post)) return fail(404, '文章不存在或未发布');
  const hit = await rateLimitHit(getKv(env), Keys.rateLimit('view', clientIp(request)), VIEW_LIMIT, VIEW_WINDOW_MS);
  if (!hit.ok) return json({ ok: true, count: await getViews(env, post.id) }, { headers: publicHeaders() });
  const count = await trackView(env, post.id);
  return json({ ok: true, count }, { headers: publicHeaders() });
}

export const onRequest = onRequestPost;
