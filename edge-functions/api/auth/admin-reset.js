import { json, fail, readJson, withErrorGuard } from '../_lib/response.js';
import { upsertAdmin } from '../_lib/auth.js';

/**
 * POST /api/auth/admin-reset — 引导式管理员密码重置（运维/排障用）
 *
 * 用途：当哈希算法参数（如 PBKDF2 迭代次数）调整后，存量管理员哈希无法再被校验，
 * 需要以新参数重新哈希密码。为避免开放一个“任何人可重置管理员”的裸端点，本端点
 * 仅在满足以下条件时才执行：
 *   - 项目环境变量已设置 ADMIN_RESET_TOKEN（非空）
 *   - 请求头 x-admin-reset-token 的值与该环境变量完全一致
 *
 * 未配置环境变量或令牌不匹配时恒返回 403。排障完成后建议删除该环境变量（端点保留但永久失效）。
 * 请求体：{ "username": "king", "password": "新密码" }
 */
async function handleReset({ request, env }) {
  const expected = String(env.ADMIN_RESET_TOKEN || '');
  if (!expected) return fail(403, '重置未授权：未配置 ADMIN_RESET_TOKEN 环境变量');
  const provided = String(request.headers.get('x-admin-reset-token') || '');
  if (provided !== expected) return fail(403, '重置未授权：x-admin-reset-token 不匹配');

  const body = await readJson(request);
  const username = String(body?.username || '').trim();
  const password = String(body?.password || '');
  if (!username || username.length < 2) return fail(400, '用户名至少 2 个字符');
  if (!password || password.length < 8) return fail(400, '密码至少 8 个字符');

  await upsertAdmin(env, { username, password });
  return json({ ok: true, message: '管理员密码已重置，请重新登录' });
}

export const onRequestPost = withErrorGuard(handleReset, 'admin-reset');
export const onRequest = onRequestPost;
