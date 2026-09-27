import { json } from '../_lib/response.js';
import { destroySession } from '../_lib/auth.js';

/** POST /api/auth/logout — 退出登录 */
export async function onRequestPost({ request, env }) {
  const cookie = await destroySession(request, env);
  return json({ ok: true }, { headers: { 'Set-Cookie': cookie, 'Cache-Control': 'no-store' } });
}

export const onRequest = onRequestPost;
