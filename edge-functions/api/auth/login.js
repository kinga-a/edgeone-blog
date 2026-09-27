import { json, fail, readJson } from '../_lib/response.js';
import { verifyAdmin, createSession, getAdmin, verifyTotp } from '../_lib/auth.js';

/**
 * POST /api/auth/login — 管理员登录（支持 TOTP 两步验证）
 * 请求：{ username, password, totp? }
 * 若已启用 TOTP 且未提供验证码 → 返回 { ok:true, totpRequired:true }，客户端补充 totp 后再次提交
 */
export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body || !body.username || !body.password) return fail(400, '请输入用户名和密码');
  const ok = await verifyAdmin(env, body.username, body.password);
  if (!ok) return fail(401, '用户名或密码错误');

  const admin = await getAdmin(env);
  const totpEnabled = Boolean(admin && admin.totpEnabled && admin.totpSecret);
  const code = String(body.totp || '').replace(/\s/g, '');

  if (totpEnabled) {
    if (!code) {
      return json({ ok: true, totpRequired: true, username: String(body.username).trim() }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    const valid = await verifyTotp(admin.totpSecret, code);
    if (!valid) return fail(401, 'TOTP 验证码错误');
  }

  const { cookie } = await createSession(env, String(body.username).trim());
  return json({ ok: true, username: String(body.username).trim(), totpRequired: false }, {
    headers: { 'Set-Cookie': cookie, 'Cache-Control': 'no-store' },
  });
}

export const onRequest = onRequestPost;
