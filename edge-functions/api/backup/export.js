import { fail } from '../_lib/response.js';
import { requireAdmin } from '../_lib/auth.js';
import { makeExportResponse } from '../_lib/backup.js';

/** GET /api/backup/export — 全量导出（管理员），返回 JSON 文件供下载 */
export async function onRequestGet({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  return makeExportResponse(env);
}

export const onRequest = onRequestGet;
