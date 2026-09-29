/**
 * 临时 mock：EdgeOne Functions 等价 HTTP 服务（监听 3138）。验证后删除。
 */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';

export function createMockKv() {
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

export function createMockBlob() {
  const map = new Map();
  const toBytes = (v) => {
    if (v instanceof Uint8Array) return v;
    if (v instanceof ArrayBuffer) return new Uint8Array(v);
    return new TextEncoder().encode(String(v));
  };
  return {
    async set(key, value, opts) { map.set(key, { value, contentType: opts?.contentType || 'application/octet-stream' }); },
    async get(key, { type = 'text' } = {}) {
      const item = map.get(key);
      if (!item) return null;
      const bytes = toBytes(item.value);
      if (type === 'json') return JSON.parse(item.value);
      if (type === 'arrayBuffer') return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      if (type === 'blob') return new Blob([bytes]);
      return item.value;
    },
    async getMetadata(key) {
      const item = map.get(key);
      if (!item) return null;
      return { contentType: item.contentType, cacheControl: 'max-age=0', etag: '' };
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

const root = '/home/user/Doubao/chats/38444472788929026/edgeone-blog';

function routeFile(urlPath) {
  if (/^\/posts\/[^/]+$/.test(urlPath)) return 'posts/[slug].js';
  if (/^\/categories\/[^/]+$/.test(urlPath)) return 'categories/[slug].js';
  if (/^\/tags\/[^/]+$/.test(urlPath)) return 'tags/[slug].js';
  const api = urlPath.startsWith('/api/') ? urlPath.slice(5) : null;
  if (!api) return null;
  const segs = api.split('/').filter(Boolean);
  if (segs[0] === 'posts' && segs.length === 3) return `api/posts/[id]/${segs[2]}.js`;
  if (segs[0] === 'posts' && segs.length === 2) return 'api/posts/[id].js';
  if (segs[0] === 'posts' && segs.length === 1) return 'api/posts/index.js';
  const last = segs[segs.length - 1];
  const base = segs.slice(0, -1).join('/');
  const dir = base ? `${base}/` : '';
  return `api/${dir}${last}.js`;
}

async function seed() {
  const call = async (file, method, path, { body, cookie } = {}) => {
    const mod = await import(new URL(`file://${root}/edge-functions/${file}`).href);
    const handler =
      (method === 'GET' && (mod.onRequestGet || mod.onRequest)) ||
      (method === 'POST' && (mod.onRequestPost || mod.onRequest)) ||
      (method === 'PUT' && (mod.onRequestPut || mod.onRequest)) ||
      (method === 'DELETE' && (mod.onRequestDelete || mod.onRequest));
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    if (body) headers['Content-Type'] = 'application/json';
    const request = new Request(`https://blog.example.com${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    return handler({ request, env: {}, params: {}, waitUntil: () => {} });
  };
  await call('api/auth/setup.js', 'POST', '/api/auth/setup', { body: { username: 'admin', password: 'admin123456' } });
  const login = await call('api/auth/login.js', 'POST', '/api/auth/login', { body: { username: 'admin', password: 'admin123456' } });
  const cookie = login.headers.get('Set-Cookie').split(';')[0];
  const cats = [
    ['云计算', 'cloud', '云服务与 DNS 相关文章', 'cloud'],
    ['技术踩坑', 'pitfalls', '踩坑记录', 'bug'],
    ['工具分享', 'tools', '好用的工具', 'wrench'],
    ['前端开发', 'frontend', '前端技术', 'layout'],
    ['数据库', 'database', '数据库相关', 'database'],
    ['网络观察', 'network', '网络观察随笔', 'network'],
    ['互联网干货', 'web', '互联网知识', 'globe'],
  ];
  const catIds = {};
  for (const [name, slug, desc, icon] of cats) {
    const r = await call('api/categories/index.js', 'POST', '/api/categories', { body: { name, slug, description: desc, icon }, cookie });
    catIds[slug] = (await r.json()).category.id;
  }
  await call('api/tags/index.js', 'POST', '/api/tags', { body: { name: 'DNS' }, cookie });
  await call('api/tags/index.js', 'POST', '/api/tags', { body: { name: 'Next.js' }, cookie });

  const mkPost = (title, slug, summary, content, catSlug, tags = []) =>
    call('api/posts/index.js', 'POST', '/api/posts', { body: { title, slug, summary, content, status: 'published', categoryId: catIds[catSlug], tagNames: tags }, cookie });

  await mkPost('公共DNS', 'tpcs', '公共DNS服务器地址大全。', '# DNS\n\n公共 DNS 服务器地址。', 'cloud', ['DNS']);
  await mkPost('阿里云免费证书领取教程', 'aliyun-cert', '免费 SSL 证书领取完整教程。', '# 教程\n\n阿里云免费证书。', 'pitfalls', ['Next.js']);
  await mkPost('域名/App备案', 'icp', '域名与 App 备案实操记录。', '# 备案\n\n备案流程。', 'tools', []);
  await mkPost('视频播放测试', 'video-test', '视频链接自动识别：B站嵌入 + mp4 直链播放器。', `# 视频测试

## B 站视频

https://www.bilibili.com/video/BV1GJ411x7h7

## 直链 mp4

[点击播放示例视频](https://cdn.example.com/video/demo.mp4)

## 普通链接

[我的博客](https://blog.y11.fun/about/)`, 'pitfalls', ['Next.js']);
  return { cookie };
}

const PORT = 3138;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  try {
    if (url.pathname === '/styles/article.css') {
      const css = readFileSync(`${root}/public/styles/article.css`, 'utf8');
      res.writeHead(200, { 'content-type': 'text/css; charset=utf-8' });
      res.end(css);
      return;
    }
    const file0 = routeFile(url.pathname);
    if (!file0) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    let file = file0;
    if (!existsSync(`${root}/edge-functions/${file}`) && /^api\/[a-z-]+\.js$/.test(file)) {
      const alt = file.replace(/\.js$/, '/index.js');
      if (existsSync(`${root}/edge-functions/${alt}`)) file = alt;
    }
    const mod = await import(new URL(`file://${root}/edge-functions/${file}`).href);
    let params = {};
    const segs = url.pathname.split('/').filter(Boolean);
    if (file === 'posts/[slug].js' || file === 'categories/[slug].js' || file === 'tags/[slug].js') {
      params = { slug: decodeURIComponent(segs[segs.length - 1]) };
    }
    if (file === 'api/posts/[id].js' || file.startsWith('api/posts/[id]/')) {
      params = { id: decodeURIComponent(segs[2]) };
    }
    const method = req.method;
    const handler =
      (method === 'GET' && (mod.onRequestGet || mod.onRequest)) ||
      (method === 'POST' && (mod.onRequestPost || mod.onRequest)) ||
      (method === 'PUT' && (mod.onRequestPut || mod.onRequest)) ||
      (method === 'DELETE' && (mod.onRequestDelete || mod.onRequest));
    if (!handler) {
      res.writeHead(501, { 'content-type': 'text/plain' });
      res.end('no handler');
      return;
    }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const rawBody = Buffer.concat(chunks).toString('utf8');
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (v !== undefined) headers[k === 'cookie' ? 'Cookie' : k] = Array.isArray(v) ? v.join(', ') : String(v);
    }
    const request = new Request(`https://blog.example.com${url.pathname}${url.search}`, {
      method, headers, body: rawBody || undefined,
    });
    const ctx = { request, env: {}, params, waitUntil: () => {} };
    const resp = await handler(ctx);
    const respHeaders = {};
    resp.headers.forEach((v, k) => { respHeaders[k] = v; });
    res.writeHead(resp.status, respHeaders);
    res.end(Buffer.from(await resp.arrayBuffer()));
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end(`mock error: ${e.message}\n${e.stack}`);
  }
});

await seed();
server.listen(PORT, '127.0.0.1', () => console.log(`mock api listening on http://127.0.0.1:${PORT}`));
