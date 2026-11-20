#!/usr/bin/env node
/**
 * 本地一体化运行器：静态导出（out/）+ EdgeOne Functions 本地模拟。
 *
 * - /api/**、/mcp、/posts/:slug/、/categories/:slug/、/tags/:slug/、/sitemap.xml、/rss.xml 走 edge-functions 真实 handler
 * - 其余请求从 out/ 提供静态文件
 * - KV / Blob 使用文件持久化（.local-data/），重启不丢数据
 *
 * 用法：node scripts/local-serve.mjs   （默认端口 8080）
 */
import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'out');
const FN_DIR = path.join(ROOT, 'edge-functions');
const DATA_DIR = path.join(ROOT, '.local-data');
const BLOB_DIR = path.join(DATA_DIR, 'blob');
const KV_FILE = path.join(DATA_DIR, 'kv.json');
const BLOB_META_FILE = path.join(DATA_DIR, 'blob-meta.json');
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';

if (!existsSync(path.join(OUT_DIR, 'index.html'))) {
  console.error('[local] 未找到 out/index.html，请先执行: npm run build');
  process.exit(1);
}

/* ---------------- KV mock（文件持久化） ---------------- */
await fs.mkdir(DATA_DIR, { recursive: true });
await fs.mkdir(BLOB_DIR, { recursive: true });

let kvMap = new Map();
try {
  kvMap = new Map(Object.entries(JSON.parse(await fs.readFile(KV_FILE, 'utf8'))));
} catch { /* 首次运行 */ }

let kvTimer = null;
function scheduleKvSave() {
  if (kvTimer) return;
  kvTimer = setTimeout(async () => {
    kvTimer = null;
    try {
      await fs.writeFile(KV_FILE, JSON.stringify(Object.fromEntries(kvMap), null, 0));
    } catch (e) {
      console.error('[kv] 持久化失败:', e.message);
    }
  }, 200);
  kvTimer.unref?.();
}

globalThis.__BLOG_KV__ = {
  async put(key, value) { kvMap.set(String(key), String(value)); scheduleKvSave(); },
  async get(key, type) {
    const v = kvMap.get(String(key));
    if (v === undefined) return null;
    if (type === 'json' || type?.type === 'json') {
      try { return JSON.parse(v); } catch { return null; }
    }
    return v;
  },
  async delete(key) { kvMap.delete(String(key)); scheduleKvSave(); },
  async list({ prefix = '', limit = 1000, cursor = '' } = {}) {
    const keys = [...kvMap.keys()].filter((k) => k.startsWith(prefix)).sort();
    const start = cursor ? keys.indexOf(cursor) + 1 : 0;
    const slice = keys.slice(start, start + limit);
    const complete = start + limit >= keys.length;
    return { complete, cursor: complete ? null : slice[slice.length - 1] ?? null, keys: slice.map((key) => ({ key })) };
  },
};

/* ---------------- Blob mock（文件持久化） ---------------- */
let blobMeta = {};
try { blobMeta = JSON.parse(await fs.readFile(BLOB_META_FILE, 'utf8')); } catch { /* ignore */ }

let metaTimer = null;
function scheduleMetaSave() {
  if (metaTimer) return;
  metaTimer = setTimeout(async () => {
    metaTimer = null;
    try { await fs.writeFile(BLOB_META_FILE, JSON.stringify(blobMeta)); }
    catch (e) { console.error('[blob] 元数据持久化失败:', e.message); }
  }, 200);
  metaTimer.unref?.();
}

function safeKeyPath(key) {
  const p = path.resolve(BLOB_DIR, key);
  if (p !== BLOB_DIR && !p.startsWith(BLOB_DIR + path.sep)) return null;
  return p;
}

function toBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  if (typeof Blob !== 'undefined' && value instanceof Blob) return null; // 交由 writeBlob 异步处理
  return Buffer.from(String(value));
}

async function streamToBuffer(value) {
  if (value instanceof Blob) return Buffer.from(await value.arrayBuffer());
  if (typeof value?.getReader === 'function') {
    const chunks = [];
    for await (const c of value) chunks.push(Buffer.from(c));
    return Buffer.concat(chunks);
  }
  return toBuffer(value);
}

function mimeOf(key) {
  return blobMeta[key]?.contentType || guessMime(key) || 'application/octet-stream';
}

