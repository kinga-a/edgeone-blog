import { json, fail, readJson } from '../_lib/response.js';
import { updateTag, deleteTag } from '../_lib/data.js';
import { requireAdmin } from '../_lib/auth.js';

/** PUT /api/tags/:id — 更新标签；DELETE — 删除标签（管理员） */
export async function onRequestPut({ request, env, params }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  const body = await readJson(request);
  if (!body) return fail(400, '请求体无效');
  try {
    const tag = await updateTag(env, params.id, body);
    return json({ ok: true, tag });
  } catch (e) {
    return fail(400, e.message || '更新失败');
  }
}

export async function onRequestDelete({ request, env, params }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  await deleteTag(env, params.id);
  return json({ ok: true });
}
