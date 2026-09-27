import { json, fail, readJson } from '../_lib/response.js';
import { updateCategory, deleteCategory } from '../_lib/data.js';
import { requireAdmin } from '../_lib/auth.js';

/** PUT /api/categories/:id — 更新分类；DELETE — 删除分类（管理员） */
export async function onRequestPut({ request, env, params }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  const body = await readJson(request);
  if (!body) return fail(400, '请求体无效');
  try {
    const category = await updateCategory(env, params.id, body);
    return json({ ok: true, category });
  } catch (e) {
    return fail(400, e.message || '更新失败');
  }
}

export async function onRequestDelete({ request, env, params }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  await deleteCategory(env, params.id);
  return json({ ok: true });
}
