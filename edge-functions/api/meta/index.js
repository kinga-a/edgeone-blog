/**
 * GET /api/meta — 运行时与存储后端探测（管理员）
 *
 * 返回当前实际运行环境与运行健康快照，供后台「平台信息」卡片动态渲染，避免写死：
 * - 本地 local-serve：globalThis.__BLOG_KV__（SQLite）/ __BLOG_BLOB__（本地文件）已注入
 * - EdgeOne Pages：env.BLOG_KV 绑定 + 平台 Blob（store blog-media）
 * 依赖注入见 edge-functions/api/_lib/kv.js / storage.js。
 *
 * 说明：数据规模读聚合列表键（低成本，避免线上全量 list）；媒体体积在数量不大时累加。
 */
import { json, fail } from '../_lib/response.js';
import { requireAdmin, getAdmin } from '../_lib/auth.js';
import { getKv, Keys, kvGetJson, kvListKeys } from '../_lib/kv.js';
import { listMcpKeys } from '../_lib/mcp-auth.js';
import { APP_VERSION, NEXT_VERSION, BUILD_TIME, ARTICLE_CSS_V } from '../_lib/asset-version.generated.js';

function detectRuntime(env) {
  const localKv = !!globalThis.__BLOG_KV__;
  const localBlob = !!globalThis.__BLOG_BLOB__;
  const isLocal = localKv || localBlob;
  const edgeKv = !localKv && !!(env && (env.BLOG_KV || env.blog_kv));

  let nodeVersion = null;
  try {
    if (isLocal && typeof process !== 'undefined' && process.version) nodeVersion = process.version;
  } catch { /* 边缘环境可能无 process */ }

  return {
    framework: 'Next.js',
    styling: 'Tailwind CSS',
    runtime: isLocal ? 'local' : 'edgeone',
    hosting: isLocal ? '本地自托管 (local-serve)' : 'EdgeOne Pages',
    kv: localKv ? 'SQLite' : edgeKv ? 'EdgeOne KV' : '未检测到',
    blob: localBlob ? '本地文件系统' : 'EdgeOne Blob',
    node: nodeVersion,
  };
}

export async function onRequestGet({ request, env }) {
  const admin = await requireAdmin(request, env).catch(() => ({ ok: false }));
  if (!admin.ok) return fail(401, '未登录或登录已过期');

  const runtime = detectRuntime(env);
  const meta = {
    ...runtime,
    appVersion: APP_VERSION || '',
    nextVersion: NEXT_VERSION || '',
    buildTime: BUILD_TIME || '',
    assetVersion: ARTICLE_CSS_V || '',
    uptimeSec: null,
    counts: { posts: 0, publishedPosts: 0, categories: 0, tags: 0, comments: 0, pendingComments: 0, media: 0 },
    mediaBytes: 0,
    snapshot: null,
    backupWebdav: false,
    totp: false,
    mcpKeys: 0,
  };

  try {
    const kv = getKv(env);
    const [postList, catList, tagList, commentList, snap, adminRec, cfg] = await Promise.all([
      kvGetJson(kv, Keys.postList).catch(() => null),
      kvGetJson(kv, Keys.categoryList).catch(() => null),
      kvGetJson(kv, Keys.tagList).catch(() => null),
      kvGetJson(kv, Keys.commentList).catch(() => null),
      kvGetJson(kv, Keys.publicSnapshot).catch(() => null),
      getAdmin(env).catch(() => null),
      kvGetJson(kv, Keys.configSite).catch(() => null),
    ]);

    const posts = Array.isArray(postList) ? postList : [];
    const comments = Array.isArray(commentList) ? commentList : [];
    meta.counts = {
      posts: posts.length,
      publishedPosts: posts.filter((p) => p && p.status === 'published').length,
      categories: Array.isArray(catList) ? catList.length : 0,
      tags: Array.isArray(tagList) ? tagList.length : 0,
      comments: comments.length,
      pendingComments: comments.filter((c) => c && c.status === 'pending').length,
      media: 0,
    };
    meta.snapshot = snap && Array.isArray(snap.items)
      ? { count: snap.items.length, builtAt: snap.builtAt || null }
      : null;
    meta.backupWebdav = !!(cfg && cfg.backup && cfg.backup.webdavUrl);
    meta.totp = !!adminRec && adminRec.totpEnabled === true;

    try {
      const mediaKeys = await kvListKeys(kv, 'media_');
      meta.counts.media = mediaKeys.length;
      if (mediaKeys.length > 0 && mediaKeys.length <= 300) {
        const metas = await Promise.all(mediaKeys.map((k) => kvGetJson(kv, k).catch(() => null)));
        meta.mediaBytes = metas.reduce((s, m) => s + (Number(m && m.size) || 0), 0);
      }
    } catch { /* 媒体统计失败不影响主信息 */ }

    try {
      const keys = await listMcpKeys(env);
      meta.mcpKeys = Array.isArray(keys) ? keys.length : 0;
    } catch { /* 未配置 MCP 时忽略 */ }
  } catch { /* KV 未绑定等异常时返回基础环境信息 */ }

  if (runtime.runtime === 'local') {
    try {
      if (typeof process !== 'undefined' && typeof process.uptime === 'function') {
        meta.uptimeSec = Math.floor(process.uptime());
      }
    } catch { /* ignore */ }
  }

  return json({ ok: true, meta }, { headers: { 'Cache-Control': 'no-store' } });
}

export const onRequest = onRequestGet;