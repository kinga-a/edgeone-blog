import { json, fail, readJson, publicHeaders } from '../../_lib/response.js';
import { getPostByIdOrSlug, getComments, createComment, COMMENT_STATUS } from '../../_lib/data.js';
import { getKv, Keys, rateLimitHit } from '../../_lib/kv.js';
import { clientIp } from '../../_lib/auth.js';

/** 评论提交限速：同 IP 每分钟最多 5 条（防垃圾评论刷屏） */
const COMMENT_LIMIT = 5;
const COMMENT_WINDOW_MS = 60 * 1000;

/**
 * GET /api/posts/:id/comments — 某文章已通过审核的评论（公开）
 * POST /api/posts/:id/comments — 提交评论（进入审核队列）
 */
export async function onRequestGet({ env, params }) {
  const post = await getPostByIdOrSlug(env, params.id);
  if (!post) return fail(404, '文章不存在');
  const comments = (await getComments(env))
    .filter((c) => c.postId === post.id && c.status === COMMENT_STATUS.APPROVED)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return json({ ok: true, items: comments, total: comments.length }, { headers: publicHeaders() });
}

export async function onRequestPost({ request, env, params }) {
  const post = await getPostByIdOrSlug(env, params.id);
  if (!post) return fail(404, '文章不存在');
  const hit = await rateLimitHit(getKv(env), Keys.rateLimit('comment', clientIp(request)), COMMENT_LIMIT, COMMENT_WINDOW_MS);
  if (!hit.ok) return fail(429, '评论太频繁了，请稍后再试');
  const body = await readJson(request);
  if (!body) return fail(400, '请求体无效');
  try {
    const comment = await createComment(env, {
      postId: post.id,
      postSlug: post.slug,
      author: body.author,
      email: body.email,
      website: body.website,
      content: body.content,
    });
    return json({ ok: true, comment }, { status: 201, headers: publicHeaders() });
  } catch (e) {
    return fail(400, e.message || '评论提交失败');
  }
}
