import { json, fail, readJson } from '../_lib/response.js';
import { buildMediaKey, blobCreateUploadUrl } from '../_lib/storage.js';
import { saveMediaMeta } from '../_lib/data.js';
import { requireAdmin } from '../_lib/auth.js';
import { uid, nowIso } from '../_lib/ids.js';

/** 单文件大小上限（配合预签名上传的声明式校验） */
const MAX_SIZE = 20 * 1024 * 1024;

/** 允许的扩展名 → 强制 Content-Type（不信任客户端传入，拒绝 svg/html/js 等可执行内容） */
const EXT_TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon',
  pdf: 'application/pdf', zip: 'application/zip', mp4: 'video/mp4', mp3: 'audio/mpeg',
  md: 'text/markdown', txt: 'text/plain',
};
const ALLOWED_EXT = new Set(Object.keys(EXT_TYPES));

/**
 * POST /api/media/upload-url — 生成浏览器直传预签名 URL（管理员）
 * 请求：{ name, type: 'cover'|'image'|'attachment', size?: number }
 * 返回：{ url, key, uid, expiresAt }
 */
export async function onRequestPost({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  const body = await readJson(request);
  if (!body) return fail(400, '请求体无效');

  const name = String(body.name || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 200);
  if (!name) return fail(400, '缺少文件名');
  const dotIdx = name.lastIndexOf('.');
  const ext = (dotIdx >= 0 ? name.slice(dotIdx + 1) : '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!ALLOWED_EXT.has(ext)) {
    return fail(400, `不支持的文件类型：.${ext || '未知'}（仅允许 ${[...ALLOWED_EXT].join(' / ')}）`);
  }
  const type = ['cover', 'image', 'attachment'].includes(body.type) ? body.type : 'image';
  const size = Number(body.size);
  if (Number.isFinite(size) && size > MAX_SIZE) return fail(413, '文件过大（上限 20MB）');

  const fileUid = uid(16);
  const key = buildMediaKey(type, fileUid, ext);
  const contentType = EXT_TYPES[ext];

  const { url, key: signedKey, expiresAt } = await blobCreateUploadUrl(key, {
    expireSeconds: 3600,
    contentType,
  });

  await saveMediaMeta(env, {
    uid: fileUid,
    key,
    name,
    type,
    ext,
    contentType,
    size: Number.isFinite(size) ? size : 0,
    uploadedAt: nowIso(),
    uploadedBy: admin.username,
  });

  return json({ ok: true, url, key: signedKey, uid: fileUid, expiresAt });
}