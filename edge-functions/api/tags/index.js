import { json, fail, readJson, publicHeaders } from '../_lib/response.js';
import { getTagsWithCounts, createTag } from '../_lib/data.js';
import { requireAdmin } from '../_lib/auth.js';

/** GET /api/tags — 标签列表（公开，含文章数） */
export async function onRequestGet({ env }) {
  const items = await getTagsWithCounts(env);
  return json({ ok: true, items }, { headers: publicHeaders() });
}

/** POST /api/tags — 新建标签（管理员） */
export async function onRequestPost({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  const body = await readJson(request);
  if (!body) return fail(400, '请求体无效');
  try {
    const tag = await createTag(env, body);
    return json({ ok: true, tag }, { status: 201 });
  } catch (e) {
    return fail(400, e.message || '创建标签失败');
  }
}
