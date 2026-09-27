import { getSiteConfig, getPublicPosts, getCategories, getTags } from './api/_lib/data.js';
import { siteOrigin } from './api/_lib/render-html.js';
import { escapeHtml } from './api/_lib/shell-escape.js';

/** GET /sitemap.xml — 站点地图（含全部已发布的公开文章、分类、标签、静态页面） */
export async function onRequestGet({ request, env }) {
  const [config, posts, categories, tags] = await Promise.all([
    getSiteConfig(env),
    getPublicPosts(env),
    getCategories(env),
    getTags(env),
  ]);
  const origin = siteOrigin(config, request);
  const today = new Date().toISOString().slice(0, 10);

  const urls = [];
  const add = (loc, lastmod = today, priority = '0.5') => {
    urls.push(`  <url><loc>${escapeHtml(loc)}</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq><priority>${priority}</priority></url>`);
  };

  add(`${origin}/`, today, '1.0');
  for (const p of ['posts', 'categories', 'tags', 'archives', 'search', 'about', 'admin']) {
    add(`${origin}/${p}/`, today, '0.6');
  }
  for (const p of posts) {
    if (p.status !== 'published') continue;
    add(`${origin}/posts/${p.slug}/`, (p.updatedAt || p.publishedAt || today).slice(0, 10), '0.9');
  }
  for (const c of categories) add(`${origin}/categories/${c.slug}/`, today, '0.7');
  for (const t of tags) add(`${origin}/tags/${t.slug}/`, today, '0.7');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
  return new Response(xml, {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
