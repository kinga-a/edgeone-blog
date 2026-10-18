/**
 * EdgeOne Blog MCP Server —— Streamable HTTP 端点（POST /mcp）
 *
 * 让 MCP 客户端（如 OpenClaw / Claude Desktop / Cursor）通过 API Key（Bearer Token）
 * 对博客进行创建、更新、删除等管理操作。
 *
 * - 鉴权：Authorization: Bearer eob_xxx（在后台 /api/mcp-keys 创建），与 Cookie 会话体系分离
 * - 协议：MCP Streamable HTTP，无状态模式（每请求实例化 Server + Transport，
 *   enableJsonResponse 直接回 JSON，不依赖长连接/SSE，契合边缘函数短生命周期）
 * - 数据：直接复用 edge-functions/api/_lib 的数据层，与 REST API 同一套读写逻辑
 */
// 关键：crypto 兼容层必须在任何加密调用之前完成加载与补齐
import './api/_lib/crypto-polyfill.js';
// 注意：不再引入 @modelcontextprotocol/sdk —— 该 SDK 会使 EdgeOne Makers 打包出的
// 边缘函数脚本超过运行时体积限制，线上表现为全站 545「Error return from script / file too big」。
// 下方以手写 JSON-RPC 2.0 实现 MCP Streamable HTTP 无状态模式所需的最小协议面，
// 兼容 OpenClaw / Claude Desktop / Cursor / Cline 等客户端（initialize / ping / tools/*）。
import { verifyMcpBearer } from './api/_lib/mcp-auth.js';
import { withErrorGuard } from './api/_lib/response.js';
import * as data from './api/_lib/data.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, MCP-Protocol-Version, Last-Event-ID',
  'Access-Control-Max-Age': '86400',
};

function jsonError(status, message, extra) {
  return new Response(JSON.stringify({ ok: false, error: message, ...(extra || {}) }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS, ...(extra?.headers || {}) },
  });
}

/* ------------------------------------------------------------------ */
/* 工具参数解析辅助                                                     */
/* ------------------------------------------------------------------ */

/** 按 id 或 slug 定位文章（Key 视为管理员视角，草稿/私人均可见），找不到抛错 */
async function resolvePostRef(env, idOrSlug) {
  const post = await data.getPostByIdOrSlug(env, String(idOrSlug || '').trim());
  if (!post) throw new Error(`文章不存在：${idOrSlug}（可先用 blog_list_posts 或 blog_search_posts 找到 id/slug）`);
  return post;
}

/** 分类：接受 categoryId 或 categoryName（按 name/slug 匹配，不自动创建） */
async function resolveCategoryId(env, args) {
  if (args.categoryId) {
    const cat = await data.getCategory(env, String(args.categoryId));
    if (!cat) throw new Error(`分类 id 不存在：${args.categoryId}`);
    return cat.id;
  }
  if (!args.categoryName) return args.categoryId === '' ? '' : undefined;
  const categories = await data.getCategories(env);
  const name = String(args.categoryName).trim();
  const hit = categories.find((c) => c.name === name || c.slug === name);
  if (!hit) {
    throw new Error(`分类 "${name}" 不存在。现有分类：${categories.map((c) => c.name).join('、') || '（暂无）'}。分类不能在发文章时自动创建，请先在后台或用 blog_update_post 换用现有分类。`);
  }
  return hit.id;
}

/** 按 id / slug / 名称解析分类，返回分类对象 */
async function resolveCategoryRef(env, ref) {
  if (!ref) throw new Error('idOrSlug 不能为空');
  const categories = await data.getCategories(env);
  const key = String(ref);
  const hit =
    categories.find((c) => c.id === key) ||
    categories.find((c) => c.slug === key) ||
    categories.find((c) => c.name === key);
  if (!hit) {
    throw new Error(`分类 "${ref}" 不存在。现有分类：${categories.map((c) => c.name).join('、') || '（暂无）'}`);
  }
  return hit;
}

