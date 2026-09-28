/**
 * 数据访问层：文章 / 分类 / 标签 / 评论 / 媒体 / 配置 / 统计
 * 全部基于 EdgeOne Pages KV（键名仅允许数字、字母、下划线）。
 */
import { getKv, Keys, kvGetJson, kvPutJson } from './kv.js';
import { slugify, readingTime, nowIso, fmtDate } from './ids.js';
import { normalizeCategoryIcon } from './icons.js';

/* ------------------------------------------------------------------ */
/* 站点配置                                                            */
/* ------------------------------------------------------------------ */

export const DEFAULT_SITE_CONFIG = {
  title: '我的博客',
  subtitle: '记录思考，分享知识',
  description: '基于 EdgeOne Pages 的个人博客',
  keywords: '博客,技术,生活',
  author: '博主',
  about: '## 关于我\n\n这是我的个人博客。\n\n- 用 EdgeOne Pages + Next.js + Tailwind CSS 构建\n- 内容存储于 EdgeOne KV，媒体存储于 EdgeOne Blob\n',
  footerText: 'Powered by EdgeOne Pages',
  language: 'zh-CN',
  perPage: 10,
  commentEnabled: true,
  commentModeration: true,
  /** 网站图标 URL（favicon 图片地址；为空使用默认图标） */
  faviconUrl: '',
  /** 首页精选文章（文章 id 列表，按此顺序展示；为空时首页自动取最新文章） */
  featuredPostIds: [],
  seo: {
    ogImage: '',
    twitterHandle: '',
    googleSiteVerification: '',
  },
  social: {
    github: '',
    twitter: '',
    wechat: '',
    email: '',
  },
  backup: {
    webdavUrl: '',
    webdavUsername: '',
    webdavPassword: '',
    webdavPath: '',
  },
  updatedAt: '',
};

export async function getSiteConfig(env) {
  const kv = getKv(env);
  const config = await kvGetJson(kv, Keys.configSite);
  return { ...DEFAULT_SITE_CONFIG, ...(config || {}) };
}

export async function saveSiteConfig(env, patch) {
  const kv = getKv(env);
  const current = await getSiteConfig(env);
  const next = { ...current, ...patch, updatedAt: nowIso() };
  await kvPutJson(kv, Keys.configSite, next);
  return next;
}

/* ------------------------------------------------------------------ */
/* 文章                                                                */
/* ------------------------------------------------------------------ */

/**
 * 文章实体：
 * {
 *   id, slug, title, summary, content, coverKey, categoryId,
 *   tags: [tagId], status: draft|published, visibility: public|private, author,
 *   createdAt, updatedAt, publishedAt, readingTime
 * }
 */

export async function getPost(env, id) {
  const kv = getKv(env);
  return kvGetJson(kv, Keys.post(id));
}

/** 根据 id 或 slug 获取文章 */
export async function getPostByIdOrSlug(env, value) {
  const kv = getKv(env);
  const raw = await kv.get(Keys.post(value));
  if (raw !== null && raw !== undefined && raw !== '') {
    return kvGetJson(kv, Keys.post(value));
  }
  const list = (await kvGetJson(kv, Keys.postList)) || [];
  for (const item of list) {
    if (item.slug === value) {
      const post = await getPost(env, item.id);
      if (post) return post;
    }
  }
  return null;
}

/** 获取全部文章摘要列表（含草稿、私人），按创建时间 createdAt 倒序 */
export async function getPostList(env) {
  const kv = getKv(env);
  const list = (await kvGetJson(kv, Keys.postList)) || [];
  return [...list].sort((a, b) => {
    const ta = a.createdAt || '';
    const tb = b.createdAt || '';
    return ta < tb ? 1 : ta > tb ? -1 : 0;
  });
}

/** 前台可见的文章摘要列表：已发布且公开（public） */
export async function getPublicPosts(env) {
  const list = await getPostList(env);
  return list.filter((p) => p.status === 'published' && (p.visibility || 'public') === 'public');
}

/** 判断文章当前是否对访客可见（已发布且公开） */
export function isPostPubliclyVisible(post) {
  return !!post && post.status === 'published' && (post.visibility || 'public') === 'public';
}

/** 文章摘要结构（不含正文） */
function toSummary(post, config) {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    summary: post.summary || '',
    coverKey: post.coverKey || '',
    coverUrl: post.coverUrl || '',
    categoryId: post.categoryId || '',
    tags: post.tags || [],
    status: post.status || 'draft',
    visibility: post.visibility || 'public',
    author: post.author || config.author || '',
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    publishedAt: post.publishedAt || post.createdAt,
    readingTime: post.readingTime,
  };
}

