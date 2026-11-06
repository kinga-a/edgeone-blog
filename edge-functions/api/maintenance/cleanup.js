import { json, fail, withErrorGuard } from '../_lib/response.js';
import { requireAdmin } from '../_lib/auth.js';
import { getKv, purgeExpiredRateKeysAndSessions } from '../_lib/kv.js';

/**
 * POST /api/maintenance/cleanup — 清理 KV 中的过期键（管理员）
 *
 * 清理范围：
 *  - rate_<ymd>_ 前缀：日期分区限速键，窗口过期后即无意义（EdgeOne KV 无自动 TTL）
 *  - auth_session_ 前缀：过期管理员会话（平时仅被访问时惰性删除，长期不看后台会残留）
 *
 * 建议低频调用（如每周一次的定时任务 / 手动触发），属幂等安全操作。
 * 可选 query 参数 days：rate 键保留天数（默认 2）。
 */
async function handleCleanup({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');
  const days = Number(new URL(request.url).searchParams.get('days'));
  const retention = Number.isFinite(days) && days >= 1 && days <= 30 ? days : 2;
  const kv = getKv(env);
  const purged = await purgeExpiredRateKeysAndSessions(kv, retention);
  return json({ ok: true, purged, retentionDays: retention }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export const onRequestPost = withErrorGuard(handleCleanup, 'maintenance-cleanup');
export const onRequest = onRequestPost;