/** 标签：接受标签 id / 名称 / slug 混合数组，未知名称自动创建（与 REST /api/posts 行为一致） */
async function resolveTagIds(env, rawTags) {
  if (!Array.isArray(rawTags)) return undefined;
  const allTags = await data.getTags(env);
  const ids = [];
  for (const t of rawTags) {
    const v = String(t || '').trim();
    if (!v) continue;
    const byId = allTags.find((x) => x.id === v);
    if (byId) { ids.push(byId.id); continue; }
    const byName = allTags.find((x) => x.name === v || x.slug === v);
    ids.push(byName ? byName.id : (await data.ensureTagByName(env, v)).id);
  }
  return ids;
}

/** 从 patch 里挑出 updatePost/createPost 认识的字段 */
function pickFields(args, keys) {
  const out = {};
  for (const k of keys) if (args[k] !== undefined) out[k] = args[k];
  return out;
}

function postBrief(post, extra = {}) {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    summary: post.summary || '',
    status: post.status,
    visibility: post.visibility || 'public',
    coverUrl: post.coverUrl || '',
    updatedAt: post.updatedAt,
    publicPath: post.status === 'published' && (post.visibility || 'public') === 'public' ? `/posts/${post.slug}/` : null,
    ...extra,
  };
}

/* ------------------------------------------------------------------ */
/* 工具实现（返回 MCP CallToolResult）                                  */
/* ------------------------------------------------------------------ */

const OK_TEXT = (payload) => ({
  content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
});

const ERR_TEXT = (message) => ({
  content: [{ type: 'text', text: JSON.stringify({ ok: false, error: message }) }],
  isError: true,
});

