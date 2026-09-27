/**
 * 统一响应工具：JSON 序列化、错误处理、CORS、OPTIONS 预检
 */

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

/** JSON 成功响应 */
export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status || 200,
    headers: { ...JSON_HEADERS, ...(init.headers || {}) },
  });
}

/** JSON 错误响应 */
export function fail(status, message, extra) {
  return json({ ok: false, error: message, ...(extra || {}) }, { status });
}

/** 请求体 JSON 解析失败兜底 */
export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** 从请求 URL 解析查询参数对象 */
export function parseSearchParams(url) {
  const out = {};
  try {
    const params = new URL(url).searchParams;
    for (const [k, v] of params.entries()) out[k] = v;
  } catch {
    // URL 解析失败时退回字符串解析
    const idx = url.indexOf('?');
    if (idx !== -1) {
      for (const pair of url.slice(idx + 1).split('&')) {
        const eq = pair.indexOf('=');
        if (eq > 0) out[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1));
        else if (pair) out[decodeURIComponent(pair)] = '';
      }
    }
  }
  return out;
}

/** 整数值解析，非法返回默认值 */
export function intParam(value, def = 0) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : def;
}

/** 为公开只读接口附加宽松 CORS（允许跨域访问博客 API） */
export function publicHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  };
}

/** 通用 OPTIONS 预检处理 */
export function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
