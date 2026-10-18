/**
 * 通用工具：ID 生成、时间、slug、阅读时长
 */

/** 随机十六进制 token / id。首选运行时的 crypto；均不可用时走时间+Math 混合兜底（防 545，见下方注释） */
export function uid(bytes = 16) {
  const buf = randomBytes(bytes);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** @returns {Uint8Array} 指定长度随机字节 */
export function randomBytes(n) {
  const out = new Uint8Array(n);
  const c = globalThis.crypto;
  if (typeof c?.getRandomValues === 'function') {
    try { return c.getRandomValues(out); } catch { /* 继续降级 */ }
  }
  // 最后兜底：混入时间戳熵的 Math.random（仅老/裁剪运行时可达；正常 Pages/Node19+ 不会走到）
  let seed = Date.now() >>> 0;
  for (let i = 0; i < n; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    out[i] = (Math.floor(Math.random() * 256) ^ ((seed >>> (i % 24)) & 0xff)) & 0xff;
  }
  return out;
}

/** 当前 ISO 时间 */
export function nowIso() {
  return new Date().toISOString();
}

/**
 * slug 化：仅保留 ASCII 字母数字，其余字符（含中文）折叠为 '-'，首尾去除。
 * 中文等非 ASCII 内容会得到空字符串 —— 调用方必须兜底（用随机 id 等），
 * 因为非 ASCII slug 在 URL 路由中存在编码兼容问题，无法稳定访问。
 */
export function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** 根据 Markdown 正文估算阅读时长（分钟），中文按 300 字/分钟 */
export function readingTime(markdown) {
  if (!markdown) return 1;
  const text = String(markdown)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#>*\-|]/g, ' ');
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const words = (text.match(/[a-zA-Z0-9]+/g) || []).length;
  const minutes = Math.ceil(cjk / 300 + words / 200);
  return Math.max(1, minutes);
}

/** 格式化日期：2026-09-28 */
export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
