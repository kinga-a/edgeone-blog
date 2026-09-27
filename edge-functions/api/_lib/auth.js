/**
 * 后台管理员鉴权：PBKDF2 密码哈希、会话 Cookie、路由守卫
 */
import { getKv, Keys, kvGetJson, kvPutJson } from './kv.js';
import { uid } from './ids.js';

export const SESSION_COOKIE = 'blog_admin';
const SESSION_TTL_MS = 7 * 24 * 3600 * 1000; // 7 天
const PBKDF2_ITERATIONS = 100000;

/** PBKDF2-SHA256 哈希密码，返回十六进制串 */
export async function hashPassword(password, salt, iterations = PBKDF2_ITERATIONS) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(String(password)),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** 从请求 Cookie 中解析会话 token */
export function readCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  for (const part of cookie.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k === name) return v;
  }
  return null;
}

/** 校验当前请求是否为已登录管理员，返回 {ok, username} */
export async function requireAdmin(request, env) {
  const kv = getKv(env);
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return { ok: false };
  const session = await kvGetJson(kv, Keys.session(token));
  if (!session || !session.expiresAt) return { ok: false };
  if (Date.now() > new Date(session.expiresAt).getTime()) {
    await kv.delete(Keys.session(token));
    return { ok: false };
  }
  return { ok: true, username: session.username, token };
}

/** 创建管理员会话并返回 Set-Cookie 头 */
export async function createSession(env, username) {
  const kv = getKv(env);
  const token = uid(32);
  const session = {
    username,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };
  await kvPutJson(kv, Keys.session(token), session);
  return {
    token,
    cookie: `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; Secure`,
  };
}

/** 登出：删除会话 */
export async function destroySession(request, env) {
  const kv = getKv(env);
  const token = readCookie(request, SESSION_COOKIE);
  if (token) await kv.delete(Keys.session(token));
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

/** 校验管理员账号密码 */
export async function verifyAdmin(env, username, password) {
  const kv = getKv(env);
  const admin = await kvGetJson(kv, Keys.authAdmin);
  if (!admin || !admin.salt || !admin.hash) return false;
  if (String(admin.username) !== String(username)) return false;
  const hash = await hashPassword(password, admin.salt, admin.iterations || PBKDF2_ITERATIONS);
  return hash === admin.hash;
}

/** 写入 / 更新管理员账号 */
export async function upsertAdmin(env, { username, password }) {
  const kv = getKv(env);
  const salt = uid(16);
  const hash = await hashPassword(password, salt);
  const existing = await kvGetJson(kv, Keys.authAdmin);
  await kvPutJson(kv, Keys.authAdmin, {
    username: String(username).trim(),
    salt,
    hash,
    iterations: PBKDF2_ITERATIONS,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

/** 是否存在管理员账号 */
export async function hasAdmin(env) {
  const kv = getKv(env);
  const admin = await kvGetJson(kv, Keys.authAdmin);
  return Boolean(admin && admin.username);
}

/** 读取管理员账号（含 TOTP 配置） */
export async function getAdmin(env) {
  const kv = getKv(env);
  return kvGetJson(kv, Keys.authAdmin);
}

/* ------------------------------------------------------------------ */
/* TOTP 二次验证（RFC 6238，基于 Web Crypto，无外部依赖）                */
/* ------------------------------------------------------------------ */

const TOTP_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += TOTP_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += TOTP_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '');
  const bytes = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    const idx = TOTP_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

/** 生成 20 字节随机密钥（Base32 无填充） */
export function generateTotpSecret() {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes).replace(/=+$/, '');
}

/** 生成 otpauth:// URI（供扫码 / 手动录入） */
export function totpUri(secret, account, issuer = 'EdgeOne Blog') {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&period=30&digits=6&algorithm=SHA1`;
}

async function hmacSha1(keyBytes, msgBytes) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, msgBytes);
  return new Uint8Array(sig);
}

/** 计算某一时刻的 6 位 TOTP 验证码 */
export async function totpCode(secret, at = Date.now()) {
  const keyBytes = base32Decode(secret);
  if (!keyBytes.length) return '';
  const counter = Math.floor(at / 1000 / 30);
  const msg = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    msg[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const hash = await hmacSha1(keyBytes, msg);
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    (hash[offset + 1] << 16) |
    (hash[offset + 2] << 8) |
    hash[offset + 3];
  return String(binary % 1000000).padStart(6, '0');
}

/** 校验 TOTP 验证码（允许 ±window 个 30 秒时间窗口漂移） */
export async function verifyTotp(secret, code, window = 1, at = Date.now()) {
  const target = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(target)) return false;
  for (let w = -window; w <= window; w++) {
    const c = await totpCode(secret, at + w * 30000);
    if (c === target) return true;
  }
  return false;
}
