/**
 * EdgeOne Pages Blob 存储访问层
 *
 * Blob 存储站点媒体文件：文章封面 covers/、正文图片 images/、附件 attachments/。
 * 使用官方 SDK @edgeone/pages-blob，在 Pages Functions 内零配置。
 * 本地测试时可通过 globalThis.__BLOG_BLOB__ 注入 mock。
 */
import { getStore } from '@edgeone/pages-blob';

export const BLOB_STORE_NAME = 'blog-media';

let _store;

function store() {
  if (globalThis.__BLOG_BLOB__) return globalThis.__BLOG_BLOB__;
  if (!_store) _store = getStore(BLOB_STORE_NAME);
  return _store;
}

/** 写入二进制 / 字符串对象 */
export async function blobSet(key, value, options) {
  await store().set(key, value, options);
}

/** 读取对象（text / json / arrayBuffer / blob / stream） */
export async function blobGet(key, options) {
  return store().get(key, options);
}

/** 读取对象并附带响应头（用于代理媒体文件时回传 Content-Type 等）
 * 默认使用 strong 一致性（绕过边缘缓存域直读源站），
 * 避免刚上传的文件因最终一致性在短时间窗口内读不到。 */
export async function blobGetWithHeaders(key, options) {
  return store().getWithHeaders(key, { consistency: 'strong', ...(options || {}) });
}

/** 删除对象 */
export async function blobDelete(key) {
  await store().delete(key);
}

/** 列出对象 */
export async function blobList(options) {
  return store().list(options);
}

/**
 * 生成浏览器直传的预签名 PUT URL（大文件上传不经过函数）
 * @returns {Promise<{url:string, key:string, expiresAt:number}>}
 */
export async function blobCreateUploadUrl(key, options) {
  return store().createUploadUrl(key, options);
}

/** 生成媒体文件的 Blob key */
export function buildMediaKey(type, uid, ext) {
  const dir = type === 'cover' ? 'covers' : type === 'attachment' ? 'attachments' : 'images';
  const cleanExt = (ext || 'bin').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return `${dir}/${uid}.${cleanExt}`;
}
