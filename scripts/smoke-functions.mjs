/**
 * EdgeOne Functions 冒烟测试：以内存 KV / Blob mock 驱动真实 handler 全流程。
 * 运行：npm run test:functions
 *
 * 模拟 Edge Functions 运行时：全局注入 __BLOG_KV__ / __BLOG_BLOB__，
 * 使用 Node 22 内置的 Request / Response / fetch / crypto.subtle。
 */
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/* ---------------- mock 存储 ---------------- */

function createMockKv() {
  const map = new Map();
  return {
    async put(key, value) { map.set(key, String(value)); },
    async get(key, type) {
      const v = map.get(key);
      if (v === undefined) return null;
      if (type === 'json' || type?.type === 'json') return JSON.parse(v);
      return v;
    },
    async delete(key) { map.delete(key); },
    async list({ prefix = '', limit = 256, cursor = '' } = {}) {
      const keys = [...map.keys()].filter((k) => k.startsWith(prefix)).sort();
      const start = cursor ? keys.indexOf(cursor) + 1 : 0;
      const slice = keys.slice(start, start + limit);
      const complete = start + limit >= keys.length;
      return { complete, cursor: complete ? null : slice[slice.length - 1] ?? null, keys: slice.map((key) => ({ key })) };
    },
  };
}

function createMockBlob() {
  const map = new Map(); // key -> { value, contentType }
  return {
    async set(key, value, opts) {
      map.set(key, { value, contentType: opts?.contentType || 'application/octet-stream' });
    },
    async get(key, { type = 'text' } = {}) {
      const item = map.get(key);
      if (!item) return null;
      if (type === 'json') return JSON.parse(item.value);
      if (type === 'arrayBuffer') return new TextEncoder().encode(item.value).buffer;
      return item.value;
    },
    async getWithHeaders(key) {
      const item = map.get(key);
      if (!item) return null;
      return { body: item.value, headers: { 'content-type': item.contentType } };
    },
    async delete(key) { map.delete(key); },
    async list() { return { blobs: [], directories: [] }; },
    async createUploadUrl(key, opts) {
      return { url: `https://mock-upload/${key}`, key, expiresAt: Math.floor(Date.now() / 1000) + (opts?.expireSeconds || 3600) };
    },
  };
}

globalThis.__BLOG_KV__ = createMockKv();
globalThis.__BLOG_BLOB__ = createMockBlob();

/* ---------------- 测试驱动 ---------------- */

let passed = 0;
let failed = 0;
const failures = [];

async function call(file, method, url, { body, cookie, params = {} } = {}) {
  const mod = await import(new URL(`../edge-functions/${file}`, import.meta.url).href);
  const handler =
    (method === 'GET' && (mod.onRequestGet || mod.onRequest)) ||
    (method === 'POST' && (mod.onRequestPost || mod.onRequest)) ||
    (method === 'PUT' && (mod.onRequestPut || mod.onRequest)) ||
    (method === 'DELETE' && (mod.onRequestDelete || mod.onRequest));
  assert.ok(handler, `${file} 缺少 ${method} handler`);
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body) headers['Content-Type'] = 'application/json';
  const request = new Request(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const ctx = { request, env: {}, params, waitUntil: () => {} };
  return handler(ctx);
}

async function parse(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then((r) => { passed++; console.log(`  ✓ ${name}`); return r; })
    .catch((e) => { failed++; failures.push(name); console.error(`  ✗ ${name}: ${e.message}`); });
}

const BASE = 'https://blog.example.com';
let cookie = '';

