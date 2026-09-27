import { getPostByIdOrSlug } from '../api/_lib/data.js';
import { renderArticlePage } from '../api/_lib/render-html.js';

/**
 * GET /posts/:slug — 文章详情页（服务端渲染完整 HTML，SEO 友好）
 * 未发布文章不对外提供。
 */
export async function onRequestGet({ request, env, params }) {
  const post = await getPostByIdOrSlug(env, params.slug);
  if (!post || post.status !== 'published') {
    return new Response('文章不存在或未发布', { status: 404 });
  }
  const html = await renderArticlePage(env, post, request);
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600' },
  });
}

export const onRequest = onRequestGet;
