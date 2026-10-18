/**
 * MCP API Key 鉴权：为 MCP 端点提供 Bearer Token 通道（独立于后台 Cookie 会话）。
 *
 * 存储模型（KV key: auth_mcp_keys，仅存 token 的 SHA-256 哈希，明文只在创建时返回一次）：
 *   { version: 1, keys: [{ id, label, hash, prefix, createdAt, lastUsedAt }] }
 *
 * 安全设计：
 * - token 格式 eob_<64位hex>，服务端只比对哈希，KV 数据泄露不等于 key 泄露
 * - 校验失败按 IP 限速（15 分钟窗口最多 10 次），防爆破
 * - lastUsedAt 记录（>1 小时才回写，避免每次调用都产生 KV 写）
 */
import './crypto-polyfill.js';
import { getKv, Keys, kvGetJson, kvPutJson, rateLimitHit } from './kv.js';
import { sha256 as softSha256, toHex } from './crypto-soft.js';
import { uid, nowIso } from './ids.js';
import { clientIp } from './auth.js';

export const MCP_KEYS_KV_KEY = 'auth_mcp_keys';
export const MCP_TOKEN_PREFIX = 'eob_';

const MCP_FAIL_LIMIT = 10;
const MCP_FAIL_WINDOW_MS = 15 * 60 * 1000;
const TOKEN_RE = /^eob_[0-9a-f]{64}$/;

/** SHA-256 -> hex（WebCrypto 优先，缺失/不支持时降级纯 JS） */
async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  if (typeof crypto?.subtle?.digest === 'function') {
    try {
      const digest = await crypto.subtle.digest('SHA-256', data);
      return toHex(new Uint8Array(digest));
    } catch { /* 降级 */ }
  }
  return toHex(softSha256(data));
}

/** 读取 key 列表（内部存储结构） */
async function readKeyStore(env) {
  const kv = getKv(env);
  const store = await kvGetJson(kv, MCP_KEYS_KV_KEY);
  if (!store || !Array.isArray(store.keys)) return { version: 1, keys: [] };
  return store;
}

async function writeKeyStore(env, store) {
  const kv = getKv(env);
  await kvPutJson(kv, MCP_KEYS_KV_KEY, store);
}

/** 列出全部 API Key（不含哈希） */
export async function listMcpKeys(env) {
  const store = await readKeyStore(env);
  return store.keys.map(({ hash, ...pub }) => pub);
}

/** 创建一个 API Key，返回 { token（明文，仅此一次）, id, label, prefix } */
export async function createMcpKey(env, label) {
  const store = await readKeyStore(env);
  const token = MCP_TOKEN_PREFIX + uid(32);
  const record = {
    id: uid(8),
    label: String(label || 'MCP Key').trim().slice(0, 64) || 'MCP Key',
    hash: await sha256Hex(token),
    prefix: token.slice(0, 12),
    createdAt: nowIso(),
    lastUsedAt: '',
  };
  await writeKeyStore(env, { ...store, keys: [...store.keys, record] });
  return { token, ...record, hash: undefined };
}

/** 吊销一个 API Key，返回是否命中 */
export async function revokeMcpKey(env, id) {
  const store = await readKeyStore(env);
  const remaining = store.keys.filter((k) => k.id !== id);
  if (remaining.length === store.keys.length) return false;
  await writeKeyStore(env, { ...store, keys: remaining });
  return true;
}

/**
 * 校验请求头 Authorization: Bearer <token>。
 * 返回 { ok: true, key } 或 { ok: false, status: 401, message }
 */
export async function verifyMcpBearer(request, env) {
  const kv = getKv(env);
  const failKey = Keys.rateLimit('mcp', clientIp(request));

  // 先做失败限速（只统计失败次数，成功调用不计数）
  const rec = await kvGetJson(kv, failKey);
  if (rec && typeof rec.count === 'number' && rec.count >= MCP_FAIL_LIMIT) {
    const elapsed = Date.now() - (rec.at || 0);
    if (elapsed <= MCP_FAIL_WINDOW_MS) {
      return { ok: false, status: 429, message: `MCP 鉴权失败次数过多，请 ${Math.ceil((MCP_FAIL_WINDOW_MS - elapsed) / 1000)} 秒后重试` };
    }
    await kv.delete(failKey);
  }

  const auth = String(request.headers.get('Authorization') || '');
  const match = auth.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    await failAndCount(kv, failKey);
    return { ok: false, status: 401, message: '缺少 Authorization: Bearer <API Key>' };
  }
  const token = match[1];
  if (!TOKEN_RE.test(token)) {
    await failAndCount(kv, failKey);
    return { ok: false, status: 401, message: 'API Key 格式无效' };
  }

  const store = await readKeyStore(env);
  const hash = await sha256Hex(token);
  const key = store.keys.find((k) => k.hash === hash);
  if (!key) {
    await failAndCount(kv, failKey);
    return { ok: false, status: 401, message: 'API Key 无效或已被吊销' };
  }

  // 成功：清除失败计数，必要时更新 lastUsedAt
  await kv.delete(failKey);
  if (!key.lastUsedAt || Date.now() - new Date(key.lastUsedAt).getTime() > 3600_000) {
    key.lastUsedAt = nowIso();
    await writeKeyStore(env, store);
  }
  return { ok: true, key };
}

async function failAndCount(kv, failKey) {
  await rateLimitHit(kv, failKey, MCP_FAIL_LIMIT, MCP_FAIL_WINDOW_MS);
}
