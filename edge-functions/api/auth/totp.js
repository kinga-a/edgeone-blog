import { json, fail, readJson } from '../_lib/response.js';
import { requireAdmin, generateTotpSecret, totpUri, verifyTotp } from '../_lib/auth.js';
import { getKv, Keys, kvGetJson, kvPutJson } from '../_lib/kv.js';

/**
 * POST /api/auth/totp — TOTP 二次验证管理（管理员）
 * body.action:
 *  - setup   → 生成新密钥，返回 { secret, uri }（暂存 pending，尚未启用）
 *  - verify  → 提交 6 位验证码，校验通过后启用 TOTP
 *  - disable → 提交当前验证码，校验通过后关闭 TOTP
 */
export async function onRequestPost({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  const body = await readJson(request);
  if (!body || !body.action) return fail(400, '缺少操作类型');

  const kv = getKv(env);
  const current = (await kvGetJson(kv, Keys.authAdmin)) || {};
  const action = body.action;
  const now = new Date().toISOString();

  if (action === 'setup') {
    if (current.totpEnabled) return fail(400, 'TOTP 已启用，请先禁用后再重新设置');
    const secret = generateTotpSecret();
    current.totpPendingSecret = secret;
    current.updatedAt = now;
    await kvPutJson(kv, Keys.authAdmin, current);
    return json({ ok: true, secret, uri: totpUri(secret, current.username || 'admin') });
  }

  if (action === 'verify') {
    if (current.totpEnabled) return fail(400, 'TOTP 已启用');
    if (!current.totpPendingSecret) return fail(400, '请先生成 TOTP 密钥');
    const valid = await verifyTotp(current.totpPendingSecret, body.code);
    if (!valid) return fail(401, 'TOTP 验证码错误');
    current.totpSecret = current.totpPendingSecret;
    current.totpEnabled = true;
    delete current.totpPendingSecret;
    current.updatedAt = now;
    await kvPutJson(kv, Keys.authAdmin, current);
    return json({ ok: true, enabled: true });
  }

  if (action === 'disable') {
    if (!current.totpEnabled || !current.totpSecret) return fail(400, 'TOTP 未启用');
    const valid = await verifyTotp(current.totpSecret, body.code);
    if (!valid) return fail(401, 'TOTP 验证码错误');
    delete current.totpSecret;
    current.totpEnabled = false;
    current.updatedAt = now;
    await kvPutJson(kv, Keys.authAdmin, current);
    return json({ ok: true, enabled: false });
  }

  return fail(400, '未知操作');
}

export const onRequest = onRequestPost;