const TOOLS = {
  blog_list_posts: async (env, args) => {
    let list = await data.getPostList(env);
    const status = args.status || 'all';
    if (status === 'trash') {
      list = list.filter((p) => !!p.deletedAt);
    } else {
      list = list.filter((p) => !p.deletedAt);
      if (status !== 'all') list = list.filter((p) => p.status === status);
    }
    const categoryId = await resolveCategoryId(env, { categoryName: args.categoryName, categoryId: args.categoryId });
    if (categoryId) list = list.filter((p) => p.categoryId === categoryId);
    if (args.tag) {
      const tagIds = await resolveTagIds(env, [args.tag]);
      list = list.filter((p) => (p.tags || []).some((t) => tagIds.includes(t)));
    }
    const q = String(args.q || '').trim().toLowerCase();
    if (q) list = list.filter((p) => p.title.toLowerCase().includes(q) || (p.summary || '').toLowerCase().includes(q));

    const total = list.length;
    const page = Math.max(1, Number(args.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(args.pageSize) || 10));
    const items = list.slice((page - 1) * pageSize, page * pageSize);
    const cats = await data.getCategories(env);
    const catMap = new Map(cats.map((c) => [c.id, c.name]));
    const stats = await data.getPostStatsBatch(env, items.map((p) => p.id));
    return OK_TEXT({
      ok: true,
      total,
      page,
      pageSize,
      items: items.map((p) => {
        const s = stats.get(p.id) || { views: 0, likes: 0, comments: 0 };
        return postBrief(p, { categoryName: catMap.get(p.categoryId) || '', views: s.views, likes: s.likes, commentCount: s.comments });
      }),
    });
  },

  blog_get_post: async (env, args) => {
    const post = await resolvePostRef(env, args.idOrSlug);
    const config = await data.getSiteConfig(env);
    const detail = await data.postDetailView(env, post, config);
    return OK_TEXT({ ok: true, post: detail });
  },

  blog_create_post: async (env, args) => {
    if (!String(args.title || '').trim()) throw new Error('title 不能为空');
    const categoryId = await resolveCategoryId(env, args);
    const tags = await resolveTagIds(env, args.tags);
    const post = await data.createPost(env, {
      title: args.title,
      content: String(args.content || ''),
      summary: args.summary,
      slug: args.slug,
      coverUrl: args.coverUrl,
      author: args.author,
      status: args.status === 'draft' ? 'draft' : 'published',
      visibility: args.visibility === 'private' ? 'private' : 'public',
      ...(categoryId !== undefined ? { categoryId } : {}),
      ...(tags !== undefined ? { tags } : {}),
    });
    return OK_TEXT({ ok: true, created: postBrief(post, { contentLength: String(post.content || '').length, readingTime: post.readingTime }) });
  },

  blog_update_post: async (env, args) => {
    const post = await resolvePostRef(env, args.idOrSlug);
    const patch = pickFields(args, ['title', 'summary', 'content', 'slug', 'coverUrl', 'coverKey', 'author', 'status', 'visibility']);
    if (args.categoryId !== undefined || args.categoryName !== undefined) {
      const categoryId = await resolveCategoryId(env, args);
      if (categoryId !== undefined) patch.categoryId = categoryId;
    }
    if (args.tags !== undefined) patch.tags = await resolveTagIds(env, args.tags);
    if (!Object.keys(patch).length) throw new Error('没有任何要更新的字段（title/content/summary/status/visibility/tags/categoryName/...）');
    const updated = await data.updatePost(env, post.id, patch);
    return OK_TEXT({ ok: true, updated: postBrief(updated), changed: Object.keys(patch) });
  },

  blog_delete_post: async (env, args) => {
    const post = await resolvePostRef(env, args.idOrSlug);
    if (args.confirmTitle !== undefined && String(args.confirmTitle) !== post.title) {
      throw new Error(`confirmTitle 与文章标题不一致（实际标题：「${post.title}」），已中止删除。请带上准确标题重试，这是对破坏性操作的二次确认。`);
    }
    await data.deletePost(env, post.id);
    return OK_TEXT({ ok: true, deleted: { id: post.id, slug: post.slug, title: post.title, status: post.status }, note: '文章已移入回收站（软删除），可在后台「文章管理 → 回收站」恢复或彻底删除；删除未真正销毁数据。' });
  },

  blog_list_taxonomy: async (env) => {
    const [categories, tags] = await Promise.all([data.getCategoriesWithCounts(env), data.getTagsWithCounts(env)]);
    return OK_TEXT({ ok: true, categories, tags });
  },

  blog_create_category: async (env, args) => {
    if (!String(args.name || '').trim()) throw new Error('name 不能为空');
    const category = await data.createCategory(env, args);
    return OK_TEXT({ ok: true, created: category });
  },

  blog_update_category: async (env, args) => {
    const cat = await resolveCategoryRef(env, args.idOrSlug);
    const patch = pickFields(args, ['name', 'slug', 'description', 'icon', 'sort']);
    if (!Object.keys(patch).length) throw new Error('没有任何要更新的字段（name/slug/description/icon/sort）');
    const updated = await data.updateCategory(env, cat.id, patch);
    return OK_TEXT({ ok: true, updated, changed: Object.keys(patch) });
  },

  blog_delete_category: async (env, args) => {
    const cat = await resolveCategoryRef(env, args.idOrSlug);
    if (args.confirmName !== undefined && String(args.confirmName) !== cat.name) {
      throw new Error(`confirmName 与分类名称不一致（实际名称：「${cat.name}」），已中止删除。请带上准确名称重试，这是对破坏性操作的二次确认。`);
    }
    const usedBy = (await data.getPostList(env)).filter((p) => p.categoryId === cat.id);
    if (usedBy.length) {
      throw new Error(`仍有 ${usedBy.length} 篇文章使用该分类（如：${usedBy.slice(0, 3).map((p) => p.title).join('、')}），已中止删除。请先移除这些文章的 categoryId 或改用其它分类。`);
    }
    await data.deleteCategory(env, cat.id);
    return OK_TEXT({ ok: true, deleted: { id: cat.id, slug: cat.slug, name: cat.name } });
  },

  blog_search_posts: async (env, args) => {
    const q = String(args.q || '').trim().toLowerCase();
    if (!q) throw new Error('q 不能为空');
    const list = await data.getPostList(env);
    const [categories, tags] = await Promise.all([data.getCategories(env), data.getTags(env)]);
    const catMap = new Map(categories.map((c) => [c.id, c]));
    const tagMap = new Map(tags.map((t) => [t.id, t.name]));
    // 列表索引不含正文，逐篇取正文做真实全文匹配（个人博客体量，上限 300 篇）
    const fulls = await Promise.all(list.slice(0, 300).map((p) => data.getPost(env, p.id)));
    const items = [];
    for (const p of fulls) {
      if (!p) continue;
      let score = 0;
      if (p.title.toLowerCase().includes(q)) score += 10;
      if ((p.summary || '').toLowerCase().includes(q)) score += 5;
      const catName = p.categoryId ? catMap.get(p.categoryId)?.name || '' : '';
      if (catName.toLowerCase().includes(q)) score += 2;
      for (const tid of p.tags || []) if ((tagMap.get(tid) || '').toLowerCase().includes(q)) score += 2;
      if (!score && String(p.content || '').toLowerCase().includes(q)) score = 1;
      if (score) items.push({ p, score });
    }
    items.sort((a, b) => b.score - a.score);
    return OK_TEXT({
      ok: true,
      total: items.length,
      items: items.slice(0, 20).map(({ p, score }) => postBrief(p, { score, categoryName: p.categoryId ? catMap.get(p.categoryId)?.name || '' : '', tagNames: (p.tags || []).map((t) => tagMap.get(t) || '').filter(Boolean) })),
    });
  },
};

