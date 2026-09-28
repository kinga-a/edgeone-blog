import { getPostByIdOrSlug, getSiteConfig, isPostPubliclyVisible } from '../api/_lib/data.js';
import { renderArticlePage, pageSecurityHeaders } from '../api/_lib/render-html.js';
import { requireAdmin } from '../api/_lib/auth.js';

/**
 * GET /posts/:slug — 文章详情页（服务端渲染完整 HTML，SEO 友好）
 * 未发布文章不对外提供；私人文章仅登录管理员可见。
 */
export async function onRequestGet({ request, env, params }) {
  const post = await getPostByIdOrSlug(env, params.slug);
  if (!post) return new Response('文章不存在或未发布', { status: 404 });
  if (post.status !== 'published') return new Response('文章不存在或未发布', { status: 404 });
  if (!isPostPubliclyVisible(post)) {
    const admin = await requireAdmin(request, env).catch(() => ({ ok: false }));
    if (!admin.ok) return new Response('文章不存在或未发布', { status: 404 });
  }
  const html = await renderArticlePage(env, post, request);
  return new Response(html, { headers: pageSecurityHeaders() });
}

export const onRequest = onRequestGet;
