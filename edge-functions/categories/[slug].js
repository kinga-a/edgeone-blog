import { getCategories, getPublicPosts, getPostList } from '../api/_lib/data.js';
import { requireAdmin } from '../api/_lib/auth.js';
import { renderListPage } from '../api/_lib/render-html.js';
import { categoryIconHtml } from '../api/_lib/icons.js';

/** GET /categories/:slug — 分类归档页（服务端渲染；已登录管理员可见私人文章） */
export async function onRequestGet({ request, env, params }) {
  const categories = await getCategories(env);
  const category = categories.find((c) => c.slug === params.slug);
  if (!category) return new Response('分类不存在', { status: 404 });
  const admin = await requireAdmin(request, env).catch(() => ({ ok: false }));
  const pool = admin.ok
    ? (await getPostList(env)).filter((p) => p.status === 'published')
    : await getPublicPosts(env);
  const posts = pool.filter((p) => p.categoryId === category.id);
  const html = await renderListPage(env, {
    type: 'categories',
    slug: category.slug,
    title: `分类：${category.name}`,
    description: category.description || '',
    iconHtml: categoryIconHtml(category.icon),
    items: posts,
    request,
  });
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600' },
  });
}

export const onRequest = onRequestGet;