console.log('\n[1/6] 认证流程');
await test('首次初始化管理员', async () => {
  const r = await call('api/auth/setup.js', 'POST', `${BASE}/api/auth/setup`, { body: { username: 'admin', password: 'password123' } });
  assert.equal(r.status, 200);
});
await test('重复初始化被拒绝', async () => {
  const r = await call('api/auth/setup.js', 'POST', `${BASE}/api/auth/setup`, { body: { username: 'admin2', password: 'password123' } });
  assert.equal(r.status, 403);
});
await test('错误密码登录被拒绝', async () => {
  const r = await call('api/auth/login.js', 'POST', `${BASE}/api/auth/login`, { body: { username: 'admin', password: 'wrong' } });
  assert.equal(r.status, 401);
});
await test('正确登录并拿到会话 Cookie', async () => {
  const r = await call('api/auth/login.js', 'POST', `${BASE}/api/auth/login`, { body: { username: 'admin', password: 'password123' } });
  const setCookie = r.headers.get('Set-Cookie');
  assert.ok(setCookie && setCookie.includes('blog_admin='));
  cookie = setCookie.split(';')[0];
});
await test('带 Cookie 获取登录状态', async () => {
  const r = await call('api/auth/me.js', 'GET', `${BASE}/api/auth/me`, { cookie });
  const d = await parse(r);
  assert.equal(d.ok, true);
  assert.equal(d.username, 'admin');
});
await test('未登录访问 /api/auth/me', async () => {
  const r = await call('api/auth/me.js', 'GET', `${BASE}/api/auth/me`);
  const d = await parse(r);
  assert.equal(d.ok, false);
});

console.log('\n[2/6] 分类 / 标签');
let catId, tagId;
await test('创建分类', async () => {
  const r = await call('api/categories/index.js', 'POST', `${BASE}/api/categories`, { body: { name: '前端开发', slug: 'frontend', description: '前端技术文章' }, cookie });
  const d = await parse(r);
  assert.equal(d.ok, true);
  catId = d.category.id;
});
await test('重复分类名被拒绝', async () => {
  const r = await call('api/categories/index.js', 'POST', `${BASE}/api/categories`, { body: { name: '前端开发' }, cookie });
  assert.equal(r.status, 400);
});
await test('公开获取分类列表（含文章数）', async () => {
  const r = await call('api/categories/index.js', 'GET', `${BASE}/api/categories`);
  const d = await parse(r);
  assert.equal(d.ok, true);
  assert.equal(d.items.length, 1);
  assert.equal(d.items[0].postCount, 0);
});
await test('创建标签', async () => {
  const r = await call('api/tags/index.js', 'POST', `${BASE}/api/tags`, { body: { name: 'Next.js' }, cookie });
  const d = await parse(r);
  assert.equal(d.ok, true);
  tagId = d.tag.id;
});

console.log('\n[3/6] 文章');
let postId, postSlug;
await test('未登录创建文章被拒绝', async () => {
  const r = await call('api/posts/index.js', 'POST', `${BASE}/api/posts`, { body: { title: 'x' } });
  assert.equal(r.status, 401);
});
await test('创建已发布文章（自动建标签）', async () => {
  const r = await call('api/posts/index.js', 'POST', `${BASE}/api/posts`, {
    body: {
      title: 'EdgeOne Pages 入门指南',
      slug: 'edgeone-pages-guide',
      summary: '从零开始部署一个全栈博客',
      content: '# 介绍\n\n这是 **正文**。\n\n```js\nconst a = 1;\n```\n\n## 第二节\n\n- 列表项 A\n- 列表项 B\n',
      status: 'published',
      categoryId: catId,
      tagNames: ['Next.js', 'EdgeOne'],
    },
    cookie,
  });
  const d = await parse(r);
  assert.equal(d.ok, true);
  assert.equal(d.post.slug, 'edgeone-pages-guide');
  assert.equal(d.post.status, 'published');
  assert.ok(d.post.readingTime >= 1);
  assert.equal(d.post.tags.length, 2);
  postId = d.post.id;
  postSlug = d.post.slug;
});
await test('公开文章列表仅返回已发布', async () => {
  const r = await call('api/posts/index.js', 'GET', `${BASE}/api/posts?page=1&pageSize=10`);
  const d = await parse(r);
  assert.equal(d.ok, true);
  assert.equal(d.total, 1);
  assert.equal(d.items[0].title.includes('EdgeOne'), true);
});
await test('按分类筛选文章', async () => {
  const r = await call('api/posts/index.js', 'GET', `${BASE}/api/posts?category=${catId}`);
  const d = await parse(r);
  assert.equal(d.total, 1);
});
await test('文章详情（含统计与分类信息）', async () => {
  const r = await call('api/posts/[id].js', 'GET', `${BASE}/api/posts/${postId}`, { params: { id: postId } });
  const d = await parse(r);
  assert.equal(d.ok, true);
  assert.equal(d.post.category.name, '前端开发');
  assert.equal(d.post.stats.views, 0);
  assert.ok(d.post.content.includes('# 介绍'));
});
await test('按 slug 访问文章', async () => {
  const r = await call('api/posts/[id].js', 'GET', `${BASE}/api/posts/${postSlug}`, { params: { id: postSlug } });
  const d = await parse(r);
  assert.equal(d.ok, true);
  assert.equal(d.post.id, postId);
});