/** 新建文章（写入正文 + 更新摘要索引） */
export async function createPost(env, input) {
  const kv = getKv(env);
  const config = await getSiteConfig(env);
  const id = input.id || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  // slug 留白（含纯空白）时根据标题自动生成
  const baseSlug = slugify(String(input.slug || '').trim() || input.title);
  const now = nowIso();
  const status = input.status === 'published' ? 'published' : 'draft';
  const visibility = input.visibility === 'private' ? 'private' : 'public';

  // slug 冲突处理：追加短随机后缀
  let slug = baseSlug || id;
  const list = (await kvGetJson(kv, Keys.postList)) || [];
  const existingSlugs = new Set(list.map((p) => p.slug));
  if (existingSlugs.has(slug)) {
    slug = `${baseSlug || 'post'}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const post = {
    id,
    slug,
    title: String(input.title || '').trim(),
    summary: String(input.summary || '').trim(),
    content: String(input.content || ''),
    coverKey: input.coverKey || '',
    coverUrl: String(input.coverUrl || '').trim(),
    categoryId: input.categoryId || '',
    tags: Array.isArray(input.tags) ? [...new Set(input.tags)] : [],
    status,
    visibility,
    author: String(input.author || config.author || '').trim(),
    createdAt: now,
    updatedAt: now,
    publishedAt: status === 'published' ? now : input.publishedAt || '',
    readingTime: readingTime(input.content),
  };
  if (!post.title) throw new Error('文章标题不能为空');

  await kvPutJson(kv, Keys.post(id), post);
  const summaries = list.filter((p) => p.id !== id);
  summaries.push(toSummary(post, config));
  await kvPutJson(kv, Keys.postList, summaries);
  return post;
}

/** 更新文章 */
export async function updatePost(env, id, input) {
  const kv = getKv(env);
  const config = await getSiteConfig(env);
  const existing = await getPost(env, id);
  if (!existing) throw new Error('文章不存在');

  const next = { ...existing };
  for (const key of ['title', 'summary', 'content', 'coverKey', 'coverUrl', 'categoryId', 'author']) {
    if (input[key] !== undefined) next[key] = input[key];
  }
  if (input.tags !== undefined) next.tags = [...new Set(input.tags)];
  if (input.slug !== undefined) {
    const trimmedSlug = String(input.slug).trim();
    if (trimmedSlug) next.slug = slugify(trimmedSlug) || next.slug;
  }
  if (input.visibility !== undefined) {
    next.visibility = input.visibility === 'private' ? 'private' : 'public';
  }
  if (input.status !== undefined) {
    const newStatus = input.status === 'published' ? 'published' : 'draft';
    if (newStatus === 'published' && next.status !== 'published') next.publishedAt = nowIso();
    next.status = newStatus;
  }
  next.title = String(next.title || '').trim();
  next.updatedAt = nowIso();
  next.readingTime = readingTime(next.content);

  await kvPutJson(kv, Keys.post(id), next);
  const list = (await kvGetJson(kv, Keys.postList)) || [];
  const summaries = list.filter((p) => p.id !== id);
  summaries.push(toSummary(next, config));
  await kvPutJson(kv, Keys.postList, summaries);
  return next;
}

/** 删除文章（同时清理相关评论、统计键） */
export async function deletePost(env, id) {
  const kv = getKv(env);
  await kv.delete(Keys.post(id));
  await kv.delete(Keys.statsView(id));
  await kv.delete(Keys.statsLike(id));
  const list = (await kvGetJson(kv, Keys.postList)) || [];
  await kvPutJson(kv, Keys.postList, list.filter((p) => p.id !== id));
  // 删除该文章评论
  const comments = (await kvGetJson(kv, Keys.commentList)) || [];
  const remaining = comments.filter((c) => c.postId !== id);
  await kvPutJson(kv, Keys.commentList, remaining);
  for (const c of comments) {
    if (c.postId === id) await kv.delete(Keys.comment(id, c.id));
  }
}

/** 文章详情视图：附带分类/标签/统计数据 */
export async function postDetailView(env, post, config) {
  const kv = getKv(env);
  const [category, tags, views, likes] = await Promise.all([
    post.categoryId ? getCategory(env, post.categoryId) : null,
    (post.tags || []).length ? getTagsByIds(env, post.tags) : [],
    kvGetJson(kv, Keys.statsView(post.id)),
    kvGetJson(kv, Keys.statsLike(post.id)),
  ]);
  return {
    ...post,
    category: category ? { id: category.id, name: category.name, slug: category.slug } : null,
    tagDetails: tags,
    stats: {
      views: views?.count || 0,
      likes: likes?.count || 0,
    },
  };
}

/** 上一篇 / 下一篇（按 publishedAt 相邻；includePrivate 时包含私人文章，仅限已登录管理员） */
export async function adjacentPosts(env, post, includePrivate = false) {
  const list = includePrivate
    ? (await getPostList(env)).filter((p) => p.status === 'published')
    : await getPublicPosts(env);
  const idx = list.findIndex((p) => p.id === post.id);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx < list.length - 1 ? list[idx + 1] : null,
    next: idx > 0 ? list[idx - 1] : null,
  };
}

/** 相关文章：同分类或共享标签，最多 limit 篇（includePrivate 时包含私人文章，仅限已登录管理员） */
export async function relatedPosts(env, post, limit = 5, includePrivate = false) {
  const list = includePrivate
    ? (await getPostList(env)).filter((p) => p.status === 'published')
    : await getPublicPosts(env);
  const tagSet = new Set(post.tags || []);
  const scored = list
    .filter((p) => p.id !== post.id)
    .map((p) => {
      let score = 0;
      if (p.categoryId && p.categoryId === post.categoryId) score += 2;
      for (const t of p.tags || []) if (tagSet.has(t)) score += 1;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (b.p.publishedAt || '').localeCompare(a.p.publishedAt || ''));
  return scored.slice(0, limit).map((x) => x.p);
}

/* ------------------------------------------------------------------ */
/* 分类                                                                */
/* ------------------------------------------------------------------ */

export async function getCategory(env, id) {
  const kv = getKv(env);
  return kvGetJson(kv, Keys.category(id));
}

export async function getCategories(env) {
  const kv = getKv(env);
  const list = (await kvGetJson(kv, Keys.categoryList)) || [];
  return list.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
}

/** 分类附带文章数（按前台可见的公开文章统计） */
export async function getCategoriesWithCounts(env) {
  const [categories, posts] = await Promise.all([getCategories(env), getPublicPosts(env)]);
  const countMap = {};
  for (const p of posts) {
    if (p.categoryId) countMap[p.categoryId] = (countMap[p.categoryId] || 0) + 1;
  }
  return categories.map((c) => ({ ...c, postCount: countMap[c.id] || 0 }));
}

export async function createCategory(env, input) {
  const kv = getKv(env);
  const id = input.id || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const name = String(input.name || '').trim();
  if (!name) throw new Error('分类名称不能为空');
  const list = await getCategories(env);
  if (list.some((c) => c.name === name)) throw new Error('分类名称已存在');
  const category = {
    id,
    name,
    slug: slugify(input.slug || name) || id,
    description: String(input.description || '').trim(),
    icon: normalizeCategoryIcon(input.icon),
    createdAt: nowIso(),
  };
  const sl = new Set(list.map((c) => c.slug));
  if (sl.has(category.slug)) category.slug = `${category.slug}-${Math.random().toString(36).slice(2, 5)}`;
  await kvPutJson(kv, Keys.category(id), category);
  list.push(category);
  await kvPutJson(kv, Keys.categoryList, list);
  return category;
}

export async function updateCategory(env, id, input) {
  const kv = getKv(env);
  const existing = await getCategory(env, id);
  if (!existing) throw new Error('分类不存在');
  const next = { ...existing };
  if (input.name !== undefined) {
    const name = String(input.name).trim();
    if (!name) throw new Error('分类名称不能为空');
    const list = await getCategories(env);
    if (list.some((c) => c.id !== id && c.name === name)) throw new Error('分类名称已存在');
    next.name = name;
  }
  if (input.slug !== undefined && String(input.slug).trim()) next.slug = slugify(input.slug) || next.slug;
  if (input.description !== undefined) next.description = String(input.description).trim();
  if (input.icon !== undefined) next.icon = normalizeCategoryIcon(input.icon);
  await kvPutJson(kv, Keys.category(id), next);
  const list = (await kvGetJson(kv, Keys.categoryList)) || [];
  await kvPutJson(kv, Keys.categoryList, list.map((c) => (c.id === id ? next : c)));
  return next;
}

export async function deleteCategory(env, id) {
  const kv = getKv(env);
  await kv.delete(Keys.category(id));
  const list = (await kvGetJson(kv, Keys.categoryList)) || [];
  await kvPutJson(kv, Keys.categoryList, list.filter((c) => c.id !== id));
}

/* ------------------------------------------------------------------ */
/* 标签                                                                */
/* ------------------------------------------------------------------ */

export async function getTag(env, id) {
  const kv = getKv(env);
  return kvGetJson(kv, Keys.tag(id));
}

export async function getTags(env) {
  const kv = getKv(env);
  const list = (await kvGetJson(kv, Keys.tagList)) || [];
  return list.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
}

export async function getTagsByIds(env, ids) {
  const tags = await getTags(env);
  return tags.filter((t) => ids.includes(t.id));
}

/** 标签附带文章数（按前台可见的公开文章统计） */
export async function getTagsWithCounts(env) {
  const [tags, posts] = await Promise.all([getTags(env), getPublicPosts(env)]);
  const countMap = {};
  for (const p of posts) {
    for (const t of p.tags || []) countMap[t] = (countMap[t] || 0) + 1;
  }
  return tags.map((t) => ({ ...t, postCount: countMap[t.id] || 0 }));
}

/** 按名称获取或创建标签（写文章时自动建标签） */
export async function ensureTagByName(env, name) {
  const kv = getKv(env);
  const trimmed = String(name || '').trim();
  if (!trimmed) return null;
  const tags = await getTags(env);
  const found = tags.find((t) => t.name === trimmed);
  if (found) return found;
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const tag = {
    id,
    name: trimmed,
    slug: slugify(trimmed) || id,
    createdAt: nowIso(),
  };
  await kvPutJson(kv, Keys.tag(id), tag);
  tags.push(tag);
  await kvPutJson(kv, Keys.tagList, tags);
  return tag;
}

export async function createTag(env, input) {
  return ensureTagByName(env, input.name);
}

export async function updateTag(env, id, input) {
  const kv = getKv(env);
  const existing = await getTag(env, id);
  if (!existing) throw new Error('标签不存在');
  const name = String(input.name ?? existing.name).trim();
  if (!name) throw new Error('标签名称不能为空');
  const next = { ...existing, name, slug: slugify(input.slug ?? name) || existing.slug, updatedAt: nowIso() };
  await kvPutJson(kv, Keys.tag(id), next);
  const list = (await kvGetJson(kv, Keys.tagList)) || [];
  await kvPutJson(kv, Keys.tagList, list.map((t) => (t.id === id ? next : t)));
  return next;
}

export async function deleteTag(env, id) {
  const kv = getKv(env);
  await kv.delete(Keys.tag(id));
  const list = (await kvGetJson(kv, Keys.tagList)) || [];
  await kvPutJson(kv, Keys.tagList, list.filter((t) => t.id !== id));
  // 从文章中移除该标签
  const posts = (await kvGetJson(kv, Keys.postList)) || [];
  for (const p of posts) {
    if ((p.tags || []).includes(id)) {
      const post = await getPost(env, p.id);
      if (post) {
        post.tags = (post.tags || []).filter((t) => t !== id);
        post.updatedAt = nowIso();
        await kvPutJson(kv, Keys.post(p.id), post);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* 评论                                                                */
/* ------------------------------------------------------------------ */

export const COMMENT_STATUS = { PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected' };

export async function getComment(env, postId, id) {
  const kv = getKv(env);
  return kvGetJson(kv, Keys.comment(postId, id));
}

/** 全部评论（含详情），按时间倒序 */
export async function getComments(env) {
  const kv = getKv(env);
  const list = (await kvGetJson(kv, Keys.commentList)) || [];
  return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function createComment(env, input) {
  const kv = getKv(env);
  const config = await getSiteConfig(env);
  const post = await getPostByIdOrSlug(env, input.postId || input.postSlug);
  if (!post) throw new Error('文章不存在');
  if (post.status !== 'published') throw new Error('文章未发布');
  if ((post.visibility || 'public') === 'private') throw new Error('该文章不接受评论');
  if (config.commentEnabled === false) throw new Error('评论已关闭');

  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const author = String(input.author || '').trim().slice(0, 60);
  const content = String(input.content || '').trim().slice(0, 2000);
  if (!author) throw new Error('昵称不能为空');
  if (!content) throw new Error('评论内容不能为空');

  const status = config.commentModeration === false ? COMMENT_STATUS.APPROVED : COMMENT_STATUS.PENDING;
  const comment = {
    id,
    postId: post.id,
    postSlug: post.slug,
    postTitle: post.title,
    author,
    email: String(input.email || '').trim().slice(0, 120),
    website: String(input.website || '').trim().slice(0, 200),
    content,
    status,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await kvPutJson(kv, Keys.comment(post.id, id), comment);
  const list = (await kvGetJson(kv, Keys.commentList)) || [];
  list.push(comment);
  await kvPutJson(kv, Keys.commentList, list);
  return comment;
}

export async function updateCommentStatus(env, postId, id, status) {
  const kv = getKv(env);
  const comment = await getComment(env, postId, id);
  if (!comment) throw new Error('评论不存在');
  if (![COMMENT_STATUS.PENDING, COMMENT_STATUS.APPROVED, COMMENT_STATUS.REJECTED].includes(status)) {
    throw new Error('非法的评论状态');
  }
  comment.status = status;
  comment.updatedAt = nowIso();
  await kvPutJson(kv, Keys.comment(postId, id), comment);
  const list = (await kvGetJson(kv, Keys.commentList)) || [];
  await kvPutJson(kv, Keys.commentList, list.map((c) => (c.id === id && c.postId === postId ? comment : c)));
  return comment;
}

export async function deleteComment(env, postId, id) {
  const kv = getKv(env);
  await kv.delete(Keys.comment(postId, id));
  const list = (await kvGetJson(kv, Keys.commentList)) || [];
  await kvPutJson(kv, Keys.commentList, list.filter((c) => !(c.id === id && c.postId === postId)));
}

/* ------------------------------------------------------------------ */
/* 媒体元数据                                                          */
/* ------------------------------------------------------------------ */

export async function getMediaMeta(env, uid) {
  const kv = getKv(env);
  return kvGetJson(kv, Keys.media(uid));
}

/** 媒体文件列表（KV 元数据），按上传时间倒序 */
export async function listMedia(env) {
  const kv = getKv(env);
  const metas = [];
  let cursor;
  do {
    const res = await kv.list({ prefix: 'media_', limit: 256, ...(cursor ? { cursor } : {}) });
    for (const k of res.keys) {
      const meta = await kvGetJson(kv, k.key);
      if (meta) metas.push(meta);
    }
    cursor = res.cursor;
    if (res.complete) break;
  } while (cursor);
  return metas.sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
}

export async function saveMediaMeta(env, meta) {
  const kv = getKv(env);
  await kvPutJson(kv, Keys.media(meta.uid), meta);
}

export async function deleteMediaMeta(env, uid) {
  const kv = getKv(env);
  await kv.delete(Keys.media(uid));
}

/* ------------------------------------------------------------------ */
/* 访问统计                                                            */
/* ------------------------------------------------------------------ */

/** 记录一次站点访问，返回最新统计 */
export async function trackVisit(env) {
  const kv = getKv(env);
  const today = fmtDate(nowIso());
  const stats = (await kvGetJson(kv, Keys.statsVisit)) || {
    total: 0, today: 0, lastDate: '', days: {},
  };
  if (stats.lastDate !== today) {
    stats.lastDate = today;
    stats.today = 0;
  }
  stats.total += 1;
  stats.today += 1;
  const days = stats.days || {};
  days[today] = (days[today] || 0) + 1;
  // 仅保留最近 90 天
  const sortedDays = Object.keys(days).sort().slice(-90);
  stats.days = {};
  for (const d of sortedDays) stats.days[d] = days[d];
  await kvPutJson(kv, Keys.statsVisit, stats);
  return stats;
}

export async function getVisitStats(env) {
  const kv = getKv(env);
  const stats = (await kvGetJson(kv, Keys.statsVisit)) || { total: 0, today: 0, lastDate: '', days: {} };
  return stats;
}

/** 文章阅读量 +1 */
export async function trackView(env, postId) {
  const kv = getKv(env);
  const cur = (await kvGetJson(kv, Keys.statsView(postId))) || { count: 0 };
  cur.count = (cur.count || 0) + 1;
  await kvPutJson(kv, Keys.statsView(postId), cur);
  return cur.count;
}

export async function getViews(env, postId) {
  const kv = getKv(env);
  const cur = await kvGetJson(kv, Keys.statsView(postId));
  return cur?.count || 0;
}

/** 文章点赞 +1 */
export async function trackLike(env, postId) {
  const kv = getKv(env);
  const cur = (await kvGetJson(kv, Keys.statsLike(postId))) || { count: 0 };
  cur.count = (cur.count || 0) + 1;
  await kvPutJson(kv, Keys.statsLike(postId), cur);
  return cur.count;
}

export async function getLikes(env, postId) {
  const kv = getKv(env);
  const cur = await kvGetJson(kv, Keys.statsLike(postId));
  return cur?.count || 0;
}
