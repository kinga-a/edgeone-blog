/** 备份共享逻辑：KV 全量导出 + WebDAV 推送 */
import { getKv } from './kv.js';
import { getSiteConfig } from './data.js';

/** 全量导出 KV 数据（保留原始 JSON 字符串，便于恢复） */
export async function dumpAll(env) {
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

/** 生成可下载的 JSON 备份文件响应（content-disposition 附件） */
export async function makeExportResponse(env) {
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

export function utf8Base64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** 将全量备份推送到 WebDAV；失败时抛出带信息的 Error */
export async function webdavPush(env) {
  const config = await getSiteConfig(env);
  const b = config.backup || {};
  if (!b.webdavUrl) throw new Error('未配置 WebDAV 地址');

  const dump = await dumpAll(env);
  const payload = JSON.stringify(dump, null, 2);
  const headers = { 'Content-Type': 'application/json', Overwrite: 'T' };
  if (b.webdavUsername) {
    headers.Authorization = `Basic ${utf8Base64(`${b.webdavUsername}:${b.webdavPassword || ''}`)}`;
  }
  const res = await fetch(b.webdavUrl, { method: 'PUT', headers, body: payload });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 200);
    throw new Error(`WebDAV 推送失败：HTTP ${res.status}${detail ? ` ${detail}` : ''}`);
  }
  return { ok: true, count: dump.count, url: b.webdavUrl };
}
