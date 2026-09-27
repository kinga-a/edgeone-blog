import { json, fail, parseSearchParams } from '../_lib/response.js';
import { listMedia } from '../_lib/data.js';
import { requireAdmin } from '../_lib/auth.js';
import { intParam } from '../_lib/response.js';

/** GET /api/media — 媒体文件列表（管理员，分页） */
export async function onRequestGet({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  const params = parseSearchParams(request.url);
  const type = params.type || '';
  const page = intParam(params.page, 1);
  const pageSize = Math.min(intParam(params.pageSize, 30), 100);

  let list = await listMedia(env);
  if (type) list = list.filter((m) => m.type === type);
  const total = list.length;
  const start = (page - 1) * pageSize;
  const items = list.slice(start, start + pageSize);
  return json({ ok: true, items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}

export const onRequest = onRequestGet;
