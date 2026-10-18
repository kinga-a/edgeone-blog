/**
 * 运行时兼容测试：模拟不提供 WebCrypto 的老函数运行时（如容器 Node18-）。
 * 验证：1) 纯 JS 向量逐字节等于真实 SHA/PBKDF2；2) 无 crypto 时登录/setup 正常且
 * 与 WebCrypto 生成的哈希完全互认（换运行时不影响已有密码）；3) /mcp 在降级环境
 * 下完成真实 initialize/tools/call 往返（此前线上表现为 545 的路径）。
 * 运行：npm run test:compat
 */
import assert from 'node:assert/strict';

const realCrypto = globalThis.crypto;
const { pbkdf2Sync, createHash } = await import('node:crypto');
const te = new TextEncoder();
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.error(`  ✗ ${name}: ${e.message}`); }
}

/* ---------- 阶段 1：纯 JS 实现与真机对拍 ---------- */
console.log('\n[1/3] crypto-soft 对拍');
const cs = await import('../edge-functions/api/_lib/crypto-soft.js');
await test('sha256/sha1 标准向量', () => {
  assert.equal(cs.toHex(cs.sha256(te.encode('abc'))), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(cs.toHex(cs.sha1(te.encode('abc'))), createHash('sha1').update('abc').digest('hex'));
});
await test('pbkdf2 生产代价值 100000 与 node 一致', () => {
  const soft = cs.toHex(cs.pbkdf2Sha256('S3cr3t!pw', 'salt-abc', 100000, 32));
  const ref = pbkdf2Sync('S3cr3t!pw', 'salt-abc', 100000, 32, 'sha256').toString('hex');
  assert.equal(soft, ref);
});

/* ---------- 阶段 2：切换为「无 crypto」老运行时 ---------- */
console.log('\n[2/3] 无 WebCrypto 环境下：setup / login / 换模式互认');
globalThis.__BLOG_KV__ = (() => { const m = new Map(); return {
  put: async (k, v) => m.set(k, String(v)), get: async (k) => m.get(k) ?? null,
  delete: async (k) => m.delete(k), list: async () => ({ keys: [], complete: true }),
}; })();

// 先记录：用真实 WebCrypto 生成一份哈希（模拟"账号当年在正常运行时创建"）
const webExpected = pbkdf2Sync('kinga-passw0rd', 'salt-abc', 100000, 32, 'sha256').toString('hex');

// 摘除全局 crypto（模拟 node <19 / 极简 workerd）
Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
const { ensureCrypto } = await import('../edge-functions/api/_lib/crypto-polyfill.js');
ensureCrypto();

const auth = await import('../edge-functions/api/_lib/auth.js?nc=1');
assert.ok(!globalThis.crypto?.subtle, '应处于无 WebCrypto 状态（auth 顶层 polyfill 只补 getRandomValues/randomUUID）');

await test('upsertAdmin 在无 crypto 下不抛异常且与 WebCrypto 哈希一致', async () => {
  // monkey-patch hash 入口以固定 salt 场景不便，直接验证 hashPassword
  const h = await auth.hashPassword('kinga-passw0rd', 'salt-abc', 100000);
  assert.equal(h, webExpected, 'soft 哈希必须与 web 哈希逐字节一致');
});
await test('admin 账号创建 + 登录校验在无 crypto 环境走通', async () => {
  await auth.upsertAdmin({}, { username: 'king', password: 'Aa123456@*' });
  assert.equal(await auth.verifyAdmin({}, 'king', 'Aa123456@*'), true);
  assert.equal(await auth.verifyAdmin({}, 'king', 'wrong-pass'), false);
});
await test('恢复 WebCrypto 后，此前 soft 生成的哈希仍可登录（跨模式互认）', async () => {
  Object.defineProperty(globalThis, 'crypto', { value: realCrypto, configurable: true, writable: true });
  assert.equal(await auth.verifyAdmin({}, 'king', 'Aa123456@*'), true);
});

/* ---------- 阶段 3：无 crypto 环境下的 /mcp 真实协议往返 ---------- */
console.log('\n[3/3] 老运行时下 MCP 端点全链路');
// 重新置为无 crypto，并注入 MCP key（key 生成/存储均会走 soft sha256）
const adminReal = globalThis.crypto;
Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
await import('../edge-functions/api/_lib/crypto-polyfill.js?nc=1');
ensureCrypto();
const mcpAuth = await import('../edge-functions/api/_lib/mcp-auth.js?nc=1');
const { token } = await mcpAuth.createMcpKey({}, 'compat-test');
const mcp = await import('../edge-functions/mcp.js?nc=1');

const callPost = async (body, auth = `Bearer ${token}`) => {
  const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
  if (auth) headers.Authorization = auth;
  const req = new Request('https://compat.local/mcp', { method: 'POST', headers, body: JSON.stringify(body) });
  const res = await mcp.onRequestPost({ request: req, env: {}, params: {}, waitUntil: () => {} });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* SSE/错误页 */ }
  return { status: res.status, json, text };
};

await test('错误 key → 401 JSON（而非 545 的裸文本）', async () => {
  const r = await callPost({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'x', version: '1' } } }, 'Bearer eob_dead00000aaaa');
  assert.equal(r.status, 401);
});
await test('无 crypto 环境完成 initialize + tools/list（7 个工具）', async () => {
  const init = await callPost({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'compat', version: '1' } } });
  assert.equal(init.status, 200, `initialize got ${init.status}: ${init.text.slice(0, 120)}`);
  const list = await callPost({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  assert.equal(list.json?.result?.tools?.length, 7, 'tools/list: ' + list.text.slice(0, 120));
});
await test('tools/call blog_list_posts 在软哈希链路上工作', async () => {
  const r = await callPost({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'blog_list_posts', arguments: {} } });
  const payload = JSON.parse(r.json.result.content[0].text);
  assert.equal(payload.ok, true);
});
await test('Bearer 走 soft sha256 仍能与哈希后的 key 对上（MCP Key 跨运行时可迁移）', async () => {
  // 存库时是 soft sha256；切回真机 WebCrypto 后校验应依旧通过（digest 结果一致）
  Object.defineProperty(globalThis, 'crypto', { value: adminReal, configurable: true, writable: true });
  const r = await callPost({ jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} });
  assert.equal(r.json?.result?.tools?.length, 7);
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
});

console.log(`\n${failed ? `❌ ${failed} 项失败` : '✅ 兼容模式全部通过'}（${passed}/${passed + failed}）`);
process.exit(failed ? 1 : 0);
