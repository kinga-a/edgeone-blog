import { json, publicHeaders, parseSearchParams } from './_lib/response.js';
import { getPublicPosts, getPublicSnapshot, getPostList, getCategories, getTags } from './_lib/data.js';
import { requireAdmin } from './_lib/auth.js';

/**
 * GET /api/search?q=xxx — 全文搜索（标题/摘要/正文关键词）
 * 默认仅搜索已发布且公开的文章；已登录管理员可搜到私人文章。
 */
export async function onRequestGet({ request, env }) {
  const params = parseSearchParams(request.url);
  const q = (params.q || '').trim().toLowerCase();
  if (!q) return json({ ok: true, items: [], total: 0, q: '' }, { headers: publicHeaders() });

  const admin = await requireAdmin(request, env).catch(() => ({ ok: false }));
  const [posts, categories, tags] = await Promise.all([
    admin.ok
      ? (await getPostList(env)).filter((p) => p.status === 'published')
      : getPublicSnapshot(env),
    getCategories(env),
    getTags(env),
  ]);

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const tagMap = new Map(tags.map((t) => [t.id, t]));

  const items = posts
    .map((p) => {
      let score = 0;
      if (p.title.toLowerCase().includes(q)) score += 10;
      if ((p.summary || '').toLowerCase().includes(q)) score += 5;
      const catName = p.categoryId ? (catMap.get(p.categoryId)?.name || '') : '';
      if (catName.toLowerCase().includes(q)) score += 2;
      for (const tid of p.tags || []) {
        if ((tagMap.get(tid)?.name || '').toLowerCase().includes(q)) score += 2;
      }
      return { post: p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => {
      const p = x.post;
      // 仅下发公开展示字段，避免对象展开泄露内部属性
      return {
        id: p.id,
        slug: p.slug,
        title: p.title,
        summary: p.summary || '',
        categoryId: p.categoryId || '',
        categoryName: p.categoryId ? (catMap.get(p.categoryId)?.name || '') : '',
        tags: Array.isArray(p.tags) ? p.tags : [],
        coverUrl: p.coverUrl || '',
        coverKey: p.coverKey || '',
        readingTime: p.readingTime || 1,
        publishedAt: p.publishedAt || '',
        createdAt: p.createdAt || '',
      };
    });

  return json({ ok: true, items, total: items.length, q: params.q }, { headers: publicHeaders() });
}

export const onRequest = onRequestGet;