globalThis.__BLOG_BLOB__ = {
  async set(key, value, opts) {
    const file = safeKeyPath(key);
    if (!file) throw new Error('非法 Blob key');
    const buf = await streamToBuffer(value);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, buf);
    blobMeta[key] = {
      contentType: opts?.contentType || guessMime(key) || 'application/octet-stream',
      size: buf.length,
      uploadedAt: new Date().toISOString(),
    };
    scheduleMetaSave();
  },
  async get(key, { type = 'text' } = {}) {
    const file = safeKeyPath(key);
    if (!file) return null;
    let buf;
    try { buf = await fs.readFile(file); } catch { return null; }
    if (type === 'json') return JSON.parse(buf.toString('utf8'));
    if (type === 'arrayBuffer') return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    if (type === 'blob') return new Blob([buf], { type: mimeOf(key) });
    if (type === 'stream') return new Blob([buf], { type: mimeOf(key) }).stream();
    return buf.toString('utf8');
  },
  async getMetadata(key) {
    if (!blobMeta[key]) return null;
    return { contentType: mimeOf(key), cacheControl: 'max-age=0', etag: '', size: blobMeta[key].size };
  },
  async getWithHeaders(key) {
    const file = safeKeyPath(key);
    if (!file) return null;
    try { await fs.access(file); } catch { return null; }
    return { body: (await fs.readFile(file)).toString('utf8'), headers: { 'content-type': mimeOf(key) } };
  },
  async delete(key) {
    const file = safeKeyPath(key);
    if (file) await fs.rm(file, { force: true });
    delete blobMeta[key];
    scheduleMetaSave();
  },
  async list({ prefix = '', limit = 1000, cursor = '' } = {}) {
    const keys = Object.keys(blobMeta).filter((k) => k.startsWith(prefix)).sort();
    const start = cursor ? keys.indexOf(cursor) + 1 : 0;
    return { blobs: keys.slice(start, start + limit).map((key) => ({ key })), directories: [], truncated: start + limit < keys.length, cursor: null };
  },
  async createUploadUrl(key, opts) {
    return {
      url: `/__upload/${key}`,
      key,
      expiresAt: Math.floor(Date.now() / 1000) + (opts?.expireSeconds || 3600),
    };
  },
};

/* ---------------- 路由表 ---------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
  '.pdf': 'application/pdf', '.wasm': 'application/wasm', '.md': 'text/markdown; charset=utf-8',
};
const guessMime = (p) => MIME[path.extname(p).toLowerCase()];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function compileRoute(urlPath) {
  const segs = urlPath.split('/').filter(Boolean);
  const names = [];
  let rx = '^';
  let score = 0;
  for (const seg of segs) {
    const catchAll = /^\[\[(.+)\]\]$/.exec(seg);
    const dynamic = /^\[(.+)\]$/.exec(seg);
    if (catchAll) { names.push(catchAll[1]); rx += '(?:/(.*))?'; score -= 5; }
    else if (dynamic) { names.push(dynamic[1]); rx += '/([^/]+)'; score += 1; }
    else { rx += '/' + escapeRe(seg); score += 10; }
  }
  return { regex: new RegExp(rx + '/?$'), names, score };
}

async function walk(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const routes = [];
for (const file of await walk(FN_DIR)) {
  const rel = path.relative(FN_DIR, file).replace(/\\/g, '/');
  if (rel.startsWith('api/_lib/')) continue;
  const urlPath = ('/' + rel.replace(/\.js$/, '')).replace(/\/index$/, '') || '/';
  routes.push({ ...compileRoute(urlPath), file, urlPath });
}
routes.sort((a, b) => b.score - a.score || b.urlPath.length - a.urlPath.length);

const METHOD_HANDLERS = {
  GET: 'onRequestGet', POST: 'onRequestPost', PUT: 'onRequestPut',
  DELETE: 'onRequestDelete', PATCH: 'onRequestPatch', OPTIONS: 'onRequestOptions',
};

async function loadHandler(file, method) {
  const mod = await import(pathToFileURL(file).href);
  return mod[METHOD_HANDLERS[method]]
    || mod[METHOD_HANDLERS[method]?.replace('Get', 'get')]
    || (method === 'HEAD' ? (mod.onRequestGet || mod.onRequest) : null)
    || mod.onRequest
    || null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function handleFunction(route, params, req, res, body) {
  const method = req.method || 'GET';
  const handler = await loadHandler(route.file, method);
  if (!handler) {
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: `Method ${method} not allowed` }));
    return;
  }
  const headers = new Headers();
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    const k = req.rawHeaders[i];
    if (['connection', 'keep-alive', 'transfer-encoding', 'upgrade'].includes(k.toLowerCase())) continue;
    try { headers.append(k, req.rawHeaders[i + 1]); } catch { /* 忽略非法头 */ }
  }
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const request = new Request(`${proto}://${req.headers.host || `127.0.0.1:${PORT}`}${req.url}`, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : (body.length ? body : undefined),
  });
  const response = await handler({ request, env: process.env, params, waitUntil: () => {} });

  const outHeaders = {};
  const setCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')] : []);
  for (const [k, v] of response.headers.entries()) {
    if (k.toLowerCase() === 'set-cookie') continue;
    outHeaders[k] = v;
  }
  if (setCookies.length) outHeaders['set-cookie'] = setCookies;

  const buf = Buffer.from(await response.arrayBuffer());
  res.writeHead(response.status, outHeaders);
  res.end(method === 'HEAD' ? undefined : buf);
}