console.log('\n[4/6] 互动：阅读 / 点赞 / 评论');
await test('阅读量 +1', async () => {
  const r = await call('api/posts/[id]/view.js', 'POST', `${BASE}/api/posts/${postSlug}/view`, { params: { id: postSlug } });
  const d = await parse(r);
  assert.equal(d.count, 1);
});
await test('点赞 +1', async () => {
  const r = await call('api/posts/[id]/like.js', 'POST', `${BASE}/api/posts/${postSlug}/like`, { params: { id: postSlug } });
  const d = await parse(r);
  assert.equal(d.count, 1);
});
await test('提交评论进入待审核', async () => {
  const r = await call('api/posts/[id]/comments.js', 'POST', `${BASE}/api/posts/${postSlug}/comments`, {
    body: { author: '访客小明', email: 'a@b.com', content: '写得太好了，受益匪浅！' },
    params: { id: postSlug },
  });
  const d = await parse(r);
  assert.equal(d.ok, true);
  assert.equal(d.comment.status, 'pending');
});
await test('待审核评论不对外展示', async () => {
  const r = await call('api/posts/[id]/comments.js', 'GET', `${BASE}/api/posts/${postSlug}/comments`, { params: { id: postSlug } });
  const d = await parse(r);
  assert.equal(d.items.length, 0);
});
let commentId;
await test('管理员审核通过评论', async () => {
  const r = await call('api/comments/index.js', 'GET', `${BASE}/api/comments?status=pending`, { cookie });
  const d = await parse(r);
  assert.equal(d.total, 1);
  commentId = d.items[0].id;
  const r2 = await call('api/comments/[id].js', 'PUT', `${BASE}/api/comments/${commentId}`, { body: { postId, status: 'approved' }, cookie, params: { id: commentId } });
  const d2 = await parse(r2);
  assert.equal(d2.comment.status, 'approved');
});
await test('审核后评论对外展示', async () => {
  const r = await call('api/posts/[id]/comments.js', 'GET', `${BASE}/api/posts/${postSlug}/comments`, { params: { id: postSlug } });
  const d = await parse(r);
  assert.equal(d.items.length, 1);
  assert.equal(d.items[0].author, '访客小明');
});
await test('相关文章接口可用', async () => {
  const r = await call('api/posts/[id]/related.js', 'GET', `${BASE}/api/posts/${postSlug}/related`, { params: { id: postSlug } });
  const d = await parse(r);
  assert.equal(d.ok, true);
  assert.ok(Array.isArray(d.items));
});

