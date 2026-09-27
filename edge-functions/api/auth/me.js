import { json } from '../_lib/response.js';
import { requireAdmin, getAdmin } from '../_lib/auth.js';

/** GET /api/auth/me — 当前登录状态（含 TOTP 是否已启用） */
export async function onRequestGet({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return json({ ok: false, username: null, totpEnabled: false });
  const account = await getAdmin(env);
  return json({ ok: true, username: admin.username, totpEnabled: Boolean(account && account.totpEnabled) });
}

export const onRequest = onRequestGet;
