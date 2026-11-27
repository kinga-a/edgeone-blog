import { json, fail, readJson, publicHeaders, publicCacheHeaders } from '../_lib/response.js';
import { getSiteConfig, saveSiteConfig } from '../_lib/data.js';
import { requireAdmin } from '../_lib/auth.js';

/** 允许通过 PUT 写入的站点配置字段（白名单，防批量赋值写敏感字段） */
const CONFIG_FIELDS = new Set([
  'title', 'subtitle', 'description', 'keywords', 'author', 'about', 'footerText', 'icp', 'heroQuote',
  'language', 'siteUrl', 'perPage', 'commentEnabled', 'commentModeration', 'faviconUrl',
  'featuredPostIds', 'featuredLayout', 'seo', 'social', 'backup',
]);
const BACKUP_FIELDS = ['webdavUrl', 'webdavUsername', 'webdavPassword', 'webdavPath'];
const SEO_FIELDS = ['ogImage', 'twitterHandle', 'googleSiteVerification'];
const SOCIAL_FIELDS = ['github', 'twitter', 'wechat', 'email'];
const ICP_FIELDS = ['enabled', 'number'];
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** 仅取白名单子字段，阻断原型污染与任意属性注入 */
function pickObject(obj, fields) {
  const out = {};
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
  for (const f of fields) {
    if (obj[f] !== undefined && obj[f] !== null) out[f] = obj[f];
  }
  return out;
}

/** GET /api/config — 站点配置；匿名仅返回公开展示字段，完全剔除备份等运维配置 */
export async function onRequestGet({ request, env }) {
  const admin = await requireAdmin(request, env).catch(() => ({ ok: false }));
  const config = await getSiteConfig(env);
  if (!admin.ok) {
    const { backup, ...pub } = config;
    return json({ ok: true, config: pub }, { headers: publicCacheHeaders() });
  }
  return json({ ok: true, config }, { headers: publicHeaders() });
}

/** PUT /api/config — 更新站点配置（管理员，字段白名单 + 原型键过滤） */
export async function onRequestPut({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  const body = await readJson(request);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(400, '请求体无效');

  const patch = {};
  for (const [k, v] of Object.entries(body)) {
    if (DANGEROUS_KEYS.has(k) || !CONFIG_FIELDS.has(k)) continue;
    if (k === 'backup') patch.backup = pickObject(v, BACKUP_FIELDS);
    else if (k === 'seo') patch.seo = pickObject(v, SEO_FIELDS);
    else if (k === 'social') patch.social = pickObject(v, SOCIAL_FIELDS);
    else if (k === 'icp') patch.icp = pickObject(v, ICP_FIELDS);
    else patch[k] = v;
  }
  if (!Object.keys(patch).length) return fail(400, '没有可更新的配置字段');

  const config = await saveSiteConfig(env, patch);
  return json({ ok: true, config });
}