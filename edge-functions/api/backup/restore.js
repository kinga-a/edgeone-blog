import { json, fail, readJson } from '../_lib/response.js';
import { requireAdmin } from '../_lib/auth.js';
import { restoreFromPayload } from '../_lib/backup.js';

/**
 * POST /api/backup/restore — 从上传的 JSON 备份恢复 KV 数据（管理员）
 * 请求体：完整的备份 payload（version 1，含 data 对象）
 * 合并式恢复：同键覆盖，备份中不存在的键保持不变；跳过会话键。
 */
export async function onRequestPost({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  const body = await readJson(request);
  if (!body) return fail(400, '请求体无效：请上传 JSON 备份文件内容');
  try {
    return json(await restoreFromPayload(env, body));
  } catch (e) {
    return fail(400, e.message || '恢复失败');
  }
}

export const onRequest = onRequestPost;
