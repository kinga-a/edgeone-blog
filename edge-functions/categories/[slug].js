import { getCategories, getPublicPosts } from '../api/_lib/data.js';
import { renderListPage } from '../api/_lib/render-html.js';

/** GET /categories/:slug — 分类归档页（服务端渲染，仅公开文章） */
export async function onRequestGet({ request, env, params }) {
  const categories = await getCategories(env);
  const category = categories.find((c) => c.slug === params.slug);
  if (!category) return new Response('分类不存在', { status: 404 });
  const posts = (await getPublicPosts(env)).filter((p) => p.categoryId === category.id);
  const html = await renderListPage(env, {
    type: 'categories',
    slug: category.slug,
    title: `分类：${category.name}`,
    description: category.description || '',
    items: posts,
    request,
  });
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600' },
  });
}
