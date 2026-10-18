/**
 * 纯 JS 密码学兜底实现：SHA-256 / SHA-1 / HMAC / PBKDF2-HMAC-SHA256。
 *
 * 背景：部分部署形态（如容器化 Node 运行时）不提供或不支持 WebCrypto 的
 * crypto.subtle PBKDF2，导致 auth/MCP 函数抛未捕获异常（平台表现为 545）。
 * 本模块零依赖、语义与 WebCrypto 一致，由 crypto-polyfill.js 在全局缺失时接管。
 *
 * SHA-256 的 K/H0 常量不作硬编码表，而是在模块初始化时按 FIPS 180-4 定义
 * （前 64 个质数立方根 / 前 8 个质数平方根的小数部分前 32 位）用 BigInt 生成，
 * 从根上排除手抄常量表的笔误风险；测试脚本已将其与真实 SHA-256 逐向量对拍。
 */

/* ---------------- 常量生成（FIPS 180-4） ---------------- */

function firstPrimes(n) {
  const out = [];
  for (let x = 2; out.length < n; x++) {
    let prime = true;
    for (let d = 2; d * d <= x; d++) if (x % d === 0) { prime = false; break; }
    if (prime) out.push(x);
  }
  return out;
}

function isqrt(x) {
  if (x < 2n) return x;
  let y = (x + 1n) >> 1n;
  let z = x;
  while (y < z) { z = y; y = ((x / y) + y) >> 1n; }
  return z;
}

function icbrt(x) {
  if (x < 2n) return x;
  let y = 1n << ((BigInt(x.toString(2).length) + 2n) / 3n);
  for (;;) {
    const ny = (2n * y + x / (y * y)) / 3n;
    if (ny >= y) break;
    y = ny;
  }
  while ((y + 1n) * (y + 1n) * (y + 1n) <= x) y += 1n;
  while (y * y * y > x) y -= 1n;
  return y;
}

/** 质数 p 平方根小数部分前 32 位 */
function fracSqrtBits32(p) {
  const S = 64n; // 足够精度
  const y = isqrt(BigInt(p) << (2n * S));
  return Number((y >> (S - 32n)) & 0xffffffffn);
}

/** 质数 p 立方根小数部分前 32 位 */
function fracCbrtBits32(p) {
  const S = 48n;
  const y = icbrt(BigInt(p) << (3n * S));
  return Number((y >> (S - 32n)) & 0xffffffffn);
}

const SHA256_K = (() => {
  const primes = firstPrimes(64);
  const arr = new Uint32Array(64);
  for (let i = 0; i < 64; i++) arr[i] = fracCbrtBits32(primes[i]);
  return arr;
})();

const SHA256_H0 = (() => {
  const primes = firstPrimes(8);
  const arr = new Uint32Array(8);
  for (let i = 0; i < 8; i++) arr[i] = fracSqrtBits32(primes[i]);
  return arr;
})();

/* ---------------- SHA-256 ---------------- */

function rotr32(x, n) { return ((x >>> n) | (x << (32 - n))) >>> 0; }

function rotl32(x, n) { return ((x << n) | (x >>> (32 - n))) >>> 0; }

/** @param {Uint8Array} msg @returns {Uint8Array} 32 字节摘要 */
export function sha256(msg) {
  const H = SHA256_H0.slice();
  const l = msg.length;
  const total = l + 9;
  const blocks = Math.ceil(total / 64);
  const buf = new Uint8Array(blocks * 64);
  buf.set(msg);
  buf[l] = 0x80;
  const dv = new DataView(buf.buffer);
  const bitLenHi = Math.floor(l / 536870912); // l*8 / 2^32
  dv.setUint32(buf.length - 8, bitLenHi, false);
  dv.setUint32(buf.length - 4, (l << 3) >>> 0, false);

  const w = new Uint32Array(64);
  for (let b = 0; b < blocks; b++) {
    const base = b * 64;
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(base + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15]; const y = w[i - 2];
      const s0 = (rotr32(x, 7) ^ rotr32(x, 18) ^ (x >>> 3)) >>> 0;
      const s1 = (rotr32(y, 17) ^ rotr32(y, 19) ^ (y >>> 10)) >>> 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = H[0]; let bb = H[1]; let c = H[2]; let d = H[3];
    let e = H[4]; let f = H[5]; let g = H[6]; let h = H[7];
    for (let i = 0; i < 64; i++) {
      const S1 = (rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const t1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = (rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22)) >>> 0;
      const maj = ((a & bb) ^ (a & c) ^ (bb & c)) >>> 0;
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = bb; bb = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + bb) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  const out = new Uint8Array(32);
  const odv = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) odv.setUint32(i * 4, H[i], false);
  return out;
}

