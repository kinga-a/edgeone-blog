import { _dispatchMcp } from '../mcp.js';
import { json } from './_lib/response.js';

/**
 * GET /api/diag-sdk — 临时诊断端点：验证极简 MCP 协议实现（零重依赖，无 SDK）能否在
 * 当前运行时完成 initialize + ping + tools/list 一次真实协议往返。
 * 若本路径 545 → 函数运行时/部署整体有问题（而非 SDK 依赖）。
 */
export async function onRequestGet() {
  const base = { ok: true, mcpProtocol: 'vendored-jsonrpc-no-sdk' };
  try {
    const init = await _dispatchMcp(
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'diag', version: '1.0.0' } } },
      {},
    );
    const list = await _dispatchMcp({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, {});
    const ping = await _dispatchMcp({ jsonrpc: '2.0', id: 3, method: 'ping', params: {} }, {});
    return json({
      ...base,
      initializeOk: Boolean(init && init.result && init.result.protocolVersion),
      negotiatedVersion: init && init.result && init.result.protocolVersion,
      toolsCount: list && list.result && Array.isArray(list.result.tools) ? list.result.tools.length : -1,
      pingOk: Boolean(ping && ping.result && typeof ping.result === 'object'),
      serverInfo: init && init.result && init.result.serverInfo,
    });
  } catch (e) {
    return json({ ...base, dispatch: 'FAILED', error: `${e && e.name}: ${String((e && e.message) || e).slice(0, 300)}` });
  }
}
