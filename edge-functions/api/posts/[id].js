import { json, fail, readJson, publicHeaders } from '../_lib/response.js';
import { getPostByIdOrSlug, updatePost, deletePost, postDetailView, getSiteConfig, isPostPubliclyVisible, getTags, ensureTagByName } from '../_lib/data.js';
import { requireAdmin } from '../_lib/auth.js';

/**
 * GET /api/posts/:id — 文章详情（id 或 slug；私人文章仅管理员可见）
 * PUT /api/posts/:id — 更新文章（管理员）
 * DELETE /api/posts/:id — 删除文章（管理员）
 */
export async function onRequestGet({ request, env, params }) {
  const post = await getPostByIdOrSlug(env, params.id);
  if (!post) return fail(404, '文章不存在');
  const admin = await requireAdmin(request, env).catch(() => ({ ok: false }));
  if (!admin.ok && !isPostPubliclyVisible(post)) return fail(404, '文章不存在或未发布');
  const config = await getSiteConfig(env);
  const detail = await postDetailView(env, post, config);
  return json({ ok: true, post: detail }, { headers: publicHeaders() });
}

export async function onRequestPut({ request, env, params }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  const body = await readJson(request);
  if (!body) return fail(400, '请求体无效');
  try {
    // 编辑时前端 tags 数组里可能混着标签名字（用户输入）和已有 id，统一规范化为 id
    if (Array.isArray(body.tags)) {
      const allTags = await getTags(env);
      const ids = [];
      for (const t of body.tags) {
        const v = String(t || '').trim();
        if (!v) continue;
        // 已经是已知 id 直接用
        const byId = allTags.find((x) => x.id === v);
        if (byId) { ids.push(byId.id); continue; }
        // 否则按名字查/建
        const byName = allTags.find((x) => x.name === v || x.slug === v);
        ids.push(byName ? byName.id : (await ensureTagByName(env, v)).id);
      }
      body.tags = ids;
    }
    const post = await updatePost(env, params.id, body);
    return json({ ok: true, post });
  } catch (e) {
    return fail(404, e.message || '更新失败');
  }
}

export async function onRequestDelete({ request, env, params }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  await deletePost(env, params.id);
  return json({ ok: true });
}
