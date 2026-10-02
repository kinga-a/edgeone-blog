/**
 * 服务端 HTML 渲染：文章详情页、分类页、标签页
 * 这些页面由 Edge Functions 渲染完整 HTML（SEO 友好、可被爬虫直接索引），
 * 包含：元信息 / OG / JSON-LD / 代码高亮 / 目录 / 上一篇下一篇 / 相关文章 /
 *      点赞 / 评论 / 阅读量统计 / 暗色模式 / 移动端适配。
 */
import {
  getSiteConfig, getCategoriesWithCounts, getTagsByIds,
  adjacentPosts, relatedPosts, getViews, getLikes, getComments, COMMENT_STATUS,
} from './data.js';
import { renderMarkdown, extractToc } from './md.js';
import { readingTime, fmtDate } from './ids.js';
import { requireAdmin } from './auth.js';
import { categoryIconHtml } from './icons.js';

/** 判断当前请求是否为已登录管理员（私人文章对管理员可见） */
async function isAdminRequest(request, env) {
  if (!request) return false;
  try {
    const admin = await requireAdmin(request, env);
    return admin.ok;
  } catch (e) {
    return false;
  }
}

/* ---------------- 工具 ---------------- */

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** 从请求推导站点绝对地址（优先使用站点配置 siteUrl） */
export function siteOrigin(config, request) {
  if (config && config.siteUrl) return String(config.siteUrl).replace(/\/+$/, '');
  try {
    const url = new URL(request.url);
    return url.origin;
  } catch {
    return '';
  }
}

/** SSR 页面安全响应头（与 edgeone.json 全局头双保险；CSP 需放行内联脚本与 highlight.js CDN） */
export function pageSecurityHeaders(cacheControl = 'public, max-age=600') {
  return {
    'content-type': 'text/html; charset=utf-8',
    'Cache-Control': cacheControl,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: http:; font-src 'self' data: https:; connect-src 'self' https:; media-src 'self' https: blob:; frame-src 'self' https://player.bilibili.com https://www.youtube.com https://www.youtube-nocookie.com https://v.qq.com https://player.qq.com https://player.vimeo.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
  };
}

function absUrl(origin, path) {
  return `${origin}${path}`;
}

const NAV_ITEMS = [
  { href: '/', label: '首页', key: 'home' },
  { href: '/posts/', label: '文章', key: 'posts' },
  { href: '/archives/', label: '归档', key: 'archives' },
  { href: '/about/', label: '关于', key: 'about' },
];

/* ---------------- 页面骨架 ---------------- */

const DARK_MODE_SCRIPT = `(function(){try{var t=localStorage.getItem('blog-theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();`;

