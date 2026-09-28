import { json, fail } from '../_lib/response.js';
import { requireAdmin } from '../_lib/auth.js';
import { restoreFromWebdav } from '../_lib/backup.js';

/**
 * POST /api/backup/restore-webdav — 从 WebDAV 拉取备份并恢复 KV 数据（管理员）
 * 使用站点设置中已保存的 WebDAV 地址 / 用户名 / 密码。
 * 合并式恢复：同键覆盖，备份中不存在的键保持不变；跳过会话键。
 */
export async function onRequestPost({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  try {
    return json(await restoreFromWebdav(env));
  } catch (e) {
    return fail(400, e.message || '恢复失败');
  }
}

export const onRequest = onRequestPost;
