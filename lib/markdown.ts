/** 前端 Markdown 渲染：marked + highlight.js（用于关于页、后台文章预览） */
import { marked } from 'marked';
import hljs from 'highlight.js';

let initialized = false;

function ensureInit() {
  if (initialized) return;
  initialized = true;
  const renderer = new marked.Renderer();
  renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
    const language = (lang || '').toLowerCase();
    let highlighted: string;
    if (language && hljs.getLanguage(language)) {
      try {
        highlighted = hljs.highlight(text, { language, ignoreIllegals: true }).value;
      } catch {
        highlighted = escapeHtml(text);
      }
    } else {
      highlighted = escapeHtml(text);
    }
    return `<pre class="hljs code-block"${language ? ` data-lang="${escapeHtml(language)}"` : ''}><code>${highlighted}</code></pre>`;
  };
  marked.use({ gfm: true, breaks: false, renderer });
}

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** 轻量清洗：剥离危险标签与事件属性（与后端口径一致） */
export function sanitizeHtml(html: string): string {
  let out = html.replace(/<!--[\s\S]*?-->/g, '');
  out = out.replace(/<(script|style|iframe|object|embed|form)[^>]*>[\s\S]*?<\/\1>/gi, '');
  out = out.replace(/<(script|style|iframe|object|embed|form)[^>]*\/?>/gi, '');
  out = out.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g, (whole, closing: string, tag: string, attrs: string) => {
    const name = tag.toLowerCase();
    const allowed = new Set(['p','br','hr','h1','h2','h3','h4','h5','h6','blockquote','pre','code','ul','ol','li','dl','dt','dd','table','thead','tbody','tr','th','td','a','img','strong','em','b','i','u','s','del','ins','mark','sub','sup','span','div','details','summary','figure','figcaption','section','article']);
    if (!allowed.has(name)) return escapeHtml(whole);
    if (!closing) {
      const attrsOut: string[] = [];
      const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(attrs))) {
        const attrName = m[1].toLowerCase();
        const value = m[3] ?? m[4] ?? m[5] ?? '';
        if (attrName.startsWith('on')) continue;
        const trimmed = value.trim().toLowerCase();
        if (attrName === 'href' || attrName === 'src') {
          if (trimmed.startsWith('javascript:') || trimmed.startsWith('vbscript:') || trimmed.startsWith('data:') && !trimmed.startsWith('data:image/')) continue;
          if (attrName === 'href') attrsOut.push(`${attrName}="${value.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer nofollow"`);
          else attrsOut.push(`${attrName}="${value.replace(/"/g, '&quot;')}"`);
          continue;
        }
        if (['id','class','alt','title','width','height','colspan','rowspan','lang','data-lang','start','type'].includes(attrName)) {
          attrsOut.push(`${attrName}="${value.replace(/"/g, '&quot;')}"`);
        }
      }
      return `<${name}${attrsOut.length ? ' ' + attrsOut.join(' ') : ''}>`;
    }
    return `</${name}>`;
  });
  return out;
}

/** 渲染 Markdown 为安全 HTML */
export function renderMarkdown(md: string): string {
  ensureInit();
  return sanitizeHtml(marked.parse(md ?? '') as string);
}
