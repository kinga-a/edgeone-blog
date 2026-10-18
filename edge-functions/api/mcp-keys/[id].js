import { json, fail } from '../_lib/response.js';
import { requireAdmin } from '../_lib/auth.js';
import { revokeMcpKey } from '../_lib/mcp-auth.js';

/**
 * DELETE /api/mcp-keys/:id — 吊销指定 MCP API Key（后台管理员专用）
 */
export async function onRequestDelete({ request, env, params }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  const removed = await revokeMcpKey(env, params.id);
  if (!removed) return fail(404, 'Key 不存在');
  return json({ ok: true, revoked: params.id });
}
