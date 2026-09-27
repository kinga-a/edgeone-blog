/**
 * 通用工具：ID 生成、时间、slug、阅读时长
 */

/** 随机十六进制 token / id（基于 Web Crypto） */
export function uid(bytes = 16) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** 当前 ISO 时间 */
export function nowIso() {
  return new Date().toISOString();
}

/**
 * slug 化：保留中英文与数字，其余连续字符折叠为 '-'，首尾去除。
 * 支持 Unicode 属性转义（\p{L} 字母，\p{N} 数字）。
 */
export function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
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
    .replace(/[#>\*\-\|]/g, ' ');
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