const TOOL_DEFS = [
  {
    name: 'blog_list_posts',
    description: '列出博客文章摘要（含草稿与私人文章，按创建时间倒序）。用于查看现状、找文章 id/slug。',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['all', 'published', 'draft', 'trash'], description: '按状态筛选；trash=回收站，默认 all（默认不含回收站）' },
        categoryName: { type: 'string', description: '按分类名筛选' },
        categoryId: { type: 'string', description: '按分类 id 筛选' },
        tag: { type: 'string', description: '按标签（名称或 id）筛选' },
        q: { type: 'string', description: '关键词（匹配标题/摘要）' },
        page: { type: 'number', description: '页码，从 1 开始' },
        pageSize: { type: 'number', description: '每页条数，默认 10，最大 50' },
      },
    },
  },
  {
    name: 'blog_get_post',
    description: '获取单篇文章完整详情（含 Markdown 正文 content、分类、标签、阅读/点赞数）。修改正文前必须先调用本工具拿到原文。',
    inputSchema: {
      type: 'object',
      properties: { idOrSlug: { type: 'string', description: '文章 id 或 slug' } },
      required: ['idOrSlug'],
    },
  },
  {
    name: 'blog_create_post',
    description: '创建文章（Markdown）。默认直接发布（status=published）且公开；传 status=draft 存草稿，visibility=private 设私人文章。tags 里的新标签名会自动创建。',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '文章标题（必填）' },
        content: { type: 'string', description: 'Markdown 正文' },
        summary: { type: 'string', description: '摘要，留空则前台展示截取自正文' },
        slug: { type: 'string', description: 'URL slug；留空自动生成。注意：纯中文标题会生成空 slug 并自动回退为随机 id' },
        categoryName: { type: 'string', description: '分类名（必须已存在；不会自动建分类）' },
        categoryId: { type: 'string', description: '分类 id（与 categoryName 二选一）' },
        tags: { type: 'array', items: { type: 'string' }, description: '标签名或标签 id 数组，未知标签名会自动创建' },
        status: { type: 'string', enum: ['published', 'draft'], description: '默认 published' },
        visibility: { type: 'string', enum: ['public', 'private'], description: '默认 public' },
        coverUrl: { type: 'string', description: '封面图外部 URL' },
        author: { type: 'string', description: '作者，留空用站点默认作者' },
      },
      required: ['title'],
    },
  },
  {
    name: 'blog_update_post',
    description: '更新文章，只改动传入的字段（补丁语义）。content 为整篇覆盖：先 blog_get_post 拿正文，改后回传，不做增量合并。',
    inputSchema: {
      type: 'object',
      properties: {
        idOrSlug: { type: 'string', description: '文章 id 或 slug（必填）' },
        title: { type: 'string' },
        content: { type: 'string', description: '新的完整 Markdown 正文（覆盖）' },
        summary: { type: 'string' },
        slug: { type: 'string', description: '修改 slug（自动 slugify，冲突会报错重试）' },
        categoryName: { type: 'string' },
        categoryId: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' }, description: '完整替换标签列表' },
        status: { type: 'string', enum: ['published', 'draft'], description: '发布 / 转回草稿' },
        visibility: { type: 'string', enum: ['public', 'private'] },
        coverUrl: { type: 'string' },
        author: { type: 'string' },
      },
      required: ['idOrSlug'],
    },
  },
  {
    name: 'blog_delete_post',
    description: '删除文章（移入回收站，可恢复）。正文/评论/统计均保留，前台立即不可见；可在后台「文章管理 → 回收站」恢复或彻底删除。建议先 blog_get_post 向用户复述标题确认；可传 confirmTitle 做二次确认校验。',
    inputSchema: {
      type: 'object',
      properties: {
        idOrSlug: { type: 'string', description: '文章 id 或 slug（必填）' },
        confirmTitle: { type: 'string', description: '传入文章准确标题；与库中不一致时拒绝删除' },
      },
      required: ['idOrSlug'],
    },
  },
  {
    name: 'blog_list_taxonomy',
    description: '列出全部分类与标签（含文章计数）。用于创建/更新文章前选择分类、复用已有标签。',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'blog_create_category',
    description: '新建分类（name 必填；slug 留空自动生成，slug 冲突自动加后缀；icon 为 emoji/单字符，sort 小的在前）。',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '分类名称（必填，不可与现有分类重名）' },
        slug: { type: 'string', description: 'URL slug，留空自动生成' },
        description: { type: 'string', description: '分类描述' },
        icon: { type: 'string', description: '分类图标：内置图标 key（code/layout/server/database/cloud/wrench/network/book/doc/pen/image/music/video/game/shield/mobile/spark/palette/gear/star）或完整 <svg> 字符串；留空表示无图标' },
        sort: { type: 'number', description: '排序权重，小的在前' },
      },
      required: ['name'],
    },
  },
  {
    name: 'blog_update_category',
    description: '更新分类（补丁语义，只改传入字段）。idOrSlug 传分类 id、slug 或名称。',
    inputSchema: {
      type: 'object',
      properties: {
        idOrSlug: { type: 'string', description: '分类 id、slug 或名称（必填）' },
        name: { type: 'string', description: '新名称' },
        slug: { type: 'string', description: '新 slug' },
        description: { type: 'string', description: '分类描述' },
        icon: { type: 'string', description: '分类图标：内置图标 key（同 blog_create_category）或完整 <svg> 字符串' },
        sort: { type: 'number', description: '排序权重，小的在前' },
      },
      required: ['idOrSlug'],
    },
  },
  {
    name: 'blog_delete_category',
    description: '删除分类。若仍有文章使用该分类会拒绝并提示先改文章；可传 confirmName 做二次确认（必须与分类名称一致）。',
    inputSchema: {
      type: 'object',
      properties: {
        idOrSlug: { type: 'string', description: '分类 id、slug 或名称（必填）' },
        confirmName: { type: 'string', description: '传入分类准确名称；不一致时拒绝删除' },
      },
      required: ['idOrSlug'],
    },
  },
  {
    name: 'blog_search_posts',
    description: '站内全文搜索（标题/摘要/分类/标签/正文打分排序，返回前 20 条摘要，含草稿）。',
    inputSchema: {
      type: 'object',
      properties: { q: { type: 'string', description: '搜索关键词（必填）' } },
      required: ['q'],
    },
  },
];

