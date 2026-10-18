/**
 * MCP 端点端到端冒烟测试：
 *   内存 KV mock + 极简 fetch/JSON-RPC 客户端（不依赖 @modelcontextprotocol/sdk）
 *   通过 Streamable HTTP 真实连到本地桥接的 edge-functions/mcp.js，
 *   完整走通「建 Key → 建文 → 发布 → 搜索 → 删除」链路，
 *   并验证鉴权负路径（无头 / 错 token / GET / OPTIONS）。
 * 运行：npm run test:mcp
 */
import assert from 'node:assert/strict';
import http from 'node:http';

/* ---------------- 内存 KV mock（与 smoke-functions.mjs 一致） ---------------- */

globalThis.__BLOG_KV__ = (() => {
  const map = new Map();
  return {
    async put(key, value) { map.set(key, String(value)); },
    async get(key) { const v = map.get(key); return v === undefined ? null : v; },
    async delete(key) { map.delete(key); },
    async list({ prefix = '', limit = 256, cursor = '' } = {}) {
      const keys = [...map.keys()].filter((k) => k.startsWith(prefix)).sort();
      const start = cursor ? keys.indexOf(cursor) + 1 : 0;
      const slice = keys.slice(start, start + limit);
      const complete = start + limit >= keys.length;
      return { complete, cursor: complete ? null : slice[slice.length - 1] ?? null, keys: slice.map((key) => ({ key })) };
    },
  };
})();

/* ---------------- 直调 handler 的小工具 ---------------- */

async function callApi(file, method, url, { body, cookie, params = {} } = {}) {
  const mod = await import(new URL(`../edge-functions/${file}`, import.meta.url).href);
  const handler = mod[`onRequest${method === 'GET' ? 'Get' : method === 'POST' ? 'Post' : 'Delete'}`] || mod.onRequest;
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body) headers['Content-Type'] = 'application/json';
  const request = new Request(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return handler({ request, env: {}, params, waitUntil: () => {} });
}
const parse = async (res) => JSON.parse(await res.text());

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.error(`  ✗ ${name}: ${e.message}`); }
}

/* ---------------- 本地 HTTP 桥：把 /mcp 请求喂给 edge function ---------------- */

const mcp = await import(new URL('../edge-functions/mcp.js', import.meta.url).href);
const bridge = http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const bodyBuf = chunks.length ? Buffer.concat(chunks) : undefined;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) v.forEach((x) => headers.append(k, x)); else headers.set(k, v);
    }
    const request = new Request(`http://127.0.0.1${req.url}`, {
      method: req.method,
      headers,
      body: bodyBuf && req.method !== 'GET' && req.method !== 'HEAD' ? bodyBuf : undefined,
    });
    const ctx = { request, env: {}, params: {}, waitUntil: () => {} };
    const out =
      req.method === 'POST' ? await mcp.onRequestPost(ctx) :
      req.method === 'OPTIONS' ? await mcp.onRequestOptions(ctx) :
      req.method === 'DELETE' ? await mcp.onRequestDelete(ctx) :
      await mcp.onRequestGet(ctx);
    res.writeHead(out.status, Object.fromEntries(out.headers.entries()));
    res.end(Buffer.from(await out.arrayBuffer()));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ bridgeError: e.message }));
  }
});
await new Promise((r) => bridge.listen(0, '127.0.0.1', r));
const port = bridge.address().port;
const MCP_URL = `http://127.0.0.1:${port}/mcp`;

