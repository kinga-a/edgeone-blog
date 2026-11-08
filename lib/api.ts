/**
 * 前端 API 客户端：同源请求 EdgeOne Functions 提供的 /api 接口。
 * 生产环境（静态导出 + Edge Functions）与本地开发（edgeone pages dev 代理）均使用相对路径。
 */
import type {
  AdminStats, Category, Comment, CommentStatus, McpKeyInfo, MediaMeta, Paged, Post, PostStatus,
  PostSummary, SiteConfig, Tag,
} from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
    credentials: 'same-origin',
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // 非 JSON 响应
  }
  if (!res.ok || (data && typeof data === 'object' && (data as { ok?: boolean }).ok === false)) {
    const err = (data as { error?: string })?.error || `请求失败 (${res.status})`;
    throw new Error(err);
  }
  return data as T;
}

/**
 * 前台公共读接口的轻量缓存（stale-while-revalidate）：
 * 页面之间跳转/整页刷新不再重复等待慢接口——30 秒内直接用缓存；
 * 过期则先秒显缓存、后台静默刷新，下一次打开即新数据。
 * 只供前台匿名浏览使用（*Cached 方法与精选接口）；后台管理仍走原始方法，永远实时。
 * 缓存存内存 + sessionStorage（整页跳转也能命中）；带大封面的列表超配额时自动只留内存。
 */
const READ_CACHE_TTL = 30_000;
const readCache = new Map<string, { ts: number; data: unknown }>();
const readInflight = new Map<string, Promise<unknown>>();
const READ_CACHE_SS_PREFIX = 'api-cache:';

function readCacheGet<T>(key: string): { data: T; fresh: boolean } | null {
  const mem = readCache.get(key);
  if (mem) return { data: mem.data as T, fresh: Date.now() - mem.ts < READ_CACHE_TTL };
  try {
    const raw = sessionStorage.getItem(READ_CACHE_SS_PREFIX + key);
    if (raw) {
      const parsed = JSON.parse(raw) as { ts: number; data: T };
      readCache.set(key, { ts: parsed.ts, data: parsed.data });
      return { data: parsed.data, fresh: Date.now() - parsed.ts < READ_CACHE_TTL };
    }
  } catch { /* sessionStorage 不可用则忽略 */ }
  return null;
}

function readCacheSet(key: string, data: unknown) {
  const entry = { ts: Date.now(), data };
  readCache.set(key, entry);
  try {
    sessionStorage.setItem(READ_CACHE_SS_PREFIX + key, JSON.stringify(entry));
  } catch { /* 超出存储配额时只保留内存缓存 */ }
}

function swr<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = readCacheGet<T>(key);
  if (hit?.fresh) return Promise.resolve(hit.data);
  let p = readInflight.get(key) as Promise<T> | undefined;
  if (!p) {
    p = fetcher()
      .then((data) => { readCacheSet(key, data); return data; })
      .finally(() => { readInflight.delete(key); });
    readInflight.set(key, p);
  }
  if (hit) {
    p.catch(() => null); // 有旧数据兜底时，后台刷新失败不打扰当前页面
    return Promise.resolve(hit.data);
  }
  return p;
}

function buildPostsPath(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v));
  return `/api/posts?${qs.toString()}`;
}