async function serveStatic(pathname, req, res) {
  let rel = pathname;
  try { rel = decodeURIComponent(pathname); } catch { /* 保留原值 */ }
  const candidate = path.resolve(OUT_DIR, '.' + (rel === '/' ? '/index.html' : rel));
  const pick = async (p) => {
    if (p !== OUT_DIR && !p.startsWith(OUT_DIR + path.sep)) return null;
    try {
      const st = await fs.stat(p);
      return st.isFile() ? p : null;
    } catch { return null; }
  };

  let file = await pick(candidate);
  if (!file) file = await pick(path.join(candidate, 'index.html'));
  if (!file) file = await pick(candidate + '.html');

  if (!file) {
    const notFound = path.join(OUT_DIR, '404.html');
    const html = existsSync(notFound) ? await fs.readFile(notFound) : Buffer.from('404 Not Found');
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(req.method === 'HEAD' ? undefined : html);
    return;
  }
  const body = await fs.readFile(file);
  res.writeHead(200, {
    'Content-Type': guessMime(file) || 'application/octet-stream',
    'Content-Length': body.length,
    'Cache-Control': file.includes(`${path.sep}_next${path.sep}`) ? 'public, max-age=3600' : 'no-cache',
  });
  res.end(req.method === 'HEAD' ? undefined : body);
}

const server = createServer(async (req, res) => {
  const start = Date.now();
  res.on('finish', () => console.log(`${req.method} ${req.url} -> ${res.statusCode} ${Date.now() - start}ms`));
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    if (pathname.startsWith('/__upload/') && req.method === 'PUT') {
      const key = decodeURIComponent(pathname.slice('/__upload/'.length)).replace(/\/+$/, '');
      const file = safeKeyPath(key);
      if (!file) { res.writeHead(400); res.end('bad key'); return; }
      const body = await readBody(req);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, body);
      blobMeta[key] = {
        contentType: req.headers['content-type'] || guessMime(key) || 'application/octet-stream',
        size: body.length,
        uploadedAt: new Date().toISOString(),
      };
      scheduleMetaSave();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    for (const route of routes) {
      const m = route.regex.exec(pathname);
      if (!m) continue;
      const params = {};
      route.names.forEach((name, i) => {
        let v = m[i + 1];
        if (v !== undefined) {
          v = v.replace(/\/+$/, '');
          try { v = decodeURIComponent(v); } catch { /* ignore */ }
        }
        params[name] = v;
      });
      const body = req.method === 'GET' || req.method === 'HEAD' ? Buffer.alloc(0) : await readBody(req);
      await handleFunction(route, params, req, res, body);
      return;
    }

    await serveStatic(pathname, req, res);
  } catch (err) {
    console.error('[local] 请求处理异常:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: err?.message || String(err) }));
    } else {
      res.end();
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[local] 博客已启动: http://127.0.0.1:${PORT}/  (函数路由 ${routes.length} 条)`);
  console.log(`[local] 数据目录: ${DATA_DIR}`);
});