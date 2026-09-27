import { json, fail, readJson, publicHeaders } from '../_lib/response.js';
import { getSiteConfig, saveSiteConfig } from '../_lib/data.js';
import { requireAdmin } from '../_lib/auth.js';

/** GET /api/config — 公开站点配置（未登录时隐藏备份配置中的密码） */
export async function onRequestGet({ request, env }) {
  const admin = await requireAdmin(request, env).catch(() => ({ ok: false }));
  const config = await getSiteConfig(env);
  if (!admin.ok && config.backup) {
    config.backup = { ...config.backup, webdavPassword: '' };
  }
  return json({ ok: true, config }, { headers: publicHeaders() });
}

/** PUT /api/config — 更新站点配置（管理员） */
export async function onRequestPut({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  const body = await readJson(request);
  if (!body) return fail(400, '请求体无效');
  const config = await saveSiteConfig(env, body);
  return json({ ok: true, config });
}