console.log('\n[5/6] 搜索 / 统计 / 配置 / 媒体');
await test('全文搜索命中标题', async () => {
  const r = await call('api/search.js', 'GET', `${BASE}/api/search?q=${encodeURIComponent('EdgeOne')}`);
  const d = await parse(r);
  assert.equal(d.total, 1);
});
await test('搜索无结果返回空', async () => {
  const r = await call('api/search.js', 'GET', `${BASE}/api/search?q=zzzz`);
  const d = await parse(r);
  assert.equal(d.total, 0);
});
await test('访问埋点统计', async () => {
  const r = await call('api/stats/track.js', 'POST', `${BASE}/api/stats/track`, { body: { type: 'visit' } });
  const d = await parse(r);
  assert.equal(d.stats.total, 1);
  assert.equal(d.stats.today, 1);
});
await test('管理员查看统计总览', async () => {
  const r = await call('api/stats/index.js', 'GET', `${BASE}/api/stats`, { cookie });
  const d = await parse(r);
  assert.equal(d.ok, true);
  assert.equal(d.stats.totalPosts, 1);
  assert.equal(d.stats.totalComments, 1);
  assert.equal(d.stats.pendingComments, 0);
});
await test('获取站点配置', async () => {
  const r = await call('api/config/index.js', 'GET', `${BASE}/api/config`);
  const d = await parse(r);
  assert.equal(d.ok, true);
  assert.equal(d.config.title, '我的博客');
});
await test('更新站点配置（管理员）', async () => {
  const r = await call('api/config/index.js', 'PUT', `${BASE}/api/config`, { body: { title: '墨白博客', commentEnabled: false }, cookie });
  const d = await parse(r);
  assert.equal(d.config.title, '墨白博客');
  assert.equal(d.config.commentEnabled, false);
});
await test('获取媒体直传 URL 并写文件', async () => {
  const r = await call('api/media/upload-url.js', 'POST', `${BASE}/api/media/upload-url`, { body: { name: 'cover.png', type: 'cover', contentType: 'image/png' }, cookie });
  const d = await parse(r);
  assert.equal(d.ok, true);
  assert.ok(d.url.includes('mock-upload'));
  // 模拟浏览器直传
  await globalThis.__BLOG_BLOB__.set(d.key, 'fake-image-bytes', { contentType: 'image/png' });
  const r2 = await call('api/media/[[key]].js', 'GET', `${BASE}/api/media/${d.key}`, { params: { key: d.key } });
  assert.equal(r2.status, 200);
  assert.equal(r2.headers.get('Content-Type'), 'image/png');
});
await test('未登录获取直传 URL 被拒绝', async () => {
  const r = await call('api/media/upload-url.js', 'POST', `${BASE}/api/media/upload-url`, { body: { name: 'x.png', type: 'image' } });
  assert.equal(r.status, 401);
});

console.log('\n[6/6] 服务端渲染页面与 SEO');
await test('文章页 HTML 含正文与 SEO 元信息', async () => {
  const r = await call('posts/[slug].js', 'GET', `${BASE}/posts/${postSlug}/`, { params: { slug: postSlug } });
  const html = await parse(r);
  assert.ok(html.includes('EdgeOne Pages 入门指南'));
  assert.ok(html.includes('og:title'));
  assert.ok(html.includes('application/ld+json'));
  assert.ok(html.includes('class="code-block'));
  assert.ok(html.includes('id="btn-like"'));
  assert.ok(html.includes('/js/article.js'));
});
await test('草稿文章页返回 404', async () => {
  // 创建草稿
  const r0 = await call('api/posts/index.js', 'POST', `${BASE}/api/posts`, { body: { title: '草稿文章', content: '未发布', status: 'draft' }, cookie });
  const d0 = JSON.parse(await r0.text());
  const draftSlug = d0.post.slug;
  const r = await call('posts/[slug].js', 'GET', `${BASE}/posts/${draftSlug}/`, { params: { slug: draftSlug } });
  assert.equal(r.status, 404);
});
await test('分类归档页 HTML', async () => {
  const r = await call('categories/[slug].js', 'GET', `${BASE}/categories/frontend/`, { params: { slug: 'frontend' } });
  const html = await parse(r);
  assert.ok(html.includes('分类：前端开发'));
  assert.ok(html.includes('EdgeOne Pages 入门指南'));
});
await test('标签归档页 HTML', async () => {
  const r = await call('tags/[slug].js', 'GET', `${BASE}/tags/next-js/`, { params: { slug: 'next-js' } });
  const html = await parse(r);
  assert.ok(html.includes('Next.js'));
});
await test('sitemap.xml 含文章 URL', async () => {
  const r = await call('sitemap.xml.js', 'GET', `${BASE}/sitemap.xml`);
  const xml = await parse(r);
  assert.ok(xml.includes('<urlset'));
  assert.ok(xml.includes(`/posts/${postSlug}/`));
  assert.ok(xml.includes('/categories/frontend/'));
});
await test('rss.xml 含文章条目', async () => {
  const r = await call('rss.xml.js', 'GET', `${BASE}/rss.xml`);
  const xml = await parse(r);
  assert.ok(xml.includes('<rss'));
  assert.ok(xml.includes('EdgeOne Pages 入门指南'));
  assert.ok(xml.includes(`/posts/${postSlug}/`));
});

