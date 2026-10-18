import { json } from './_lib/response.js';
import { withErrorGuard } from './_lib/response.js';
import { runtimeInfo, webcryptoPbkdf2, webcryptoHmacSha1 } from './_lib/crypto-polyfill.js';
import { sha256, sha1, toHex, pbkdf2Sha256 } from './_lib/crypto-soft.js';

/**
 * GET /api/diag — 临时诊断端点（排障用，上线稳定后可删除）
 * 只返回运行时能力与算法自检结果，不含任何密钥数据。
 */
async function handleGet() {
  const info = runtimeInfo();
  const enc = new TextEncoder();
  const soft = {
    sha256: toHex(sha256(enc.encode('abc'))),
    sha256ok: toHex(sha256(enc.encode('abc'))) === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    sha1ok: toHex(sha1(enc.encode('abc'))) === 'a9993e364706816ab3e30773386c4ea7c9b0d8',
  };
  // 纯 JS PBKDF2 1000 次耗时（估算 100000 次全量成本：×100）
  let softTimeMs = null;
  try {
    const t0 = Date.now();
    toHex(pbkdf2Sha256('probe-password', 'probe-salt', 1000, 32));
    softTimeMs = Date.now() - t0;
  } catch (e) { soft.softErr = String(e?.message || e); }

  // WebCrypto PBKDF2（如可用，验证与 soft 结果一致）
  let web = null;
  try {
    if (await webcryptoPbkdf2()) {
      const t0 = Date.now();
      const key = await crypto.subtle.importKey('raw', enc.encode('probe-password'), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode('probe-salt'), iterations: 1000, hash: 'SHA-256' }, key, 256);
      web = { available: true, timeMs: Date.now() - t0, matchesSoft: toHex(new Uint8Array(bits)) === toHex(pbkdf2Sha256('probe-password', 'probe-salt', 1000, 32)) };
    } else {
      web = { available: false };
    }
  } catch (e) { web = { available: false, error: String(e?.message || e) }; }

  let totpHmac = null;
  try { totpHmac = { webcryptoHmacSha1: await webcryptoHmacSha1() }; } catch (e) { totpHmac = { error: String(e?.message || e) }; }

  return json({ ok: true, runtime: info, softTest: soft, webPbkdf2: web, totp: totpHmac, softEstFullHashMs: softTimeMs != null ? softTimeMs * 100 : null });
}

export const onRequestGet = withErrorGuard(handleGet, 'diag');