/* ---------------- SHA-1 ---------------- */

/** @param {Uint8Array} msg @returns {Uint8Array} 20 字节摘要 */
export function sha1(msg) {
  let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
  const l = msg.length;
  const buf = new Uint8Array(Math.ceil((l + 9) / 64) * 64);
  buf.set(msg);
  buf[l] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(buf.length - 8, Math.floor(l / 536870912), false);
  dv.setUint32(buf.length - 4, (l << 3) >>> 0, false);
  const w = new Uint32Array(80);
  for (let b = 0; b < buf.length / 64; b++) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(b * 64 + i * 4, false);
    for (let i = 16; i < 80; i++) w[i] = rotl32(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    let a = h0, b2 = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      const Kf = i < 20 ? 0x5A827999 : i < 40 ? 0x6ED9EBA1 : i < 60 ? 0x8F1BBCDC : 0xCA62C1D6;
      const f = i < 20 ? ((b2 & c) ^ (~b2 & d)) >>> 0 : i < 40 ? (b2 ^ c ^ d) >>> 0 : i < 60 ? ((b2 & c) ^ (b2 & d) ^ (c & d)) >>> 0 : (b2 ^ c ^ d) >>> 0;
      const t = (rotl32(a, 5) + f + e + Kf + w[i]) >>> 0;
      e = d; d = c; c = rotl32(b2, 30); b2 = a; a = t;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b2) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  const out = new Uint8Array(20);
  const odv = new DataView(out.buffer);
  [h0, h1, h2, h3, h4].forEach((x, i) => odv.setUint32(i * 4, x, false));
  return out;
}

/* ---------------- HMAC 与 PBKDF2 ---------------- */

function hmac(hashFn, hashLen, blockSize, key, msg) {
  let k = key;
  if (k.length > blockSize) k = hashFn(k);
  const pad = new Uint8Array(blockSize);
  pad.set(k);
  const innerKey = new Uint8Array(blockSize);
  const outerKey = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) { innerKey[i] = pad[i] ^ 0x36; outerKey[i] = pad[i] ^ 0x5c; }
  const inner = new Uint8Array(blockSize + msg.length);
  inner.set(innerKey); inner.set(msg, blockSize);
  const ih = hashFn(inner);
  const outer = new Uint8Array(blockSize + hashLen);
  outer.set(outerKey); outer.set(ih, blockSize);
  return hashFn(outer);
}

/** @param {Uint8Array|string} key @param {Uint8Array|string} msg -> 32 字节 */
export function hmacSha256Bytes(key, msg) {
  const k = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const m = typeof msg === 'string' ? new TextEncoder().encode(msg) : msg;
  return hmac(sha256, 32, 64, k, m);
}

/** @param {Uint8Array} key @param {Uint8Array} msg -> 20 字节 */
export function hmacSha1Bytes(key, msg) {
  return hmac(sha1, 20, 64, key, msg);
}

/** PBKDF2-HMAC-SHA256 -> Uint8Array(dkLen) */
export function pbkdf2Sha256(password, salt, iterations, dkLen = 32) {
  const p = typeof password === 'string' ? new TextEncoder().encode(password) : password;
  const s = typeof salt === 'string' ? new TextEncoder().encode(salt) : salt;
  const hLen = 32;
  const out = new Uint8Array(dkLen);
  const block = new Uint8Array(s.length + 4);
  block.set(s);
  const bdv = new DataView(block.buffer);
  for (let i = 1, off = 0; off < dkLen; i++) {
    bdv.setUint32(s.length, i, false);
    let u = hmac(sha256, hLen, 64, p, block);
    const t = u.slice();
    for (let j = 1; j < iterations; j++) {
      u = hmac(sha256, hLen, 64, p, u);
      for (let b = 0; b < hLen; b++) t[b] ^= u[b];
    }
    out.set(t.subarray(0, Math.min(hLen, dkLen - off)), off);
    off += hLen;
  }
  return out;
}

export function toHex(bytes) {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}
