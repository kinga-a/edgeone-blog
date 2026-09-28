import { getTags, getPublicPosts, getPostList } from '../api/_lib/data.js';
import { requireAdmin } from '../api/_lib/auth.js';
import { renderListPage, pageSecurityHeaders } from '../api/_lib/render-html.js';

/** GET /tags/:slug — 标签归档页（服务端渲染；已登录管理员可见私人文章） */
export async function onRequestGet({ request, env, params }) {
  const tags = await getTags(env);
  const tag = tags.find((t) => t.slug === params.slug);
  if (!tag) return new Response('标签不存在', { status: 404 });
  const admin = await requireAdmin(request, env).catch(() => ({ ok: false }));
  const pool = admin.ok
    ? (await getPostList(env)).filter((p) => p.status === 'published')
    : await getPublicPosts(env);
  const posts = pool.filter((p) => (p.tags || []).includes(tag.id));
  const html = await renderListPage(env, {
    type: 'tags',
    slug: tag.slug,
    title: `标签：#${tag.name}`,
    description: `收录了 ${posts.length} 篇带有「${tag.name}」标签的文章`,
    items: posts,
    request,
  });
  return new Response(html, { headers: pageSecurityHeaders() });
}

export const onRequest = onRequestGet;
