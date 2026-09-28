/** 备份共享逻辑：KV 全量导出 + WebDAV 推送 */
import { getKv } from './kv.js';
import { getSiteConfig } from './data.js';

/** 全量导出 KV 数据（保留原始 JSON 字符串，便于恢复） */
export async function dumpAll(env) {
  const kv = getKv(env);
  const data = {};
  let cursor;
  let pages = 0;
  do {
    // 注意：EdgeOne Pages KV 的 list limit 上限为 256（与 Cloudflare 的 1000 不同）
    const res = await kv.list({ limit: 256, ...(cursor ? { cursor } : {}) });
    for (const k of res.keys) {
      const raw = await kv.get(k.key).catch(() => null);
      if (raw !== null && raw !== undefined) data[k.key] = raw;
    }
    // 兼容 complete / list_complete / cursor 空串三种终止信号
    const done = res.complete === true || res.list_complete === true || !res.cursor || res.cursor === '';
    cursor = done ? null : res.cursor;
    pages += 1;
    // 兜底保护：最多遍历 200 页（约 5 万 key），防止异常死循环
    if (pages >= 200) break;
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

/**
 * 从备份 payload 恢复 KV 数据（合并式：同键覆盖，备份中不存在的键保持不变）。
 * 跳过会话键 auth_session_*，避免恢复出旧登录态。
 * 返回 { restored, skipped, count }。
 */
export async function restoreFromPayload(env, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('备份文件格式无效：不是 JSON 对象');
  }
  if (payload.version !== 1) {
    throw new Error(`不支持的备份版本：${String(payload.version)}（当前仅支持 version 1）`);
  }
  if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
    throw new Error('备份数据缺失：缺少 data 字段或 data 不是对象');
  }
  const kv = getKv(env);
  const entries = Object.entries(payload.data);
  if (!entries.length) throw new Error('备份数据为空，无需恢复');

  let restored = 0;
  let skipped = 0;
  for (const [key, value] of entries) {
    // 跳过会话键，避免旧登录态复活
    if (key.startsWith('auth_session_')) {
      skipped += 1;
      continue;
    }
    await kv.put(key, typeof value === 'string' ? value : JSON.stringify(value));
    restored += 1;
  }
  return { ok: true, restored, skipped, count: entries.length };
}

/** 从配置的 WebDAV 拉取备份并恢复（合并式） */
export async function restoreFromWebdav(env) {
  const config = await getSiteConfig(env);
  const b = config.backup || {};
  if (!b.webdavUrl) throw new Error('未配置 WebDAV 地址');

  const headers = {};
  if (b.webdavUsername) {
    headers.Authorization = `Basic ${utf8Base64(`${b.webdavUsername}:${b.webdavPassword || ''}`)}`;
  }
  const res = await fetch(b.webdavUrl, { method: 'GET', headers });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 200);
    throw new Error(`WebDAV 拉取失败：HTTP ${res.status}${detail ? ` ${detail}` : ''}`);
  }
  let payload;
  try {
    payload = JSON.parse(await res.text());
  } catch {
    throw new Error('WebDAV 上的文件不是有效的 JSON 备份');
  }
  return restoreFromPayload(env, payload);
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
