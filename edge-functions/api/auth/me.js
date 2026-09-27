import { json } from '../_lib/response.js';
import { requireAdmin } from '../_lib/auth.js';

/** GET /api/auth/me — 当前登录状态 */
export async function onRequestGet({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return json({ ok: false, username: null });
  return json({ ok: true, username: admin.username });
}

export const onRequest = onRequestGet;
