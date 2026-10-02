/** 通用前端工具函数 */

/** classnames 简写 */
export function cx(...args: Array<string | false | null | undefined>): string {
  return args.filter(Boolean).join(' ');
}

/** 格式化日期：2026-09-28 */
export function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 相对时间：x 分钟/小时/天前 */
export function fromNow(iso?: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return fmtDate(iso);
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  return fmtDate(iso);
}

/** 估算阅读时长（与后端一致的口径） */
export function readingTime(markdown: string): number {
  if (!markdown) return 1;
  const text = String(markdown)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#>*\-|]/g, ' ');
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const words = (text.match(/[a-zA-Z0-9]+/g) || []).length;
  return Math.max(1, Math.ceil(cjk / 300 + words / 200));
}

/** 文件名 → 媒体访问 URL（Blob 经函数代理） */
export function mediaUrl(key: string): string {
  if (!key) return '';
  return `/api/media/${key}`;
}

/** 从 URL 读取 hash 参数（admin 内部路由） */
export function readHash(defaultValue = ''): string {
  const h = window.location.hash.replace(/^#\/?/, '');
  return h || defaultValue;
}

/** 无封面占位样式类（纸墨编辑风：纸色底 + 朱砂点缀，统一不使用彩色渐变，保持页面低饱和一致） */
export function coverClassFor(): string {
  return 'cover-placeholder';
}
export function catIconClassFor(): string {
  return 'icon-placeholder';
}

/** public/covers/ 下的默认封面图（文章未设置封面时按 seed 稳定选用） */
const DEFAULT_COVERS = [
  '/covers/cover-backend-code.jpg',
  '/covers/cover-code-laptop.jpg',
  '/covers/cover-css-code.jpg',
  '/covers/cover-data-flow.jpg',
  '/covers/cover-dev-desk.jpg',
  '/covers/cover-devtools.jpg',
  '/covers/cover-dual-monitor.jpg',
  '/covers/cover-hardware.jpg',
  '/covers/cover-mac-coding.jpg',
  '/covers/cover-server.jpg',
];

/** 根据 seed（文章 id/slug）稳定选一张默认封面——同一篇文章始终同一张，不同文章均匀分散 */
export function defaultCoverFor(seed: string | number | undefined): string {
  const s = String(seed ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return DEFAULT_COVERS[h % DEFAULT_COVERS.length];
}

/** 客户端 slug 化：仅保留 ASCII 字母数字（中文等非 ASCII 得到空串，由后端兜底为随机 id） */
export function slugify(input: string): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
