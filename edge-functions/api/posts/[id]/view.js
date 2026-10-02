import { json, fail, publicHeaders } from '../../_lib/response.js';
import { getPostByIdOrSlug, trackView, getViews, isPostPubliclyVisible } from '../../_lib/data.js';
import { getKv, kvGetJson, rateLimitHit } from '../../_lib/kv.js';
import { clientIp } from '../../_lib/auth.js';

/** 阅读量防刷：同 IP 5 分钟内最多计 30 次（超限静默返回当前值，不报错） */
const VIEW_LIMIT = 30;
const VIEW_WINDOW_MS = 5 * 60 * 1000;
/** 同一 IP 对同一篇文章 24 小时内只计 1 次阅读 */
const VIEW_SEEN_TTL = 24 * 60 * 60;

/** POST /api/posts/:id/view — 阅读量 +1（由文章页脚本调用，仅公开文章；同 IP 24h 去重） */
export async function onRequestPost({ request, env, params }) {
  const post = await getPostByIdOrSlug(env, params.id);
  if (!post) return fail(404, '文章不存在');
  if (!isPostPubliclyVisible(post)) return fail(404, '文章不存在或未发布');

  const ip = clientIp(request);
  const kv = getKv(env);

  // 粗防刷：同 IP 高频请求直接静默返回
  const hit = await rateLimitHit(kv, `rate_view_${String(ip).replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 48)}`, VIEW_LIMIT, VIEW_WINDOW_MS);
  if (!hit.ok) return json({ ok: true, count: await getViews(env, post.id) }, { headers: publicHeaders() });

  // 24h 去重：已见过的 IP 不再 +1
  const seenKey = `view_seen_${post.id}_${String(ip).replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 48)}`;
  const seen = await kvGetJson(kv, seenKey);
  if (seen) {
    return json({ ok: true, count: await getViews(env, post.id) }, { headers: publicHeaders() });
  }

  const count = await trackView(env, post.id);
  await kv.put(seenKey, '1', { expirationTtl: VIEW_SEEN_TTL });
  return json({ ok: true, count }, { headers: publicHeaders() });
}

export const onRequest = onRequestPost;
