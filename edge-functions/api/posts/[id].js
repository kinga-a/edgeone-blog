import { json, fail, readJson, publicHeaders } from '../_lib/response.js';
import { getPostByIdOrSlug, updatePost, deletePost, purgePost, restorePost, postDetailView, getSiteConfig, isPostPubliclyVisible, getTags, ensureTagByName } from '../_lib/data.js';
import { requireAdmin } from '../_lib/auth.js';

/**
 * GET /api/posts/:id — 文章详情（id 或 slug；私人文章仅管理员可见）
 * POST /api/posts/:id — 从回收站恢复文章（管理员）
 * PUT /api/posts/:id — 更新文章（管理员）
 * DELETE /api/posts/:id — 删除文章（移入回收站，软删除；?permanent=1 彻底删除，管理员）
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

export async function onRequestPost({ request, env, params }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  const ok = await restorePost(env, params.id);
  if (!ok) return fail(404, '文章不存在');
  return json({ ok: true, restored: params.id });
}

export async function onRequestDelete({ request, env, params }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  const url = new URL(request.url);
  const permanent = url.searchParams.get('permanent') === '1';
  if (permanent) {
    const existed = await purgePost(env, params.id);
    if (!existed) return fail(404, '文章不存在');
    return json({ ok: true, purged: params.id });
  }
  const ok = await deletePost(env, params.id);
  if (!ok) return fail(404, '文章不存在');
  return json({ ok: true, trashed: params.id });
}
