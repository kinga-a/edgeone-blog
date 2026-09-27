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
