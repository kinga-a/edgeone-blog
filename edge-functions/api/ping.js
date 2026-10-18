/**
 * GET /api/ping — 版本信标（零依赖：不 import 任何本地/三方模块，纯内联返回）
 *
 * 用途：区分「新版未部署成功」与「新版已部署但模块链路异常」——
 * - 返回 200 且 ver=compat-v3.1：新代码已在跑，其它接口的问题在其自身依赖链
 * - 返回 545/404：线上仍是旧构建（push 未触发部署 / 构建失败）
 * 注意：本端点不依赖 KV，任何绑定缺失都不应影响它；若仅它 200 而同站 /api/config 545 → 缺 KV 绑定实锤。
 */
export async function onRequestGet() {
  const hasCrypto = typeof globalThis.crypto !== 'undefined';
  return new Response(
    JSON.stringify({
      ok: true,
      ver: 'compat-v3.1',
      runtime: {
        hasGlobalCrypto: hasCrypto,
        hasSubtle: hasCrypto && !!(globalThis.crypto || {}).subtle,
        hasGetRandomValues: hasCrypto && typeof (globalThis.crypto || {}).getRandomValues === 'function',
        hasProcess: typeof process !== 'undefined',
        nodeVersion: typeof process !== 'undefined' ? process.version : null,
      },
      ts: new Date().toISOString(),
    }),
    { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } },
  );
}

export const onRequest = onRequestGet;
