import { json, publicHeaders, parseSearchParams } from './_lib/response.js';
import { getPublicPosts, getCategories, getTags } from './_lib/data.js';

/**
 * GET /api/search?q=xxx — 全文搜索（标题/摘要/正文关键词）
 * 返回文章列表（仅已发布且公开），附带匹配片段。
 */
export async function onRequestGet({ request, env }) {
  const params = parseSearchParams(request.url);
  const q = (params.q || '').trim().toLowerCase();
  if (!q) return json({ ok: true, items: [], total: 0, q: '' }, { headers: publicHeaders() });

  const [posts, categories, tags] = await Promise.all([
    getPublicPosts(env),
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
    .map((x) => ({ ...x.post, categoryName: x.post.categoryId ? catMap.get(x.post.categoryId)?.name || '' : '' }));

  return json({ ok: true, items, total: items.length, q: params.q }, { headers: publicHeaders() });
}