console.log('\n[7/9] 新功能：slug 自动生成 / 私人文章 / TOTP / 备份');
let privateId, privateSlug;
await test('slug 留白（空格）自动按标题生成', async () => {
  const r = await call('api/posts/index.js', 'POST', `${BASE}/api/posts`, {
    body: { title: 'Slug 自动生成测试', slug: '   ', content: '正文', status: 'published' },
    cookie,
  });
  const d = await parse(r);
  assert.equal(d.ok, true);
  assert.equal(d.post.slug, 'slug-自动生成测试');
});
await test('创建私人文章（已发布但仅管理员可见）', async () => {
  const r = await call('api/posts/index.js', 'POST', `${BASE}/api/posts`, {
    body: { title: '私人日记', content: '只有我能看', status: 'published', visibility: 'private' },
    cookie,
  });
  const d = await parse(r);
  assert.equal(d.ok, true);
  assert.equal(d.post.visibility, 'private');
  privateId = d.post.id;
  privateSlug = d.post.slug;
});
await test('公开文章列表不含私人文章', async () => {
  const r = await call('api/posts/index.js', 'GET', `${BASE}/api/posts?page=1&pageSize=20`);
  const d = await parse(r);
  assert.equal(d.ok, true);
  assert.ok(!d.items.some((p) => p.visibility === 'private'));
});
await test('管理员文章列表含私人文章', async () => {
  const r = await call('api/posts/index.js', 'GET', `${BASE}/api/posts?page=1&pageSize=20&status=published&scope=admin`, { cookie });
  const d = await parse(r);
  assert.ok(d.items.some((p) => p.visibility === 'private'));
});
await test('前台带 Cookie 也不暴露私人文章', async () => {
  const r = await call('api/posts/index.js', 'GET', `${BASE}/api/posts?page=1&pageSize=20`, { cookie });
  const d = await parse(r);
  assert.ok(!d.items.some((p) => p.visibility === 'private'));
});
await test('未登录访问私人文章详情返回 404', async () => {
  const r = await call('api/posts/[id].js', 'GET', `${BASE}/api/posts/${privateSlug}`, { params: { id: privateSlug } });
  assert.equal(r.status, 404);
});
await test('管理员访问私人文章详情成功', async () => {
  const r = await call('api/posts/[id].js', 'GET', `${BASE}/api/posts/${privateSlug}`, { cookie, params: { id: privateSlug } });
  const d = await parse(r);
  assert.equal(d.ok, true);
  assert.equal(d.post.visibility, 'private');
});
await test('未登录 SSR 访问私人文章返回 404', async () => {
  const r = await call('posts/[slug].js', 'GET', `${BASE}/posts/${privateSlug}/`, { params: { slug: privateSlug } });
  assert.equal(r.status, 404);
});
await test('管理员 SSR 访问私人文章成功', async () => {
  const r = await call('posts/[slug].js', 'GET', `${BASE}/posts/${privateSlug}/`, { cookie, params: { slug: privateSlug } });
  assert.equal(r.status, 200);
});
await test('搜索不含私人文章', async () => {
  const r = await call('api/search.js', 'GET', `${BASE}/api/search?q=${encodeURIComponent('私人')}`);
  const d = await parse(r);
  assert.ok(!d.items.some((p) => p.visibility === 'private'));
});
await test('sitemap 不含私人文章', async () => {
  const r = await call('sitemap.xml.js', 'GET', `${BASE}/sitemap.xml`);
  const xml = await parse(r);
  assert.ok(!xml.includes(`/posts/${privateSlug}/`));
});
await test('rss 不含私人文章', async () => {
  const r = await call('rss.xml.js', 'GET', `${BASE}/rss.xml`);
  const xml = await parse(r);
  assert.ok(!xml.includes(`/posts/${privateSlug}/`));
});
await test('私人文章拒绝评论', async () => {
  const r = await call('api/posts/[id]/comments.js', 'POST', `${BASE}/api/posts/${privateSlug}/comments`, {
    body: { author: '游客', content: '想评论私人文章' },
    params: { id: privateSlug },
  });
  assert.equal(r.status, 400);
});
await test('未登录导出备份被拒绝', async () => {
  const r = await call('api/backup/index.js', 'GET', `${BASE}/api/backup/export`);
  assert.equal(r.status, 401);
});
await test('管理员全量导出备份 JSON', async () => {
  const r = await call('api/backup/index.js', 'GET', `${BASE}/api/backup/export`, { cookie });
  const d = await parse(r);
  assert.equal(r.status, 200);
  assert.ok(d.count > 0);
  assert.ok(d.data['config_site'] !== undefined);
  assert.ok(Object.keys(d.data).some((k) => k.startsWith('post_')));
});
await test('未登录 WebDAV 备份被拒绝', async () => {
  const r = await call('api/backup/index.js', 'POST', `${BASE}/api/backup/webdav`);
  assert.equal(r.status, 401);
});

