import { getSiteConfig, getPublicPosts } from './api/_lib/data.js';
import { siteOrigin } from './api/_lib/render-html.js';

/** GET /rss.xml — RSS 2.0 订阅源（仅公开文章） */
export async function onRequestGet({ request, env }) {
  const [config, posts] = await Promise.all([getSiteConfig(env), getPublicPosts(env)]);
  const origin = siteOrigin(config, request);
  const published = [...posts].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));

  const escape = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const items = published.slice(0, 50).map((p) => {
    const summary = escape(p.summary || p.title);
    const link = `${origin}/posts/${encodeURIComponent(p.slug)}/`;
    const date = new Date(p.publishedAt || p.createdAt).toUTCString();
    return `  <item>
    <title><![CDATA[${p.title}]]></title>
    <link>${link}</link>
    <guid isPermaLink="true">${link}</guid>
    <description><![CDATA[${summary}]]></description>
    <pubDate>${date}</pubDate>
  </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${escape(config.title)}</title>
  <link>${origin}/</link>
  <description>${escape(config.description || config.subtitle || '')}</description>
  <language>${escape(config.language || 'zh-CN')}</language>
  <atom:link href="${origin}/rss.xml" rel="self" type="application/rss+xml"/>
  ${config.seo?.ogImage ? `<image><url>${escape(config.seo.ogImage)}</url><title>${escape(config.title)}</title><link>${origin}/</link></image>` : ''}
${items}
</channel>
</rss>`;
  return new Response(xml, {
    headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
}