/* ------------------------------------------------------------------ */
/* 极简 MCP Streamable HTTP（无状态 JSON 模式，手写 JSON-RPC 2.0）      */
/* ------------------------------------------------------------------ */

const PROTOCOL_VERSION = '2025-06-18';
const SUPPORTED_PROTOCOL_VERSIONS = ['2024-11-05', '2025-03-26', '2025-06-18'];
const SERVER_INFO = { name: 'edgeone-blog', version: '1.0.0' };
const SERVER_INSTRUCTIONS = 'EdgeOne Blog 管理工具集：可对博客文章做增删改查、分类/标签查询与全文搜索。删除操作不可逆，执行前务必与用户确认标题。';

const RPC = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
};

function rpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}
function rpcFail(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: '2.0', id, error };
}

/**
 * 处理单条 JSON-RPC 消息。通知（无 id）返回 null（HTTP 层回 202 空体）。
 * 导出供 /api/diag-sdk 与本地测试直接驱动协议往返。
 */
export async function _dispatchMcp(message, env) {
  if (!message || typeof message !== 'object') {
    return rpcFail(null, RPC.INVALID_REQUEST, 'Invalid Request');
  }
  if (message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return rpcFail(message && message.id !== undefined ? message.id : null, RPC.INVALID_REQUEST, 'Invalid Request');
  }
  const id = message.id === undefined ? null : message.id;
  const isNotification = message.id === undefined || message.id === null;
  const { method, params } = message;

  switch (method) {
    case 'initialize': {
      const requested = params && params.protocolVersion;
      const version = SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSION;
      return rpcResult(id, {
        protocolVersion: version,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions: SERVER_INSTRUCTIONS,
      });
    }
    case 'notifications/initialized':
    case 'notifications/cancelled':
    case 'notifications/progress':
      return null; // 通知：不产生响应，HTTP 层回 202
    case 'ping':
      return rpcResult(id, {});
    case 'tools/list':
      return rpcResult(id, { tools: TOOL_DEFS });
    case 'tools/call': {
      const name = params && params.name;
      const args = (params && params.arguments) || {};
      const tool = TOOLS[name];
      let payload;
      if (!tool) {
        payload = ERR_TEXT(`未知工具：${name}`);
      } else {
        try {
          payload = await tool(env, args);
        } catch (e) {
          payload = ERR_TEXT(e && e.message ? e.message : String(e));
        }
      }
      return isNotification ? null : rpcResult(id, payload);
    }
    default:
      return rpcFail(id, RPC.METHOD_NOT_FOUND, `Method not found: ${method}`);
  }
}

