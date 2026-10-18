import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { json } from './_lib/response.js';

/**
 * GET /api/diag-sdk — 临时诊断端点：验证 MCP SDK 在本运行时能否完成 import、
 * 构造 Server、挂上一个空 tools handler、通过 WebStandard transport 完成一次
 * initialize + tools/list 真实协议往返。
 * 若本路径 545 → SDK 模块加载在你的运行时就是坏的（需要 vendored 协议壳方案）。
 */
export async function onRequestGet() {
  const base = { ok: true, sdkServerLoaded: typeof Server === 'function' };
  try {
    const server = new Server({ name: 'diag', version: '1.0.0' }, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [] }));
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    const initReq = new Request('http://diag.local/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'diag', version: '1.0.0' } } }),
    });
    const res = await transport.handleRequest(initReq);
    const text = await res.text();
    return json({ ...base, transportConstruct: 'connect-ok', initializeStatus: res.status, initializeBodyHead: text.slice(0, 160) });
  } catch (e) {
    return json({ ...base, transportConstruct: 'FAILED', error: `${e?.name}: ${String(e?.message || e).slice(0, 300)}` });
  }
}
