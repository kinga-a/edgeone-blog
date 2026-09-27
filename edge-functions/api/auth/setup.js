import { json, fail, readJson } from '../_lib/response.js';
import { hasAdmin, upsertAdmin } from '../_lib/auth.js';

/**
 * POST /api/auth/setup — 首次部署初始化管理员账号
 * 仅在系统尚未创建管理员时可用；创建后即关闭。
 */
export async function onRequestPost({ request, env }) {
  if (await hasAdmin(env)) return fail(403, '管理员账号已存在，请直接登录');
  const body = await readJson(request);
  const username = String(body?.username || '').trim();
  const password = String(body?.password || '');
  if (!username || username.length < 2) return fail(400, '用户名至少 2 个字符');
  if (!password || password.length < 8) return fail(400, '密码至少 8 个字符');
  await upsertAdmin(env, { username, password });
  return json({ ok: true, message: '管理员创建成功，请登录' });
}

export const onRequest = onRequestPost;