console.log('\n[8/9] TOTP 二次验证');
let totpSecret;
await test('TOTP 工具：生成密钥并验证验证码', async () => {
  const { generateTotpSecret, totpCode, verifyTotp, totpUri } = await import(new URL(`../edge-functions/api/_lib/auth.js`, import.meta.url).href);
  const secret = generateTotpSecret();
  assert.ok(secret.length >= 16);
  const uri = totpUri(secret, 'admin');
  assert.ok(uri.startsWith('otpauth://totp/'));
  const code = await totpCode(secret);
  assert.match(code, /^\d{6}$/);
  assert.equal(await verifyTotp(secret, code), true);
  assert.equal(await verifyTotp(secret, '000000'), false);
});
await test('未登录操作 TOTP 被拒绝', async () => {
  const r = await call('api/auth/totp.js', 'POST', `${BASE}/api/auth/totp`, { body: { action: 'setup' } });
  assert.equal(r.status, 401);
});
await test('管理员生成 TOTP 密钥', async () => {
  const r = await call('api/auth/totp.js', 'POST', `${BASE}/api/auth/totp`, { body: { action: 'setup' }, cookie });
  const d = await parse(r);
  assert.equal(d.ok, true);
  assert.ok(d.secret);
  assert.ok(d.uri.startsWith('otpauth://totp/'));
  totpSecret = d.secret;
});
await test('错误验证码启用失败', async () => {
  const r = await call('api/auth/totp.js', 'POST', `${BASE}/api/auth/totp`, { body: { action: 'verify', code: '000000' }, cookie });
  assert.equal(r.status, 401);
});
await test('正确验证码启用 TOTP', async () => {
  const { totpCode } = await import(new URL(`../edge-functions/api/_lib/auth.js`, import.meta.url).href);
  const code = await totpCode(totpSecret);
  const r = await call('api/auth/totp.js', 'POST', `${BASE}/api/auth/totp`, { body: { action: 'verify', code }, cookie });
  const d = await parse(r);
  assert.equal(d.enabled, true);
});
await test('me 返回 TOTP 已启用', async () => {
  const r = await call('api/auth/me.js', 'GET', `${BASE}/api/auth/me`, { cookie });
  const d = await parse(r);
  assert.equal(d.totpEnabled, true);
});
await test('启用 TOTP 后无验证码登录返回 totpRequired', async () => {
  const r = await call('api/auth/login.js', 'POST', `${BASE}/api/auth/login`, { body: { username: 'admin', password: 'password123' } });
  const d = await parse(r);
  assert.equal(d.ok, true);
  assert.equal(d.totpRequired, true);
});
await test('启用 TOTP 后错误验证码登录被拒', async () => {
  const r = await call('api/auth/login.js', 'POST', `${BASE}/api/auth/login`, { body: { username: 'admin', password: 'password123', totp: '000000' } });
  assert.equal(r.status, 401);
});
await test('启用 TOTP 后正确验证码登录成功', async () => {
  const { totpCode } = await import(new URL(`../edge-functions/api/_lib/auth.js`, import.meta.url).href);
  const code = await totpCode(totpSecret);
  const r = await call('api/auth/login.js', 'POST', `${BASE}/api/auth/login`, { body: { username: 'admin', password: 'password123', totp: code } });
  const setCookie = r.headers.get('Set-Cookie');
  assert.ok(setCookie && setCookie.includes('blog_admin='));
  cookie = setCookie.split(';')[0];
});
await test('正确验证码关闭 TOTP', async () => {
  const { totpCode } = await import(new URL(`../edge-functions/api/_lib/auth.js`, import.meta.url).href);
  const code = await totpCode(totpSecret);
  const r = await call('api/auth/totp.js', 'POST', `${BASE}/api/auth/totp`, { body: { action: 'disable', code }, cookie });
  const d = await parse(r);
  assert.equal(d.enabled, false);
});
await test('关闭后直接登录成功（无需验证码）', async () => {
  const r = await call('api/auth/login.js', 'POST', `${BASE}/api/auth/login`, { body: { username: 'admin', password: 'password123' } });
  const setCookie = r.headers.get('Set-Cookie');
  assert.ok(setCookie && setCookie.includes('blog_admin='));
  cookie = setCookie.split(';')[0];
});

