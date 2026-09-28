import { json, fail } from '../_lib/response.js';
import { blobGetBinaryWithHeaders, blobDelete } from '../_lib/storage.js';
import { getMediaMeta, deleteMediaMeta } from '../_lib/data.js';
import { requireAdmin } from '../_lib/auth.js';

/** catch-all 参数可能为字符串或数组，统一为斜杠拼接的 key */
function resolveKey(params) {
  if (Array.isArray(params.key)) return params.key.join('/');
  return params.key || '';
}

/**
 * GET /api/media/:key — 媒体文件访问（公开，代理 Blob 原始字节，附缓存头）
 * DELETE /api/media/:key — 删除媒体文件（管理员，需携带 uid 参数）
 */
export async function onRequestGet({ request, env, params }) {
  const key = resolveKey(params);
  if (!key) return fail(400, '缺少文件 key');
  const result = await blobGetBinaryWithHeaders(key).catch(() => null);
  if (!result || result.body === null || result.body === undefined) return fail(404, '文件不存在');

  const headers = new Headers();
  headers.set('Content-Type', result.contentType);
  headers.set('Cache-Control', 'public, max-age=86400');
  headers.set('Access-Control-Allow-Origin', '*');
  return new Response(result.body, { headers });
}

export async function onRequestDelete({ request, env, params }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  const url = new URL(request.url);
  const uidParam = url.searchParams.get('uid');
  const key = resolveKey(params);
  if (!key) return fail(400, '缺少文件 key');
  await blobDelete(key).catch(() => {});
  if (uidParam) await deleteMediaMeta(env, uidParam);
  return json({ ok: true });
}