/* ================= 1. 管理员走 REST 创建 MCP Key ================= */
console.log('\n[1/5] Key 管理链路（Cookie 管理员鉴权）');
let adminCookie = '';
let mcpToken = '';
await test('初始化管理员并登录', async () => {
  await callApi('api/auth/setup.js', 'POST', 'https://t.local/api/auth/setup', { body: { username: 'admin', password: 'password123' } });
  const r = await callApi('api/auth/login.js', 'POST', 'https://t.local/api/auth/login', { body: { username: 'admin', password: 'password123' } });
  adminCookie = r.headers.get('Set-Cookie').split(';')[0];
});
await test('未登录不能创建 Key', async () => {
  const r = await callApi('api/mcp-keys/index.js', 'POST', 'https://t.local/api/mcp-keys', { body: { label: 'openclaw' } });
  assert.equal(r.status, 401);
});
await test('管理员创建 Key 拿到 eob_ 明文', async () => {
  const r = await callApi('api/mcp-keys/index.js', 'POST', 'https://t.local/api/mcp-keys', { body: { label: 'openclaw' }, cookie: adminCookie });
  const d = await parse(r);
  assert.equal(r.status, 201);
  assert.match(d.token, /^eob_[0-9a-f]{64}$/);
  mcpToken = d.token;
  assert.equal(d.key.hash, undefined, '响应不应包含哈希');
});
await test('Key 列表可见但不含 token/哈希', async () => {
  const d = await parse(await callApi('api/mcp-keys/index.js', 'GET', 'https://t.local/api/mcp-keys', { cookie: adminCookie }));
  assert.equal(d.items.length, 1);
  assert.equal(d.items[0].label, 'openclaw');
  assert.ok(!('token' in d.items[0]) && !('hash' in d.items[0]));
});
await test('预置一个分类供工具引用', async () => {
  const d = await parse(await callApi('api/categories/index.js', 'POST', 'https://t.local/api/categories', { body: { name: 'MCP测试类目' }, cookie: adminCookie }));
  assert.equal(d.ok, true);
});

/* ================= 2. MCP 鉴权负路径 ================= */
console.log('\n[2/5] MCP 鉴权与 HTTP 方法');
await test('无 Authorization 的 POST 返回 401', async () => {
  const r = await fetch(MCP_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) });
  assert.equal(r.status, 401);
});
await test('错误 token 返回 401', async () => {
  const r = await fetch(MCP_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: '***'.padEnd(68) } });
  assert.match(r.headers.get('WWW-Authenticate') || '', /Bearer/);
});
await test('GET /mcp 返回 405 并带 Allow', async () => {
  const r = await fetch(MCP_URL);
  assert.equal(r.status, 405);
  assert.match(r.headers.get('Allow') || '', /POST/);
});
await test('OPTIONS 预检放行 Authorization 头', async () => {
  const r = await fetch(MCP_URL, { method: 'OPTIONS' });
  assert.equal(r.status, 204);
  assert.match(r.headers.get('Access-Control-Allow-Headers'), /Authorization/);
});

/* ================= 3. MCP 客户端连接与工具枚举 ================= */
console.log('\n[3/5] MCP 握手（极简 JSON-RPC 客户端 / Streamable HTTP）');

/** 极简 MCP Streamable HTTP 客户端：initialize → notifications/initialized → tools/* */
class MiniMcpClient {
  constructor(url, headers) {
    this.url = url;
    this.headers = headers || {};
    this.nextId = 1;
  }
  async _post(method, params) {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.headers },
      body: JSON.stringify({ jsonrpc: '2.0', id: this.nextId++, method, ...(params !== undefined ? { params } : {}) }),
    });
    if (res.status === 202) return undefined; // 通知类响应
    if (res.status !== 200) {
      throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = await res.json();
    if (data.error) throw new Error(`${data.error.message} (code ${data.error.code})`);
    return data.result;
  }
  async connect() {
    await this._post('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'smoke-mcp', version: '1.0.0' } });
    await this._post('notifications/initialized', {});
  }
  async listTools() {
    const r = await this._post('tools/list', {});
    return { tools: r.tools };
  }
  async callTool({ name, arguments: args }) {
    return this._post('tools/call', { name, arguments: args });
  }
  async close() {}
}

const client = new MiniMcpClient(MCP_URL, { Authorization: `Bearer ${mcpToken}` });
await client.connect();
await test('initialize 成功且 tools/list 返回 10 个工具', async () => {
  const { tools } = await client.listTools();
  assert.equal(tools.length, 10);
  assert.ok(tools.every((t) => t.name.startsWith('blog_')));
});
const callTool = async (name, args) => {
  const res = await client.callTool({ name, arguments: args });
  const payload = JSON.parse(res.content[0].text);
  return { ...payload, __isError: !!res.isError };
};

