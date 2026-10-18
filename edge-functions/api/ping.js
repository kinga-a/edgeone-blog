/**
 * GET /api/ping — 健康检查信标（零依赖：不 import 任何本地/三方模块，纯内联返回）
 *
 * 用途：外部监控 / 部署验证。返回 200 且 ver 为当前版本即新构建已上线；
 * 若它 200 而同站其它 /api 异常 → 问题在具体依赖链（如 KV 绑定），不是部署缺失。
 * 注意：本端点不依赖 KV，也不回显任何环境变量 / 运行时细节（信息最小化）。
 */
export async function onRequestGet() {
  return new Response(
    JSON.stringify({
      ok: true,
      ver: 'v1',
      ts: new Date().toISOString(),
    }),
    { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } },
  );
}

export const onRequest = onRequestGet;
