import { json, fail, readJson } from '../_lib/response.js';
import { buildMediaKey, blobCreateUploadUrl } from '../_lib/storage.js';
import { saveMediaMeta } from '../_lib/data.js';
import { requireAdmin } from '../_lib/auth.js';
import { uid, nowIso } from '../_lib/ids.js';

/**
 * POST /api/media/upload-url — 生成浏览器直传预签名 URL（管理员）
 * 请求：{ name: 文件名, type: 'cover' | 'image' | 'attachment', contentType?: string }
 * 返回：{ url, key, uid, expiresAt }，浏览器 PUT 直传 Blob，之后调用方保存引用。
 */
export async function onRequestPost({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  const body = await readJson(request);
  if (!body) return fail(400, '请求体无效');
  const name = String(body.name || '').trim();
  if (!name) return fail(400, '缺少文件名');
  const type = ['cover', 'image', 'attachment'].includes(body.type) ? body.type : 'image';

  const fileUid = uid(16);
  const dotIdx = name.lastIndexOf('.');
  const ext = dotIdx >= 0 ? name.slice(dotIdx + 1) : 'bin';
  const key = buildMediaKey(type, fileUid, ext);
  const contentType = body.contentType || guessContentType(ext);

  const { url, key: signedKey, expiresAt } = await blobCreateUploadUrl(key, {
    expireSeconds: 3600,
    contentType,
  });

  // 记录媒体元数据（上传完成后可再次确认文件存在）
  await saveMediaMeta(env, {
    uid: fileUid,
    key,
    name,
    type,
    ext,
    contentType,
    size: 0,
    uploadedAt: nowIso(),
    uploadedBy: admin.username,
  });

  return json({ ok: true, url, key: signedKey, uid: fileUid, expiresAt });
}

function guessContentType(ext) {
  const map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', ico: 'image/x-icon',
    pdf: 'application/pdf', zip: 'application/zip', mp4: 'video/mp4', mp3: 'audio/mpeg',
    md: 'text/markdown', txt: 'text/plain', json: 'application/json',
  };
  return map[ext] || 'application/octet-stream';
}