/* ================= 4. CRUD 主链路 ================= */
console.log('\n[4/5] 文章 CRUD 主链路');
let post;
await test('创建草稿（自动建标签、引用现有分类）', async () => {
  const d = await callTool('blog_create_post', {
    title: 'MCP 冒烟文章', content: '# 初稿\n\n关键词占位',
    categoryName: 'MCP测试类目', tags: ['mcp-冒烟', 'EdgeOne Pages'], status: 'draft',
  });
  assert.equal(d.ok, true);
  post = d.created;
  assert.equal(post.status, 'draft');
  assert.equal(post.publicPath, null);
});
await test('不存在的分类报错并提示现有分类', async () => {
  const d = await callTool('blog_create_post', { title: '坏分类', categoryName: '不存在的类目' });
  assert.equal(d.__isError, true);
  assert.match(d.error, /MCP测试类目/);
});
await test('草稿不出现在前台 GET /api/posts（权限边界与 REST 一致）', async () => {
  const d = await parse(await callApi('api/posts/index.js', 'GET', 'https://t.local/api/posts'));
  assert.equal(d.total, 0);
});
await test('更新并发布（status/content 补丁合并）', async () => {
  const d = await callTool('blog_update_post', { idOrSlug: post.slug, status: 'published', content: '# 发布版\n\n内含 zebra-XQ-42 这个词' });
  assert.equal(d.ok, true);
  assert.equal(d.updated.publicPath, `/posts/${post.slug}/`);
});
await test('get 拿完整正文与分类标签详情', async () => {
  const d = await callTool('blog_get_post', { idOrSlug: post.id });
  assert.match(d.post.content, /zebra-XQ-42/);
  assert.equal(d.post.category.name, 'MCP测试类目');
  assert.equal(d.post.tagDetails.length, 2);
});
await test('正文级全文搜索命中', async () => {
  const d = await callTool('blog_search_posts', { q: 'zebra-XQ-42' });
  assert.equal(d.total, 1);
  assert.equal(d.items[0].id, post.id);
});
await test('列表工具按分类筛选', async () => {
  const d = await callTool('blog_list_posts', { categoryName: 'MCP测试类目', status: 'published' });
  assert.equal(d.total, 1);
  assert.equal(d.items[0].categoryName, 'MCP测试类目');
});
await test('taxonomy 列出分类与自动创建的标签', async () => {
  const d = await callTool('blog_list_taxonomy', {});
  assert.ok(d.categories.some((c) => c.name === 'MCP测试类目'));
  assert.ok(d.tags.some((t) => t.name === 'mcp-冒烟'));
});
await test('删除的 confirmTitle 二次确认生效', async () => {
  const bad = await callTool('blog_delete_post', { idOrSlug: post.id, confirmTitle: '错误标题' });
  assert.equal(bad.__isError, true);
  const ok = await callTool('blog_delete_post', { idOrSlug: post.id, confirmTitle: 'MCP 冒烟文章' });
  assert.equal(ok.ok, true);
  assert.equal(ok.deleted.id, post.id);
});
await test('删除后进入回收站：默认列表不含、status=trash 可见、get 带 deletedAt', async () => {
  const d = await callTool('blog_get_post', { idOrSlug: post.id });
  assert.equal(d.__isError, false);
  assert.equal(!!d.post.deletedAt, true);
  assert.equal((await callTool('blog_list_posts', {})).total, 0);
  const trash = await callTool('blog_list_posts', { status: 'trash' });
  assert.equal(trash.total, 1);
});

/* ================= 5. 吊销 Key 后即时失效 ================= */
console.log('\n[5/5] 吊销');
await test('吊销后 token 立即 401', async () => {
  const list = await parse(await callApi('api/mcp-keys/index.js', 'GET', 'https://t.local/api/mcp-keys', { cookie: adminCookie }));
  const r = await callApi('api/mcp-keys/[id].js', 'DELETE', `https://t.local/api/mcp-keys/${list.items[0].id}`, { cookie: adminCookie, params: { id: list.items[0].id } });
  assert.equal(r.status, 200);
  const probe = await fetch(MCP_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mcpToken}` }, body: '{}' });
  assert.equal(probe.status, 401);
});

await client.close().catch(() => {});
bridge.close();
console.log(`\n${failed ? `❌ ${failed} 项失败` : '✅ 全部通过'}（${passed}/${passed + failed}）`);
process.exit(failed ? 1 : 0);
