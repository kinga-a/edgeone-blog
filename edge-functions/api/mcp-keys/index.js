import { json, fail, readJson } from '../_lib/response.js';
import { requireAdmin } from '../_lib/auth.js';
import { listMcpKeys, createMcpKey } from '../_lib/mcp-auth.js';

/**
 * MCP API Key 管理（后台管理员专用，Cookie 会话鉴权）
 * GET  /api/mcp-keys — 列出全部 Key（不含哈希与明文）
 * POST /api/mcp-keys — 创建 Key，body: { label }，返回的 token 明文仅此一次
 */
export async function onRequestGet({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  const items = await listMcpKeys(env);
  return json({ ok: true, items });
}

export async function onRequestPost({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  const body = (await readJson(request)) || {};
  const { token, hash, ...meta } = await createMcpKey(env, body.label);
  return json({
    ok: true,
    key: meta,
    token,
    warning: 'token 明文仅此一次返回，请立即保存；MCP 客户端以 Authorization: Bearer <token> 方式调用 /mcp',
  }, { status: 201 });
}
