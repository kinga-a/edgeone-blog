import { json, fail, readJson } from '../_lib/response.js';
import { requireAdmin } from '../_lib/auth.js';
import { utf8Base64 } from '../_lib/backup.js';

/**
 * POST /api/backup/webdav-test — 测试 WebDAV 连通性（管理员）
 * 使用请求体中传入的表单当前值（无需先保存配置）。
 * 优先 OPTIONS（WebDAV 能力探测），服务器不支持时退化为 HEAD。
 * 返回友好分类：连通正常 / 认证失败 / 无权限 / 路径不存在 / 网络错误。
 */
export async function onRequestPost({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return fail(401, '未登录或登录已过期');

  const body = await readJson(request).catch(() => ({}));
  const url = String(body?.webdavUrl || '').trim();
  if (!url) return fail(400, '请先填写 WebDAV 地址');

  const headers = {};
  const username = String(body?.webdavUsername || '').trim();
  const password = String(body?.webdavPassword || '');
  if (username) {
    headers.Authorization = `Basic ${utf8Base64(`${username}:${password}`)}`;
  }

  // 1) OPTIONS：探测服务器 WebDAV 能力
  let res;
  let usedMethod = 'OPTIONS';
  try {
    res = await fetch(url, { method: 'OPTIONS', headers });
  } catch (e) {
    return fail(502, `无法连接 WebDAV 服务器：${e.message || '网络错误'}`);
  }
  // 2) 服务器明确不支持 OPTIONS 时退化为 HEAD
  if (res.status === 405 || res.status === 501) {
    usedMethod = 'HEAD';
    try {
      res = await fetch(url, { method: 'HEAD', headers });
    } catch (e) {
      return fail(502, `无法连接 WebDAV 服务器：${e.message || '网络错误'}`);
    }
  }

  const status = res.status;
  const allow = res.headers.get('allow') || '';
  const detail = (await res.text().catch(() => '')).slice(0, 120);

  if (status >= 200 && status < 300) {
    const allowTip = allow.includes('PUT')
      ? '服务器支持 PUT 推送'
      : allow
        ? `服务器支持：${allow.slice(0, 80)}`
        : '服务器响应正常';
    return json({ ok: true, status, message: `${allowTip}（${usedMethod} ${status}）` });
  }

  const msg =
    status === 401
      ? '认证失败：用户名或密码错误'
      : status === 403
        ? '无权限访问该路径（认证可能通过，但无权写入）'
        : status === 404
          ? '路径不存在：文件尚未创建（推送时自动创建，属正常情况）'
          : status >= 500
            ? `WebDAV 服务器错误（HTTP ${status}）`
            : `WebDAV 返回异常（HTTP ${status}）`;
  return fail(400, `${msg}${detail ? `：${detail}` : ''}`);
}

export const onRequest = onRequestPost;