export const api = {
  // ---- 认证 ----
  setup: (username: string, password: string) =>
    request<{ ok: true }>('/api/auth/setup', { method: 'POST', body: JSON.stringify({ username, password }) }),
  login: (username: string, password: string, totp?: string) =>
    request<{ ok: true; username: string; totpRequired?: boolean }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password, totp }) }),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  me: () => request<{ ok: boolean; username: string | null; totpEnabled?: boolean }>('/api/auth/me'),
  // TOTP 二次验证管理
  totpAction: (action: 'setup' | 'verify' | 'disable', code?: string) =>
    request<{ ok: true; secret?: string; uri?: string; enabled?: boolean }>('/api/auth/totp', { method: 'POST', body: JSON.stringify({ action, code }) }),

  // ---- 文章 ----
  listPosts: (params: Record<string, string | number | undefined>) =>
    request<Paged<PostSummary>>(buildPostsPath(params)),
  /** 前台专用：带页面间缓存的文章列表（后台请勿用，须实时） */
  listPostsCached: (params: Record<string, string | number | undefined>) => {
    const path = buildPostsPath(params);
    return swr<Paged<PostSummary>>(path, () => request<Paged<PostSummary>>(path));
  },
  /** 首页精选文章（站点配置 featuredPostIds 指定，按顺序返回；未配置时为空）。仅前台使用，带缓存 */
  getFeaturedPosts: () => swr<{ ok: true; items: PostSummary[] }>('/api/posts/featured', () => request<{ ok: true; items: PostSummary[] }>('/api/posts/featured')),
  getPost: (idOrSlug: string) => request<{ ok: true; post: Post }>(`/api/posts/${encodeURIComponent(idOrSlug)}`),
  createPost: (body: Record<string, unknown>) =>
    request<{ ok: true; post: Post }>('/api/posts', { method: 'POST', body: JSON.stringify(body) }),
  updatePost: (id: string, body: Record<string, unknown>) =>
    request<{ ok: true; post: Post }>(`/api/posts/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) }),
  /** 删除文章 → 移入回收站（可恢复） */
  deletePost: (id: string) => request<{ ok: true; trashed: string }>(`/api/posts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  /** 从回收站恢复文章 */
  restorePost: (id: string) => request<{ ok: true; restored: string }>(`/api/posts/${encodeURIComponent(id)}`, { method: 'POST' }),
  /** 彻底删除文章（回收站永久删除，不可恢复） */
  purgePost: (id: string) => request<{ ok: true; purged: string }>(`/api/posts/${encodeURIComponent(id)}?permanent=1`, { method: 'DELETE' }),
  likePost: (idOrSlug: string) => request<{ ok: true; count: number }>(`/api/posts/${encodeURIComponent(idOrSlug)}/like`, { method: 'POST' }),
  viewPost: (idOrSlug: string) => request<{ ok: true; count: number }>(`/api/posts/${encodeURIComponent(idOrSlug)}/view`, { method: 'POST' }),
  relatedPosts: (idOrSlug: string) => request<{ ok: true; items: PostSummary[] }>(`/api/posts/${encodeURIComponent(idOrSlug)}/related`),
  listCommentsForPost: (idOrSlug: string) =>
    request<{ ok: true; items: Comment[]; total: number }>(`/api/posts/${encodeURIComponent(idOrSlug)}/comments`),
  createComment: (idOrSlug: string, body: { author: string; email?: string; website?: string; content: string }) =>
    request<{ ok: true; comment: Comment }>(`/api/posts/${encodeURIComponent(idOrSlug)}/comments`, { method: 'POST', body: JSON.stringify(body) }),

  // ---- 分类 / 标签 ----
  listCategories: () => request<{ ok: true; items: Category[] }>('/api/categories'),
  /** 前台专用：带缓存的分类列表 */
  listCategoriesCached: () => swr<{ ok: true; items: Category[] }>('/api/categories', () => request<{ ok: true; items: Category[] }>('/api/categories')),
  createCategory: (body: { name: string; slug?: string; description?: string; icon?: string }) =>
    request<{ ok: true; category: Category }>('/api/categories', { method: 'POST', body: JSON.stringify(body) }),
  updateCategory: (id: string, body: { name?: string; slug?: string; description?: string; icon?: string }) =>
    request<{ ok: true; category: Category }>(`/api/categories/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCategory: (id: string) => request<{ ok: true }>(`/api/categories/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  listTags: () => request<{ ok: true; items: Tag[] }>('/api/tags'),
  /** 前台专用：带缓存的标签列表 */
  listTagsCached: () => swr<{ ok: true; items: Tag[] }>('/api/tags', () => request<{ ok: true; items: Tag[] }>('/api/tags')),
  createTag: (body: { name: string; slug?: string }) =>
    request<{ ok: true; tag: Tag }>('/api/tags', { method: 'POST', body: JSON.stringify(body) }),
  updateTag: (id: string, body: { name?: string; slug?: string }) =>
    request<{ ok: true; tag: Tag }>(`/api/tags/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteTag: (id: string) => request<{ ok: true }>(`/api/tags/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // ---- 评论 ----
  listComments: (params: { status?: CommentStatus | ''; page?: number }) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.page) qs.set('page', String(params.page));
    return request<Paged<Comment>>(`/api/comments?${qs.toString()}`);
  },
  moderateComment: (id: string, postId: string, status: CommentStatus) =>
    request<{ ok: true; comment: Comment }>(`/api/comments/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ postId, status }) }),
  deleteComment: (id: string, postId: string) =>
    request<{ ok: true }>(`/api/comments/${encodeURIComponent(id)}?postId=${encodeURIComponent(postId)}`, { method: 'DELETE' }),

  // ---- 媒体 ----
  getUploadUrl: (body: { name: string; type: 'cover' | 'image' | 'attachment'; contentType?: string }) =>
    request<{ ok: true; url: string; key: string; uid: string; expiresAt: number }>('/api/media/upload-url', { method: 'POST', body: JSON.stringify(body) }),
  listMedia: (params: { type?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (params.type) qs.set('type', params.type);
    if (params.page) qs.set('page', String(params.page));
    return request<Paged<MediaMeta>>(`/api/media?${qs.toString()}`);
  },
  deleteMedia: (key: string, uid: string) =>
    request<{ ok: true }>(`/api/media/${key}?uid=${encodeURIComponent(uid)}`, { method: 'DELETE' }),

  // ---- 配置 / 统计 / 搜索 ----
  getConfig: () => request<{ ok: true; config: SiteConfig }>('/api/config'),
  /** 前台专用：带缓存的站点配置（后台设置页请勿用，须读完整实时配置） */
  getConfigCached: () => swr<{ ok: true; config: SiteConfig }>('/api/config', () => request<{ ok: true; config: SiteConfig }>('/api/config')),
  saveConfig: (patch: Partial<SiteConfig>) =>
    request<{ ok: true; config: SiteConfig }>('/api/config', { method: 'PUT', body: JSON.stringify(patch) }),
  getStats: () => request<{ ok: true; stats: AdminStats }>('/api/stats'),
  trackVisit: () => request<{ ok: true; stats: unknown }>('/api/stats/track', { method: 'POST', body: JSON.stringify({ type: 'visit' }) }),
  search: (q: string) => request<{ ok: true; items: PostSummary[]; total: number; q: string }>(`/api/search?q=${encodeURIComponent(q)}`),

  // ---- MCP API Key（/mcp 端点的 Bearer 鉴权凭据） ----
  listMcpKeys: () => request<{ ok: true; items: McpKeyInfo[] }>('/api/mcp-keys'),
  createMcpKey: (label: string) =>
    request<{ ok: true; key: McpKeyInfo; token: string; warning?: string }>('/api/mcp-keys', { method: 'POST', body: JSON.stringify({ label }) }),
  revokeMcpKey: (id: string) => request<{ ok: true; revoked: string }>(`/api/mcp-keys/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // ---- 备份 ----
  /** 全量导出：直接下载 JSON 备份文件 */
  exportBackup: async () => {
    const res = await fetch('/api/backup/export', { credentials: 'same-origin' });
    if (!res.ok) {
      let msg = `备份导出失败 (${res.status})`;
      try { const d = await res.json(); if (d?.error) msg = d.error; } catch { /* ignore */ }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') || '';
    const match = /filename="?([^"]+)"?/.exec(disposition);
    const filename = match ? match[1] : `edgeone-blog-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { ok: true as const };
  },
  /** 推送备份到 WebDAV */
  backupToWebdav: () =>
    request<{ ok: true; count: number; url: string }>('/api/backup/webdav', { method: 'POST', body: JSON.stringify({}) }),
  /** 测试 WebDAV 连通性（使用当前表单值，无需保存） */
  testWebdav: (cfg: { webdavUrl?: string; webdavUsername?: string; webdavPassword?: string }) =>
    request<{ ok: true; status: number; message?: string }>('/api/backup/webdav-test', { method: 'POST', body: JSON.stringify(cfg) }),
  /** 从 JSON 备份恢复 KV 数据（合并式覆盖） */
  restoreBackup: (payload: unknown) =>
    request<{ ok: true; restored: number; skipped: number; count: number }>('/api/backup/restore', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  /** 从 WebDAV 拉取备份并恢复 */
  restoreFromWebdav: () =>
    request<{ ok: true; restored: number; skipped: number; count: number }>('/api/backup/restore-webdav', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
};

export type { PostStatus };
