import { json, fail, readJson } from '../_lib/response.js';
import { updateCommentStatus, deleteComment, getComment, COMMENT_STATUS } from '../_lib/data.js';
import { requireAdmin } from '../_lib/auth.js';

/**
 * PUT /api/comments/:id — 审核评论 { status: 'approved' | 'rejected' | 'pending', postId }
 * DELETE /api/comments/:id — 删除评论 { postId }
 */
export async function onRequestPut({ request, env, params }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  const body = await readJson(request);
  if (!body) return fail(400, '请求体无效');
  if (!body.postId) return fail(400, '缺少 postId');
  if (!Object.values(COMMENT_STATUS).includes(body.status)) return fail(400, '非法的评论状态');
  try {
    const comment = await updateCommentStatus(env, body.postId, params.id, body.status);
    return json({ ok: true, comment });
  } catch (e) {
    return fail(404, e.message || '评论不存在');
  }
}

export async function onRequestDelete({ request, env, params }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  const url = new URL(request.url);
  const postId = url.searchParams.get('postId');
  if (!postId) return fail(400, '缺少 postId');
  await deleteComment(env, postId, params.id);
  return json({ ok: true });
}
