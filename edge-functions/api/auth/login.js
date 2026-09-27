import { json, fail, readJson } from '../_lib/response.js';
import { verifyAdmin, createSession } from '../_lib/auth.js';

/** POST /api/auth/login — 管理员登录 */
export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body || !body.username || !body.password) return fail(400, '请输入用户名和密码');
  const ok = await verifyAdmin(env, body.username, body.password);
  if (!ok) return fail(401, '用户名或密码错误');
  const { cookie } = await createSession(env, String(body.username).trim());
  return json({ ok: true, username: String(body.username).trim() }, {
    headers: { 'Set-Cookie': cookie, 'Cache-Control': 'no-store' },
  });
}

export const onRequest = onRequestPost;
