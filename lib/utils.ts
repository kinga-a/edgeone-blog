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

/** 分类名 → 封面/图标渐变类（纸墨编辑风：按内容领域着色） */
const CAT_COVER: Array<[string[], string]> = [
  [['前端', 'frontend'], 'cover-frontend'],
  [['数据库', 'database', '数据'], 'cover-database'],
  [['云', 'cloud', 'serverless'], 'cover-cloud'],
  [['随笔', 'essay', '生活', '杂谈'], 'cover-essay'],
];
export function coverClassFor(categoryName?: string): string {
  const n = categoryName || '';
  for (const [keys, cls] of CAT_COVER) {
    if (keys.some((k) => n.includes(k))) return cls;
  }
  return 'cover-default';
}
export function catIconClassFor(categoryName?: string): string {
  return coverClassFor(categoryName).replace('cover-', 'icon-');
}

/** 客户端 slug 化：仅保留 ASCII 字母数字（中文等非 ASCII 得到空串，由后端兜底为随机 id） */
export function slugify(input: string): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
