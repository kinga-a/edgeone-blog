import { json, fail } from '../_lib/response.js';
import { requireAdmin } from '../_lib/auth.js';
import { webdavPush } from '../_lib/backup.js';

/** POST /api/backup/webdav — 将全量备份推送到 WebDAV（管理员） */
export async function onRequestPost({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  try {
    return json(await webdavPush(env));
  } catch (e) {
    return fail(502, e.message || 'WebDAV 推送失败');
  }
}

export const onRequest = onRequestPost;