function pageShell({ config, title, description, keywords, canonical, ogImage, jsonLd, body, navKey }) {
  const desc = description || config.description || '';
  const og = ogImage || config.seo?.ogImage || '';
  return `<!DOCTYPE html>
<html lang="${escapeHtml(config.language || 'zh-CN')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
${keywords ? `<meta name="keywords" content="${escapeHtml(keywords)}">` : ''}
<meta name="author" content="${escapeHtml(config.author || '')}">
<link rel="canonical" href="${escapeHtml(canonical)}">
${config.seo?.googleSiteVerification ? `<meta name="google-site-verification" content="${escapeHtml(config.seo.googleSiteVerification)}">` : ''}
<meta name="robots" content="index, follow">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${escapeHtml(config.title || '')}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:url" content="${escapeHtml(canonical)}">
${og ? `<meta property="og:image" content="${escapeHtml(og)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(desc)}">
${config.seo?.twitterHandle ? `<meta name="twitter:site" content="@${escapeHtml(config.seo.twitterHandle.replace(/^@/, ''))}">` : ''}
${og ? `<meta name="twitter:image" content="${escapeHtml(og)}">` : ''}
${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ''}
<link rel="alternate" type="application/rss+xml" title="RSS" href="${escapeHtml(canonical.replace(/[^/]+$/, ''))}rss.xml">
<link rel="stylesheet" href="/styles/article.css">
<script>${DARK_MODE_SCRIPT}</script>
</head>
<body>
<header class="site-header" id="site-header">
  <div class="header-inner">
    <a class="site-logo" href="/">
      <span class="site-logo-badge" aria-hidden="true">B</span>
      <span class="site-logo-text">${escapeHtml(config.title || '博客')}</span>
    </a>
    <nav class="site-nav">
      ${NAV_ITEMS.map((n) => `<a href="${n.href}" class="${n.key === navKey ? 'active' : ''}">${n.label}</a>`).join('')}
      <a class="search-link" href="/search/" aria-label="搜索" title="搜索">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="1.6"/><path d="M14 14l4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      </a>
      <button type="button" class="theme-toggle" id="theme-toggle" aria-label="切换主题" title="切换主题">
        <svg class="ico-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        <svg class="ico-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
      </button>
      <button type="button" class="icon-btn site-menu" id="site-menu" aria-label="打开菜单">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      </button>
    </nav>
  </div>
</header>
<div class="drawer-overlay" id="drawer-overlay" aria-hidden="true"></div>
<aside class="drawer" id="site-drawer" role="dialog" aria-label="导航菜单">
  <button type="button" class="icon-btn drawer-close" id="drawer-close" aria-label="关闭菜单">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
  </button>
  <ul class="drawer-nav">
    ${NAV_ITEMS.map((n) => `<li><a href="${n.href}" class="${n.key === navKey ? 'active' : ''}">${n.label}</a></li>`).join('')}
  </ul>
</aside>
<main class="site-main">
${body}
</main>
<footer class="site-footer">
  <div class="footer-inner">
    <p>${escapeHtml(config.footerText || '')}</p>
    <p class="footer-sub">© ${new Date().getFullYear()} ${escapeHtml(config.title || '')} · Powered by EdgeOne Pages</p>
  </div>
</footer>
<script>
(function(){
  var h=document.getElementById('site-header');
  if(h){var onScroll=function(){h.classList.toggle('scrolled',window.scrollY>10);};window.addEventListener('scroll',onScroll,{passive:true});onScroll();}
  function setTheme(d){document.documentElement.classList.toggle('dark',d);document.documentElement.setAttribute('data-theme',d?'dark':'light');try{localStorage.setItem('blog-theme',d?'dark':'light');}catch(e){}}
  var btn=document.getElementById('theme-toggle');
  if(btn){btn.addEventListener('click',function(){setTheme(!document.documentElement.classList.contains('dark'));});}
  var menu=document.getElementById('site-menu'),ov=document.getElementById('drawer-overlay'),dr=document.getElementById('site-drawer'),cl=document.getElementById('drawer-close');
  function openDrawer(){if(ov){ov.classList.add('open');ov.setAttribute('aria-hidden','false');}if(dr){dr.classList.add('open');}document.body.style.overflow='hidden';}
  function closeDrawer(){if(ov){ov.classList.remove('open');ov.setAttribute('aria-hidden','true');}if(dr){dr.classList.remove('open');}document.body.style.overflow='';}
  if(menu){menu.addEventListener('click',openDrawer);}
  if(cl){cl.addEventListener('click',closeDrawer);}
  if(ov){ov.addEventListener('click',closeDrawer);}
  if(dr){var links=dr.querySelectorAll('a');for(var i=0;i<links.length;i++){links[i].addEventListener('click',closeDrawer);}}
})();
</script>
<style>
.btp{position:fixed;bottom:1.5rem;right:1.5rem;width:48px;height:48px;border-radius:999px;background:#fff;color:#57534e;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.1);opacity:0;pointer-events:none;transition:opacity .25s,transform .25s;z-index:40}
.btp.show{opacity:1;pointer-events:auto}
.btp:hover{transform:translateY(-2px)}
.btp .ring{position:absolute;top:0;left:0;width:48px;height:48px;transform:rotate(-90deg)}
.btp .ring circle{fill:none;stroke:#9A4318;stroke-width:2.5;stroke-linecap:round;stroke-dasharray:125.66;stroke-dashoffset:125.66;transition:stroke-dashoffset .1s linear}
html.dark .btp{background:rgba(60,55,48,.9);color:#e7e5e4;box-shadow:0 2px 8px rgba(0,0,0,.4)}
html.dark .btp .ring circle{stroke:#E08A5A}
.btp .arrow{width:18px;height:18px;stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round}
</style>
<button class="btp" id="btp" aria-label="回到顶部">
<svg class="ring" viewBox="0 0 48 48"><circle id="btp-ring" cx="24" cy="24" r="20"/></svg>
<svg class="arrow" viewBox="0 0 20 20"><path d="M10 16V4M4 10l6-6 6 6"/></svg>
</button>
<script>
(function(){
  var b=document.getElementById('btp');
  var ring=document.getElementById('btp-ring');
  var C=125.66,raf=0;
  window.addEventListener('scroll',function(){
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(function(){
      var el=document.documentElement;
      var total=el.scrollHeight-el.clientHeight;
      var p=total>0?Math.min(1,Math.max(0,el.scrollTop/total)):0;
      ring.style.strokeDashoffset=C*(1-p);
      if(window.scrollY>400){b.classList.add('show')}else{b.classList.remove('show')}
    });
  },{passive:true});
  b.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'})});
})();
</script>
</body>
</html>`;
}

/* ---------------- 文章详情页 ---------------- */

export async function renderArticlePage(env, post, request) {
  const config = await getSiteConfig(env);
  const origin = siteOrigin(config, request);
  const includePrivate = await isAdminRequest(request, env);
  const [adj, related, views, likes, comments, categories] = await Promise.all([
    adjacentPosts(env, post, includePrivate),
    relatedPosts(env, post, 5, includePrivate),
    getViews(env, post.id),
    getLikes(env, post.id),
    getComments(env),
    getCategoriesWithCounts(env),
  ]);
  const { prev, next } = adj;

  let html = renderMarkdown(post.content);
  // 宽表格包进横向滚动容器，避免撑破阅读宽度（手机端尤其明显）
  html = html.replace(/<table([^>]*)>/gi, '<div class="table-wrap"><table$1>').replace(/<\/table>/gi, '</table></div>');
  const toc = extractToc(html);
  const category = post.categoryId ? categories.find((c) => c.id === post.categoryId) : null;
  const tagObjs = (post.tags || []).length ? await getTagsByIds(env, post.tags) : [];
  const approvedComments = comments.filter((c) => c.postId === post.id && c.status === COMMENT_STATUS.APPROVED);
  const pendingCount = comments.filter((c) => c.postId === post.id && c.status === COMMENT_STATUS.PENDING).length;

  const title = post.title;
  const description = post.summary || (html.replace(/<[^>]+>/g, '').slice(0, 160)) || '';
  const canonical = absUrl(origin, `/posts/${post.slug}/`);
  // 封面优先级：外部 URL > 上传的 Blob 封面 > 按 post.id 选 public/covers/ 默认图 > 站点 OG 图
  const DEFAULT_COVERS = [
    '/covers/cover-backend-code.jpg', '/covers/cover-code-laptop.jpg',
    '/covers/cover-css-code.jpg', '/covers/cover-data-flow.jpg',
    '/covers/cover-dev-desk.jpg', '/covers/cover-devtools.jpg',
    '/covers/cover-dual-monitor.jpg', '/covers/cover-hardware.jpg',
    '/covers/cover-mac-coding.jpg', '/covers/cover-server.jpg',
  ];
  const sid = String(post.id || '');
  let sh = 0;
  for (let i = 0; i < sid.length; i++) sh = (sh * 31 + sid.charCodeAt(i)) >>> 0;
  const defaultCover = absUrl(origin, DEFAULT_COVERS[sh % DEFAULT_COVERS.length]);
  const cover = post.coverUrl
    ? post.coverUrl
    : (post.coverKey ? absUrl(origin, `/api/media/${post.coverKey}`) : (config.seo?.ogImage || defaultCover));

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: description,
    author: { '@type': 'Person', name: post.author || config.author || '' },
    datePublished: post.publishedAt || post.createdAt,
    dateModified: post.updatedAt || post.createdAt,
    ...(cover ? { image: cover } : {}),
    mainEntityOfPage: canonical,
    wordCount: String(post.content ? post.content.length : 0),
  });

  const shareUrl = encodeURIComponent(canonical);
  const shareTitle = encodeURIComponent(`${post.title} - ${config.title}`);

  const body = `
<article class="article-page" data-post-id="${escapeHtml(post.id)}" data-post-slug="${escapeHtml(post.slug)}">
  <div class="article-container">
    <div class="article-head">
      <nav class="breadcrumb"><a href="/">首页</a><span>/</span><a href="/posts/">文章</a></nav>
      <h1 class="article-title">${escapeHtml(post.title)}${(post.visibility || 'public') === 'private' ? '<span class="private-badge">私人</span>' : ''}</h1>
      <div class="article-meta">
        <span class="meta-item">${escapeHtml(post.author || config.author || '博主')}</span>
        <span class="meta-item">${fmtDate(post.publishedAt || post.createdAt)}</span>
        <span class="meta-item">${post.readingTime || readingTime(post.content)} 分钟阅读</span>
        <span class="meta-item" id="view-count">${views} 阅读</span>
        <span class="meta-item" id="like-count">${likes} 赞</span>
        <span class="meta-item">${approvedComments.length} 评论</span>
        ${includePrivate ? `<a class="edit-post-link" href="/admin/#/posts/edit/${escapeHtml(post.id)}" title="编辑这篇文章">✎ 编辑</a>` : ''}
      </div>
      <div class="article-taxonomy">
        ${category ? `<a class="chip" href="/categories/${escapeHtml(category.slug)}/">${escapeHtml(category.name)}</a>` : ''}
        ${tagObjs.map((t) => `<a class="chip" href="/tags/${escapeHtml(t.slug)}/"># ${escapeHtml(t.name)}</a>`).join('')}
      </div>
      ${cover ? `<img class="article-cover" src="${escapeHtml(cover)}" alt="${escapeHtml(post.title)}" loading="lazy">` : ''}
    </div>
    <div class="article-layout${toc.length ? ' has-toc' : ''}">
      ${toc.length ? `
      <aside class="toc" aria-label="目录">
        <div class="toc-title">目录</div>
        <nav class="toc-list">${toc.map((h) => `<a href="#${escapeHtml(h.id)}" class="toc-${h.level}">${escapeHtml(h.text)}</a>`).join('')}</nav>
      </aside>` : ''}
      <div class="article-body prose">
        ${html}
      </div>
    </div>
    <div class="article-actions">
      <button type="button" class="btn-like" id="btn-like">
        <svg class="btn-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s-7-4.5-9.5-9A5.2 5.2 0 0 1 12 6a5.2 5.2 0 0 1 9.5 6C19 16.5 12 21 12 21z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
        <span>点赞</span>
        <span class="btn-count" id="like-count-btn">${likes}</span>
      </button>
      <button type="button" class="btn-share" id="btn-share" onclick="shareArticle()">
        <svg class="btn-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="6" cy="12" r="2.2" stroke="currentColor" stroke-width="1.7"/><circle cx="18" cy="6" r="2.2" stroke="currentColor" stroke-width="1.7"/><circle cx="18" cy="18" r="2.2" stroke="currentColor" stroke-width="1.7"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
        <span>分享</span>
      </button>
    </div>
    <div class="post-nav">
      ${prev ? `<a class="post-nav-item" href="/posts/${escapeHtml(prev.slug)}/"><span class="post-nav-label">上一篇</span><span class="post-nav-title">${escapeHtml(prev.title)}</span></a>` : '<span class="post-nav-item empty"></span>'}
      ${next ? `<a class="post-nav-item" href="/posts/${escapeHtml(next.slug)}/"><span class="post-nav-label">下一篇</span><span class="post-nav-title">${escapeHtml(next.title)}</span></a>` : '<span class="post-nav-item empty"></span>'}
    </div>
    ${related.length ? `
    <div class="related-posts">
      <h2 class="block-title">相关文章</h2>
      <ul class="related-list">
        ${related.map((r) => `<li><a href="/posts/${escapeHtml(r.slug)}/">${escapeHtml(r.title)}</a><span class="related-date">${fmtDate(r.publishedAt || r.createdAt)}</span></li>`).join('')}
      </ul>
    </div>` : ''}
    <section class="comments" id="comments">
      <h2 class="block-title">评论${pendingCount ? ` <span class="pending-badge">${pendingCount} 条待审核</span>` : ''}</h2>
      <div id="comment-list">
        ${approvedComments.map((c) => `
        <div class="comment-item">
          <div class="comment-head"><span class="comment-author">${escapeHtml(c.author)}</span><span class="comment-date">${fmtDate(c.createdAt)}</span></div>
          <div class="comment-content">${escapeHtml(c.content)}</div>
        </div>`).join('') || '<p class="comment-empty">还没有评论，来抢沙发吧～</p>'}
      </div>
      ${config.commentEnabled === false ? '<p class="comment-closed">评论功能已关闭</p>' : `
      <form class="comment-form" id="comment-form">
        <h3 class="comment-form-title">发表评论</h3>
        <div class="form-row">
          <input type="text" name="author" id="c-author" placeholder="昵称 *" required maxlength="60">
          <input type="email" name="email" id="c-email" placeholder="邮箱（可选）" maxlength="120">
        </div>
        <textarea name="content" id="c-content" placeholder="友善发言，共同维护社区氛围～" required maxlength="2000" rows="4"></textarea>
        <div class="form-actions"><span class="form-tip" id="form-tip"></span><button type="submit" class="btn-submit">提交评论</button></div>
      </form>`}
    </section>
  </div>
</article>
<script>window.__COMMENT_MODERATION__=${config.commentModeration !== false};</script>
<script src="/js/article.js" defer></script>`;

  const fullTitle = `${post.title} - ${config.title}`;
  return pageShell({
    config,
    title: fullTitle,
    description,
    keywords: [config.keywords, category?.name, ...(tagObjs.map((t) => t.name))].filter(Boolean).join(','),
    canonical,
    ogImage: cover,
    jsonLd,
    body,
    navKey: 'posts',
  });
}

/* ---------------- 分类 / 标签归档页 ---------------- */

export async function renderListPage(env, { type, title, description, slug, items, request, iconHtml, iconKey }) {
  const config = await getSiteConfig(env);
  const origin = siteOrigin(config, request);
  const canonical = absUrl(origin, `/${type}/${slug}/`);
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description: description || '',
    url: canonical,
  });
  const listHtml = items.map((p) => `
  <article class="list-item">
    <div class="list-item-head">
      <a class="list-item-title" href="/posts/${escapeHtml(p.slug)}/">${escapeHtml(p.title)}${(p.visibility || 'public') === 'private' ? '<span class="private-badge">私人</span>' : ''}</a>
      <span class="list-item-date">${fmtDate(p.publishedAt || p.createdAt)}</span>
    </div>
    ${p.summary ? `<p class="list-item-summary">${escapeHtml(p.summary)}</p>` : ''}
  </article>`).join('');

  const body = `
<div class="archive-page">
  <div class="archive-head">
    ${iconHtml ? `<span class="archive-icon cat-ic-${escapeHtml(iconKey || 'doc')}" aria-hidden="true">${iconHtml}</span>` : ''}
    <h1 class="archive-title">${escapeHtml(title)}</h1>
    ${description ? `<p class="archive-desc">${escapeHtml(description)}</p>` : ''}
    <p class="archive-count">共 ${items.length} 篇文章</p>
  </div>
  <div class="archive-list">
    ${listHtml || '<p class="archive-empty">暂无文章</p>'}
  </div>
</div>`;

  return pageShell({
    config,
    title: `${title} - ${config.title}`,
    description: description || `查看 ${title} 下的全部文章`,
    canonical,
    ogImage: config.seo?.ogImage || '',
    jsonLd,
    body,
    navKey: type === 'categories' ? 'categories' : 'tags',
  });
}
