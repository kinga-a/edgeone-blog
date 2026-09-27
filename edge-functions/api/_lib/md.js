/**
 * 服务端 Markdown 渲染：marked + highlight.js + 轻量安全过滤 + 目录提取
 * 运行于 Edge Functions（V8 / Web API 环境，无 DOM）。
 */
import { marked } from 'marked';
import hljs from 'highlight.js/lib/common';

// 代码高亮
const renderer = new marked.Renderer();
renderer.code = (code, lang) => {
  const language = (lang || '').toLowerCase();
  let highlighted = '';
  if (language && hljs.getLanguage(language)) {
    try {
      highlighted = hljs.highlight(code, { language, ignoreIllegals: true }).value;
    } catch {
      highlighted = escapeHtml(code);
    }
  } else {
    highlighted = escapeHtml(code);
  }
  const langLabel = language ? ` data-lang="${escapeHtml(language)}"` : '';
  return `<pre class="hljs code-block"${langLabel}><code>${highlighted}</code></pre>`;
};

marked.use({
  gfm: true,
  breaks: false,
  renderer,
});

/**
 * 渲染 Markdown 为安全 HTML：
 * 1. marked 输出
 * 2. 剥离 <script> 等危险标签
 * 3. 清除 on* 事件属性与 javascript: 协议链接
 * 4. 为外链补充 rel / target
 */
export function renderMarkdown(markdown) {
  if (!markdown) return '';
  let html = marked.parse(String(markdown));
  html = sanitizeHtml(html);
  return html;
}

/** 提取目录（h2/h3），返回 [{level, id, text}] */
export function extractToc(html) {
  const toc = [];
  const re = /<h([23])[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g;
  let m;
  while ((m = re.exec(html))) {
    const text = m[3].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    if (text) toc.push({ level: Number(m[1]), id: m[2], text });
  }
  return toc;
}

/**
 * 轻量 HTML 安全过滤：
 * - 允许的标签白名单
 * - 剥离危险标签（script/style/iframe/object/embed/form 等）
 * - 移除 on* 事件属性
 * - 过滤 javascript: / vbscript: / data:（图片除外）协议
 */
const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'a', 'img', 'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins', 'mark', 'sub', 'sup',
  'span', 'div', 'details', 'summary', 'figure', 'figcaption', 'section', 'article',
]);

export function sanitizeHtml(html) {
  // 先去掉注释
  let out = String(html).replace(/<!--[\s\S]*?-->/g, '');
  // 剥离危险标签及其内容
  out = out.replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select|option|link|meta|base|template)[^>]*>[\s\S]*?<\/\1>/gi, '');
  out = out.replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select|option|link|meta|base|template)[^>]*\/?>/gi, '');
  // 逐标签清洗
  out = out.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g, (whole, closing, _sp, tag, attrs) => {
    const name = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return escapeHtml(whole);
    if (!closing) {
      const cleanAttrs = sanitizeAttributes(name, attrs);
      return `<${name}${cleanAttrs}>`;
    }
    return `</${name}>`;
  });
  return out;
}

function sanitizeAttributes(tag, attrsRaw) {
  const attrs = [];
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let m;
  while ((m = re.exec(attrsRaw))) {
    const name = m[1].toLowerCase();
    const value = m[3] ?? m[4] ?? m[5] ?? '';
    if (name.startsWith('on')) continue; // 事件属性
    if (name === 'href' || name === 'src') {
      const trimmed = value.trim().toLowerCase();
      if (trimmed.startsWith('javascript:') || trimmed.startsWith('vbscript:')) continue;
      if (name === 'src' && trimmed.startsWith('data:') && !trimmed.startsWith('data:image/')) continue;
      if (name === 'href' && trimmed.startsWith('data:')) continue;
      if (name === 'href') attrs.push(`${name}="${escapeAttr(value)}" target="_blank" rel="noopener noreferrer nofollow"`);
      else attrs.push(`${name}="${escapeAttr(value)}"`);
      continue;
    }
    // 白名单属性
    if (['id', 'class', 'alt', 'title', 'width', 'height', 'colspan', 'rowspan', 'lang', 'data-lang', 'start', 'type'].includes(name)) {
      attrs.push(`${name}="${escapeAttr(value)}"`);
    }
  }
  return attrs.length ? ' ' + attrs.join(' ') : '';
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
