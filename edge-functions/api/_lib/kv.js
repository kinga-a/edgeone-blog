/**
 * EdgeOne Pages KV 绑定访问层
 *
 * 在 EdgeOne Pages 控制台将 KV 命名空间绑定到本项目时，定义变量名 BLOG_KV（或 blog_kv）。
 * 运行时绑定以全局变量 / env 两种形态注入，这里统一兼容解析。
 * 注意：EdgeOne Pages KV 的 key 仅支持【数字、字母、下划线】，禁止使用冒号、斜杠等符号。
 */

const BINDING_NAMES = ['BLOG_KV', 'blog_kv'];

/**
 * 获取 KV 命名空间实例。
 * 本地测试时可通过 globalThis.__BLOG_KV__ 注入 mock。
 * @param {Record<string, any>} env onRequest context 中的 env
 * @returns {import('@edgeone/pages-blob').KVNamespace}
 */
export function getKv(env) {
  if (globalThis.__BLOG_KV__) return globalThis.__BLOG_KV__;
  for (const name of BINDING_NAMES) {
    if (env && env[name]) return env[name];
    if (globalThis && globalThis[name]) return globalThis[name];
  }
  throw new Error('未找到 KV 绑定 BLOG_KV：请在 EdgeOne Pages 控制台将 KV 命名空间绑定到项目并命名变量为 BLOG_KV');
}

/**
 * KV 键名生成（key 仅允许数字、字母、下划线）
 */
export const Keys = {
  configSite: 'config_site',
  metaInitialized: 'meta_initialized',
  post: (id) => `post_${id}`,
  postList: 'post_list',
  category: (id) => `category_${id}`,
  categoryList: 'category_list',
  tag: (id) => `tag_${id}`,
  tagList: 'tag_list',
  comment: (postId, id) => `comment_${postId}_${id}`,
  commentList: 'comment_list',
  media: (uid) => `media_${uid}`,
  authAdmin: 'auth_admin',
  session: (token) => `auth_session_${token}`,
  statsVisit: 'stats_visit',
  statsView: (postId) => `stats_view_${postId}`,
  statsLike: (postId) => `stats_like_${postId}`,
  // 速率限制：IP 内仅含数字字母下划线（EdgeOne KV key 限制）
  rateLimit: (scope, ip) => `rate_${scope}_${String(ip).replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 48)}`,
};

/** 读取 JSON 值，不存在返回 null */
export async function kvGetJson(kv, key) {
  const raw = await kv.get(key);
  if (raw === null || raw === undefined || raw === '') return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

/** 写入 JSON 值 */
export async function kvPutJson(kv, key, value) {
  await kv.put(key, JSON.stringify(value));
}

/** 读取字符串值，不存在返回 null */
export async function kvGetString(kv, key) {
  const raw = await kv.get(key);
  return raw === null || raw === undefined ? null : String(raw);
}

/** 数字计数器：原子自增（读取-修改-写回，最终一致可接受） */
export async function kvIncr(kv, key, step = 1) {
  const raw = await kv.get(key);
  let n = raw === null || raw === undefined ? 0 : Number(raw);
  if (Number.isNaN(n)) n = 0;
  n += step;
  await kv.put(key, String(n));
  return n;
}

/** 遍历某前缀下的所有 key（自动翻页；兼容 complete / list_complete / cursor 空串终止信号） */
export async function kvListKeys(kv, prefix, limit = 256) {
  const keys = [];
  let cursor;
  let pages = 0;
  do {
    const res = await kv.list({ prefix, limit: 256, ...(cursor ? { cursor } : {}) });
    for (const k of res.keys) keys.push(k.key);
    const done = res.complete === true || res.list_complete === true || !res.cursor || res.cursor === '';
    cursor = done ? null : res.cursor;
    pages += 1;
    if (pages >= 200) break;
  } while (cursor);
  return keys;
}

/** 速率限制（固定窗口）：计数并检查是否超限。超限返回 { ok:false, waitSec } */
export async function rateLimitHit(kv, key, limit, windowMs) {
  const rec = await kvGetJson(kv, key);
  const now = Date.now();
  const fresh = !rec || typeof rec.count !== 'number' || now - (rec.at || 0) > windowMs;
  const at = fresh ? now : rec.at;
  const count = fresh ? 1 : rec.count + 1;
  await kvPutJson(kv, key, { count, at });
  if (count > limit) {
    return { ok: false, waitSec: Math.max(1, Math.ceil((windowMs - (now - at)) / 1000)) };
  }
  return { ok: true };
}
