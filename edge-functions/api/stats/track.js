import { json, fail, readJson, publicHeaders } from '../_lib/response.js';
import { trackVisit } from '../_lib/data.js';
import { getKv, Keys, rateLimitHit } from '../_lib/kv.js';
import { clientIp } from '../_lib/auth.js';

/** 访问埋点限速：同 IP 每分钟最多 60 次，防刷量污染统计与 KV 膨胀 */
const VISIT_LIMIT = 60;
const VISIT_WINDOW_MS = 60 * 1000;

/**
 * POST /api/stats/track — 访问埋点
 * 请求：{ type: 'visit' }（站点访问；文章阅读走 /api/posts/:id/view）
 * 仅开放 POST，避免 GET/img 等被跨站静默触发计数（CSRF）。
 */
export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const type = body?.type || 'visit';
  if (type !== 'visit') return fail(400, '不支持的统计类型');
  const hit = await rateLimitHit(getKv(env), Keys.rateLimit('visit', clientIp(request)), VISIT_LIMIT, VISIT_WINDOW_MS);
  if (!hit.ok) return json({ ok: true }, { headers: publicHeaders() });
  const stats = await trackVisit(env);
  return json({ ok: true, stats }, { headers: publicHeaders() });
}