console.log('\n[9/9] 删除与清理');
await test('管理员删除评论', async () => {
  const r = await call('api/comments/[id].js', 'DELETE', `${BASE}/api/comments/${commentId}?postId=${postId}`, { cookie, params: { id: commentId } });
  const d = await parse(r);
  assert.equal(d.ok, true);
});
await test('删除文章', async () => {
  const r = await call('api/posts/[id].js', 'DELETE', `${BASE}/api/posts/${postId}`, { cookie, params: { id: postId } });
  const d = await parse(r);
  assert.equal(d.ok, true);
});
await test('删除后文章详情返回 404', async () => {
  const r = await call('api/posts/[id].js', 'GET', `${BASE}/api/posts/${postId}`, { params: { id: postId } });
  assert.equal(r.status, 404);
});
await test('退出登录', async () => {
  const r = await call('api/auth/logout.js', 'POST', `${BASE}/api/auth/logout`, { cookie });
  const d = await parse(r);
  assert.equal(d.ok, true);
  const r2 = await call('api/auth/me.js', 'GET', `${BASE}/api/auth/me`);
  const d2 = await parse(r2);
  assert.equal(d2.ok, false);
});

console.log(`\n${'='.repeat(50)}`);
console.log(`通过 ${passed} 项，失败 ${failed} 项`);
if (failed) {
  console.log('失败项：', failures.join(' | '));
  process.exit(1);
}
console.log('✅ 冒烟测试全部通过');
