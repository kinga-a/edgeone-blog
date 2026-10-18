/**
 * WebCrypto 兼容层：检测当前函数运行时的 crypto 能力，缺失则补齐最小实现。
 *
 * 背景（线上实测）：EdgeOne Pages（workerd）WebCrypto 完整；但容器/老 Node 形态
 * （<19 无全局 crypto，或 subtle 缺 PBKDF2/HMAC）会让 auth/MCP 代码抛未捕获异常，
 * 平台表现为 545。此模块在任何入口最先 import（见 mcp.js / api/auth/login.js）。
 *
 * 补齐范围（只补"确定性缺失"的最小面，算法兜底由 crypto-soft + 调用侧降级负责）：
 * - globalThis.crypto 不存在 → 建对象
 * - getRandomValues 缺失 → 用 Math.random 兜底（仅老运行时；新运行时不走此分支）
 * - randomUUID 缺失 → 基于 getRandomValues 生成 v4
 *
 * subtle 不伪造：auth.js 对所有 subtle 调用做了「web 失败自动降 soft」处理。
 */
import { toHex } from './crypto-soft.js';

export function ensureCrypto() {
  if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto) {
    try { globalThis.crypto = {}; } catch { /* 极少数环境全局不可写，忽略 */ }
  }
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues !== 'function') {
    try {
      c.getRandomValues = (buf) => {
        const view = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
        for (let i = 0; i < view.length; i++) view[i] = Math.floor(Math.random() * 256);
        buf.set(view);
        return buf;
      };
    } catch { /* ignore */ }
  }
  if (c && typeof c.randomUUID !== 'function' && typeof c.getRandomValues === 'function') {
    try {
      c.randomUUID = () => {
        const b = new Uint8Array(16);
        c.getRandomValues(b);
        b[6] = (b[6] & 0x0f) | 0x40;
        b[8] = (b[8] & 0x3f) | 0x80;
        const h = toHex(b);
        return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
      };
    } catch { /* ignore */ }
  }
}

ensureCrypto();

/** 是否存在可用的 WebCrypto 对象 */
export const hasWebCrypto = typeof globalThis.crypto?.subtle !== 'undefined';

/** 探测 WebCrypto 是否真正支持 PBKDF2（结果缓存） */
let pbkdf2Support;
export async function webcryptoPbkdf2() {
  if (pbkdf2Support !== undefined) return pbkdf2Support;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle?.importKey) return (pbkdf2Support = false);
  try {
    const key = await subtle.importKey('raw', new TextEncoder().encode('probe'), 'PBKDF2', false, ['deriveBits']);
    await subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode('salt'), iterations: 1, hash: 'SHA-256' }, key, 32);
    pbkdf2Support = true;
  } catch {
    pbkdf2Support = false;
  }
  return pbkdf2Support;
}

/** 探测 WebCrypto 是否支持 HMAC-SHA1（TOTP 依赖，结果缓存） */
let hmackSha1Support;
export async function webcryptoHmacSha1() {
  if (hmackSha1Support !== undefined) return hmackSha1Support;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle?.importKey || !subtle?.sign) return (hmackSha1Support = false);
  try {
    const key = await subtle.importKey('raw', new Uint8Array([1, 2, 3]), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    await subtle.sign('HMAC', key, new Uint8Array(0));
    hmackSha1Support = true;
  } catch {
    hmackSha1Support = false;
  }
  return hmackSha1Support;
}

/** 运行时环境描述（/api/diag 消费） */
export function runtimeInfo() {
  const subtle = globalThis.crypto?.subtle;
  return {
    nodeVersion: typeof process !== 'undefined' ? process.version : null,
    nodeEnv: typeof process !== 'undefined' ? process.env?.NODE_ENV ?? null : null,
    hasGlobalCrypto: typeof globalThis.crypto !== 'undefined',
    hasSubtle: Boolean(subtle),
    subtleDigest: typeof subtle?.digest === 'function',
    subtleImportKey: typeof subtle?.importKey === 'function',
    subtleSign: typeof subtle?.sign === 'function',
    hasRandomUUID: typeof globalThis.crypto?.randomUUID === 'function',
    hasTextEncoder: typeof TextEncoder !== 'undefined',
    hasReadableStream: typeof ReadableStream !== 'undefined',
    hasStructuredClone: typeof structuredClone !== 'undefined',
    hasFetch: typeof fetch !== 'undefined',
  };
}
