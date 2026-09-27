import { json, fail, readJson, publicHeaders } from '../_lib/response.js';
import { trackVisit } from '../_lib/data.js';

/**
 * POST /api/stats/track — 访问埋点
 * 请求：{ type: 'visit' }（站点访问；文章阅读走 /api/posts/:id/view）
 */
export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const type = body?.type || 'visit';
  if (type !== 'visit') return fail(400, '不支持的统计类型');
  const stats = await trackVisit(env);
  return json({ ok: true, stats }, { headers: publicHeaders() });
}

export const onRequest = onRequestPost;
