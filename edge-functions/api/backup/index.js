import { json, fail } from '../_lib/response.js';
import { requireAdmin } from '../_lib/auth.js';
import { getKv } from '../_lib/kv.js';
import { getSiteConfig } from '../_lib/data.js';

/** 全量导出 KV 数据（保留原始 JSON 字符串，便于恢复） */
async function dumpAll(env) {
  const kv = getKv(env);
  const data = {};
  let cursor;
  do {
    const res = await kv.list({ limit: 1000, ...(cursor ? { cursor } : {}) });
    for (const k of res.keys) {
      const raw = await kv.get(k.key);
      if (raw !== null && raw !== undefined) data[k.key] = raw;
    }
    cursor = res.cursor;
    if (res.complete) break;
  } while (cursor);
  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    store: 'edgeone-kv',
    count: Object.keys(data).length,
    data,
  };
}

/** GET /api/backup/export — 全量导出（管理员），返回 JSON 文件供下载 */
export async function onRequestGet({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  const dump = await dumpAll(env);
  const body = JSON.stringify(dump, null, 2);
  return new Response(body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="edgeone-blog-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}

function utf8Base64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** POST /api/backup/webdav — 将全量备份推送到 WebDAV（管理员） */
export async function onRequestPost({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  const config = await getSiteConfig(env);
  const b = config.backup || {};
  if (!b.webdavUrl) return fail(400, '未配置 WebDAV 地址');

  const dump = await dumpAll(env);
  const payload = JSON.stringify(dump, null, 2);
  const headers = { 'Content-Type': 'application/json', Overwrite: 'T' };
  if (b.webdavUsername) {
    headers.Authorization = `Basic ${utf8Base64(`${b.webdavUsername}:${b.webdavPassword || ''}`)}`;
  }
  try {
    const res = await fetch(b.webdavUrl, { method: 'PUT', headers, body: payload });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 200);
      return fail(502, `WebDAV 推送失败：HTTP ${res.status}${detail ? ` ${detail}` : ''}`);
    }
    return json({ ok: true, count: dump.count, url: b.webdavUrl });
  } catch (e) {
    return fail(502, `WebDAV 推送失败：${e.message || '网络错误'}`);
  }
}

export const onRequest = onRequestGet;