/** JSON-RPC 响应包装：带 MCP-Protocol-Version 与 CORS 头 */
function rpcResponse(payload, status = 200) {
  return new Response(payload === null || payload === undefined ? null : JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'MCP-Protocol-Version': PROTOCOL_VERSION,
      ...CORS_HEADERS,
    },
  });
}

async function handleMcpPost(request, env) {
  const contentType = String(request.headers.get('content-type') || '');
  if (!contentType.includes('application/json')) {
    return jsonError(415, 'Content-Type 必须为 application/json');
  }
  const auth = await verifyMcpBearer(request, env);
  if (!auth.ok) {
    return jsonError(auth.status || 401, auth.message, { headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' } });
  }
  let raw;
  try {
    raw = await request.text();
  } catch {
    return jsonError(400, '请求体读取失败');
  }
  if (raw.length > 1024 * 1024) return jsonError(413, '请求体过大（上限 1MB）');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return rpcResponse(rpcFail(null, RPC.PARSE_ERROR, 'Parse error'));
  }

  if (Array.isArray(parsed)) {
    const results = [];
    for (const item of parsed) {
      const r = await _dispatchMcp(item, env);
      if (r) results.push(r);
    }
    return results.length ? rpcResponse(results) : rpcResponse(null, 202);
  }
  const result = await _dispatchMcp(parsed, env);
  return result ? rpcResponse(result) : rpcResponse(null, 202);
}

/* ---------------- Edge Functions 入口（路由 /mcp） ---------------- */

export const onRequestPost = withErrorGuard(
  (context) => handleMcpPost(context.request, context.env),
  'mcp',
);

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet() {
  // 本端点无状态、不开 SSE 订阅流；GET 仅作为服务探活提示
  return jsonError(405, 'MCP endpoint 使用 Streamable HTTP：请向 /mcp 发送 POST（Authorization: Bearer <API Key>）', { headers: { Allow: 'POST, OPTIONS, DELETE' } });
}

export async function onRequestDelete() {
  return jsonError(405, '无状态端点不支持 DELETE 会话关闭', { headers: { Allow: 'POST, OPTIONS' } });
}
