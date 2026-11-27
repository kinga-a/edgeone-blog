import { json, fail } from '../_lib/response.js';
import { blobGetBinaryWithHeaders, blobDelete } from '../_lib/storage.js';
import { getMediaMeta, deleteMediaMeta } from '../_lib/data.js';
import { requireAdmin } from '../_lib/auth.js';

/** 可安全内联展示的图片 MIME；其外一律强制下载（阻断 SVG/HTML 型存储 XSS） */
const SAFE_INLINE = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/x-icon']);

/** catch-all 参数可能为字符串或数组；逐段规范化，拒绝 . / .. 与非法字符（防路径穿越） */
function resolveKey(params) {
  const raw = Array.isArray(params.key) ? params.key.join('/') : params.key || '';
  const parts = String(raw).split('/').filter(Boolean);
  if (!parts.length) return '';
  for (const p of parts) {
    if (p === '.' || p === '..' || !/^[A-Za-z0-9._-]{1,128}$/.test(p)) return '';
  }
  return parts.join('/');
}

/**
 * GET /api/media/:key — 媒体文件访问（公开，代理 Blob 原始字节）
 * 仅安全图片内联，其它类型强制 attachment + nosniff，避免可控 Content-Type 的存储型 XSS。
 * DELETE /api/media/:key — 删除媒体文件（管理员，uid 需与 key 对应）
 */
export async function onRequestGet({ request, env, params }) {
  const key = resolveKey(params);
  if (!key) return fail(400, '非法的文件 key');
  const result = await blobGetBinaryWithHeaders(key).catch(() => null);
  if (!result || result.body === null || result.body === undefined) return fail(404, '文件不存在');

  const ctype = String(result.contentType || 'application/octet-stream').split(';')[0].trim().toLowerCase();
  const inline = SAFE_INLINE.has(ctype);
  const headers = new Headers();
  headers.set('Content-Type', inline ? ctype : 'application/octet-stream');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="media"`);
  headers.set('Cache-Control', 'public, max-age=86400');
  return new Response(result.body, { headers });
}

export async function onRequestDelete({ request, env, params }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  const url = new URL(request.url);
  const uidParam = url.searchParams.get('uid');
  const key = resolveKey(params);
  if (!key) return fail(400, '非法的文件 key');
  if (uidParam) {
    const meta = await getMediaMeta(env, uidParam);
    if (!meta || meta.key !== key) return fail(400, 'uid 与文件 key 不匹配');
  }
  await blobDelete(key).catch(() => {});
  if (uidParam) await deleteMediaMeta(env, uidParam);
  return json({ ok: true });
}