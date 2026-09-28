/**
 * 分类图标库（前台版）：内置 SVG 图标集 + 自定义 SVG 清洗 + 解析
 * 与 edge-functions/api/_lib/icons.js 保持同一套图标 key 与路径。
 */

/** 内置图标集：key -> SVG 内部元素（stroke 风格，24 viewBox，由渲染处统一包裹 <svg>） */
export const CATEGORY_ICON_SET: Record<string, string> = {
  code: '<path d="M8 9l-3 3 3 3M16 9l3 3-3 3M13 5l-2 14" />',
  layout: '<rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 4v16" /><path d="M6 14l2 1.5-2 1.5M12 17h4" />',
  server: '<rect x="4" y="4" width="16" height="16" rx="2" /><circle cx="9" cy="9" r="1.4" fill="currentColor" stroke="none" /><circle cx="15" cy="9" r="1.4" fill="currentColor" stroke="none" /><path d="M9 14h6M9 16.5h4" />',
  database: '<ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />',
  cloud: '<path d="M18 10h-1.3A4 4 0 0 0 13 6a4.5 4.5 0 0 0-8.2 1.6A3.5 3.5 0 0 0 5.5 15H18a3 3 0 0 0 0-6z" />',
  wrench: '<path d="M14.7 6.3a4.5 4.5 0 0 0-6 5.6L4 16.6V20h3.4l4.7-4.7a4.5 4.5 0 0 0 5.6-6L14 13l-3-3 3.7-3.7z" />',
  network: '<circle cx="5" cy="12" r="2" /><circle cx="19" cy="6" r="2" /><circle cx="19" cy="18" r="2" /><path d="M7 11l10-4M7 13l10 4" />',
  book: '<path d="M4 5a2 2 0 0 1 2-2h6v16H6a2 2 0 0 0-2 2V5z" /><path d="M14 3h4a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2h-4V3z" />',
  doc: '<path d="M6 3h9l4 4v14H6V3z" /><path d="M15 3v5h4M9 12h6M9 16h6" />',
  pen: '<path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />',
  image: '<rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" fill="currentColor" stroke="none" /><path d="M4 17l5-5 3 3 4-4 4 4" />',
  music: '<path d="M9 18V6l10-2v12" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" />',
  video: '<rect x="3" y="5" width="13" height="14" rx="2" /><path d="M16 10l5-3v10l-5-3" />',
  game: '<path d="M7 9h.01M11 9h.01M6 12v.01M11 12v.01" /><path d="M6.5 5h11a4.5 4.5 0 0 1 4.3 5.8l-1 4A3.5 3.5 0 0 1 14 16l-1-2H11l-1 2a3.5 3.5 0 0 1-6.8-1.2l-1-4A4.5 4.5 0 0 1 6.5 5z" />',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.2 7.6-8 9-4.8-1.4-8-4.5-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" />',
  mobile: '<rect x="7" y="3" width="10" height="18" rx="2.5" /><path d="M11 17.5h2" />',
  spark: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z" /><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z" />',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.9 2-2 0-.5-.2-1-.6-1.4-.3-.4-.5-.8-.5-1.2 0-1 .8-1.8 1.8-1.8H16a5 5 0 0 0 5-5c0-3.9-4-6.6-9-6.6z" /><circle cx="7.5" cy="11.5" r="1" fill="currentColor" stroke="none" /><circle cx="10.5" cy="7.5" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="8" r="1" fill="currentColor" stroke="none" />',
  gear: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" /><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />',
  star: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.2l5.9-.9L12 3z" />',
};

export const CATEGORY_ICON_KEYS = Object.keys(CATEGORY_ICON_SET);

/** 清洗自定义 SVG：剥离脚本、事件、危险属性与危险标签（前台/SSR 共用规则） */
export function sanitizeSvg(svg: string): string {
  return String(svg || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\s*\/(script|iframe|object|embed|link|meta|style|form|a)\s*>/gi, '')
    .replace(/<\s*(script|iframe|object|embed|link|meta|style|form|a)[\s\S]*?>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(?:href|xlink:href|src|action|formaction)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '')
    .replace(/<\s*svg[\s\S]*?>/i, '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">')
    .replace(/<\/\s*svg\s*>/i, '</svg>')
    .trim();
}

export type CategoryIconValue = string;

/** 解析分类图标：返回 { kind: 'key' | 'svg' | 'none', value } */
export function resolveCategoryIcon(icon?: string): { kind: 'key' | 'svg' | 'none'; value: string } {
  const raw = String(icon || '').trim();
  if (!raw) return { kind: 'none', value: '' };
  if (raw.toLowerCase().startsWith('<svg')) {
    return { kind: 'svg', value: sanitizeSvg(raw) };
  }
  if (Object.prototype.hasOwnProperty.call(CATEGORY_ICON_SET, raw)) {
    return { kind: 'key', value: raw };
  }
  return { kind: 'none', value: '' };
}
