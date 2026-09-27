/**
 * 前端 API 客户端：同源请求 EdgeOne Functions 提供的 /api 接口。
 * 生产环境（静态导出 + Edge Functions）与本地开发（edgeone pages dev 代理）均使用相对路径。
 */
import type {
  AdminStats, Category, Comment, CommentStatus, MediaMeta, Paged, Post, PostStatus,
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
  listPosts: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v));
    return request<Paged<PostSummary>>(`/api/posts?${qs.toString()}`);
  },
  getPost: (idOrSlug: string) => request<{ ok: true; post: Post }>(`/api/posts/${encodeURIComponent(idOrSlug)}`),
  createPost: (body: Record<string, unknown>) =>
    request<{ ok: true; post: Post }>('/api/posts', { method: 'POST', body: JSON.stringify(body) }),
  updatePost: (id: string, body: Record<string, unknown>) =>
    request<{ ok: true; post: Post }>(`/api/posts/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) }),
  deletePost: (id: string) => request<{ ok: true }>(`/api/posts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  likePost: (idOrSlug: string) => request<{ ok: true; count: number }>(`/api/posts/${encodeURIComponent(idOrSlug)}/like`, { method: 'POST' }),
  viewPost: (idOrSlug: string) => request<{ ok: true; count: number }>(`/api/posts/${encodeURIComponent(idOrSlug)}/view`, { method: 'POST' }),
  relatedPosts: (idOrSlug: string) => request<{ ok: true; items: PostSummary[] }>(`/api/posts/${encodeURIComponent(idOrSlug)}/related`),
  listCommentsForPost: (idOrSlug: string) =>
    request<{ ok: true; items: Comment[]; total: number }>(`/api/posts/${encodeURIComponent(idOrSlug)}/comments`),
  createComment: (idOrSlug: string, body: { author: string; email?: string; website?: string; content: string }) =>
    request<{ ok: true; comment: Comment }>(`/api/posts/${encodeURIComponent(idOrSlug)}/comments`, { method: 'POST', body: JSON.stringify(body) }),

  // ---- 分类 / 标签 ----
  listCategories: () => request<{ ok: true; items: Category[] }>('/api/categories'),
  createCategory: (body: { name: string; slug?: string; description?: string }) =>
    request<{ ok: true; category: Category }>('/api/categories', { method: 'POST', body: JSON.stringify(body) }),
  updateCategory: (id: string, body: { name?: string; slug?: string; description?: string }) =>
    request<{ ok: true; category: Category }>(`/api/categories/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCategory: (id: string) => request<{ ok: true }>(`/api/categories/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  listTags: () => request<{ ok: true; items: Tag[] }>('/api/tags'),
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
  saveConfig: (patch: Partial<SiteConfig>) =>
    request<{ ok: true; config: SiteConfig }>('/api/config', { method: 'PUT', body: JSON.stringify(patch) }),
  getStats: () => request<{ ok: true; stats: AdminStats }>('/api/stats'),
  trackVisit: () => request<{ ok: true; stats: unknown }>('/api/stats/track', { method: 'POST', body: JSON.stringify({ type: 'visit' }) }),
  search: (q: string) => request<{ ok: true; items: PostSummary[]; total: number; q: string }>(`/api/search?q=${encodeURIComponent(q)}`),

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
};

export type { PostStatus };
