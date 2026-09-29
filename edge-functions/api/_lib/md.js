/**
 * 服务端 Markdown 渲染：零依赖内置渲染器 + 轻量安全过滤 + 目录提取
 * 运行于 Edge Functions（V8 / Web API 环境，无 DOM）。
 *
 * 说明：为避免边缘脚本打包体积超限（highlight.js/marked 会让单函数
 * bundle 超过 400KB），服务端仅输出语义化基础 HTML（代码块不预高亮），
 * 代码高亮由浏览器端 public/js/article.js 通过 highlight.js CDN 增强。
 *
 * 支持语法子集：
 *  - 标题 # ~ ######（h2/h3 自动生成 id 供目录使用）
 *  - 段落、换行
 *  - 无序列表 - / * / + 、有序列表 1.
 *  - 引用 >
 *  - 代码块 ```lang（围栏式）
 *  - 行内代码 `code`
 *  - 粗体 **x**、斜体 *x*
 *  - 链接 [text](url)、图片 ![alt](url)
 *  - 分隔线 --- / *** / ___
 *  - 简单表格（| a | b |）
 */
import { slugify } from './ids.js';

/* ---------------- 转义 ---------------- */

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ---------------- 行内语法 ---------------- */

const VIDEO_EXT_MIME = { mp4: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg', ogv: 'video/ogg', mov: 'video/quicktime', m4v: 'video/x-m4v' };

/** 内嵌 iframe 播放器（B 站 / YouTube / 腾讯视频）。src 为原始 URL，转义由 sanitizeHtml 统一处理 */
function iframeEmbed(src) {
  return `<iframe class="video-embed" src="${src}" width="100%" height="420" frameborder="0" allowfullscreen="" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" title="视频播放器"></iframe>`;
}

/**
 * 识别视频链接并返回可播放 HTML：
 * - 直链视频文件（.mp4/.webm/.ogg/.mov/.m4v）→ <video> 标签
 * - B 站 / YouTube / 腾讯视频 → iframe 内嵌播放器
 * 无法识别时返回 null（调用方按普通链接处理）
 */
export function videoEmbed(rawUrl) {
  if (!rawUrl) return null;
  let u;
  try { u = new URL(String(rawUrl)); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const url = u.href;
  // 直链视频文件
  const extMatch = u.pathname.match(/\.([a-z0-9]+)(\/?)$/i);
  if (extMatch && VIDEO_EXT_MIME[extMatch[1].toLowerCase()]) {
    const mime = VIDEO_EXT_MIME[extMatch[1].toLowerCase()];
    return `<video class="video-embed" controls="" preload="metadata" playsinline=""><source src="${url}" type="${mime}">您的浏览器不支持 video 标签，<a href="${url}">点击下载视频</a></video>`;
  }
  // B 站视频
  let m = /(^|\.)bilibili\.com$/i.test(u.hostname) && u.pathname.match(/\/video\/(BV[\w]+)/i);
  if (m) return iframeEmbed(`https://player.bilibili.com/player.html?bvid=${m[1]}&page=1&high_quality=1`);
  // YouTube（watch?v= / embed / youtu.be 短链）
  m = /(^|\.)(youtube\.com|youtube-nocookie\.com)$/i.test(u.hostname)
    ? (u.searchParams.get('v') || (u.pathname.match(/\/embed\/([\w-]+)/) || [])[1])
    : null;
  if (!m && u.hostname === 'youtu.be') m = (u.pathname.slice(1).match(/^([\w-]+)/) || [])[1];
  if (m) return iframeEmbed(`https://www.youtube.com/embed/${m}`);
  // 腾讯视频
  m = /(^|\.)qq\.com$/i.test(u.hostname) && u.pathname.match(/\/x\/page\/([\w]+)\.html/i);
  if (m) return iframeEmbed(`https://v.qq.com/txp/iframe/player.html?vid=${m[1]}&tiny=0&auto=0`);
  return null;
}

/** 行内 markdown → HTML（先提取行内代码占位，再处理粗斜体/链接，最后还原） */
function inline(text) {
  let s = String(text);
  const codes = [];
  s = s.replace(/`([^`\n]+)`/g, (m, c) => {
    codes.push(escapeHtml(c));
    return `\u0000${codes.length - 1}\u0000`;
  });
  // 图片 ![alt](url)
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (m, alt, src) =>
    `<img src="${escapeAttr(src)}" alt="${escapeHtml(alt)}" loading="lazy">`);
  // 链接 [text](url)：视频链接自动转为播放器
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (m, t, u) =>
    videoEmbed(u) || `<a href="${escapeAttr(u)}">${t}</a>`);
  // 粗体 / 斜体
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\u0000])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  // 还原行内代码
  s = s.replace(/\u0000(\d+)\u0000/g, (m, i) => `<code>${codes[Number(i)]}</code>`);
  return s;
}

/* ---------------- 块级渲染 ---------------- */

/** 将一段纯文本段落文本拆为连续行并渲染 */
function renderParagraph(text) {
  return `<p>${inline(text)}</p>`;
}

/** 渲染代码块内容（转义，不解析行内） */
function renderCodeBlock(code, lang) {
  const langLabel = lang ? ` data-lang="${escapeAttr(lang)}"` : '';
  return `<pre class="code-block"${langLabel}><code>${escapeHtml(code)}</code></pre>`;
}

/**
 * Markdown → 安全 HTML
 */
export function renderMarkdown(markdown) {
  if (!markdown) return '';
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  const usedIds = new Set();
  const headingId = (text) => {
    let id = slugify(text) || 'section';
    let base = id;
    let n = 2;
    while (usedIds.has(id)) id = `${base}-${n++}`;
    usedIds.add(id);
    return id;
  };

  let i = 0;
  const n = lines.length;

  while (i < n) {
    const line = lines[i];

    // 空行
    if (/^\s*$/.test(line)) { i++; continue; }

    // 围栏代码块 ```lang
    if (/^```/.test(line)) {
      const lang = line.replace(/^```\s*/, '').trim() || '';
      const buf = [];
      i++;
      while (i < n && !/^```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++; // 跳过闭合 ```（若存在）
      out.push(renderCodeBlock(buf.join('\n'), lang));
      continue;
    }

    // 标题 # ~ ######
    const hm = line.match(/^(#{1,6})\s+(.*)$/);
    if (hm) {
      const level = hm[1].length;
      const rawText = hm[2].trim();
      const plain = rawText.replace(/[*`[\]()!]/g, '').trim();
      const id = level === 2 || level === 3 ? headingId(plain) : '';
      out.push(`<h${level}${id ? ` id="${id}"` : ''}>${inline(rawText)}</h${level}>`);
      i++;
      continue;
    }

    // 分隔线
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    // 引用：连续 > 行
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < n && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${renderParagraph(buf.join(' '))}</blockquote>`);
      continue;
    }

    // 无序列表：连续 - / * / + 行（支持一级缩进子项）
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < n && (/^\s*[-*+]\s+/.test(lines[i]) || /^\s{2,}[-*+]\s+/.test(lines[i]))) {
        const raw = lines[i].replace(/^\s*[-*+]\s+/, '');
        const child = /^\s{2,}[-*+]\s+/.test(lines[i]) ? raw : raw;
        items.push(`<li>${inline(child)}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // 有序列表
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (i < n && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*\d+[.)]\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // 简单表格：| a | b | 开头，且下一行是分隔行 |---|
    if (/^\s*\|/.test(line) && i + 1 < n && /^\s*\|[\s:|-]+\|/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const parseRow = (l) => l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
      const header = parseRow(line);
      i += 2;
      const rows = [];
      while (i < n && /^\s*\|/.test(lines[i])) { rows.push(parseRow(lines[i])); i++; }
      const thead = `<thead><tr>${header.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
      out.push(`<table>${thead}${tbody}</table>`);
      continue;
    }

    // 裸 URL 段落：独立一行 → 视频自动转播放器，其余转超链接
    const soloUrl = line.trim().match(/^(https?:\/\/[^\s]+)$/);
    if (soloUrl) {
      const embed = videoEmbed(soloUrl[1]);
      out.push(embed || `<p><a href="${escapeAttr(soloUrl[1])}">${escapeHtml(soloUrl[1])}</a></p>`);
      i++;
      continue;
    }

    // 普通段落：收集连续非空行
    const buf = [line.trim()];
    i++;
    while (i < n && !/^\s*$/.test(lines[i]) && !/^(#{1,6}\s|```|>\s?|[-*+]\s|\d+[.)]\s|\s*\|)/.test(lines[i]) && !/^\s*(---|\*\*\*|___)\s*$/.test(lines[i])) {
      buf.push(lines[i].trim());
      i++;
    }
    out.push(renderParagraph(buf.join(' ')));
  }

  return sanitizeHtml(out.join('\n'));
}

/* ---------------- 目录提取 ---------------- */

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

/* ---------------- HTML 安全清洗 ---------------- */

/**
 * 轻量 HTML 安全过滤：
 * - 允许的标签白名单
 * - 剥离危险标签（script/style/object/embed/form 等；iframe 仅限视频平台域名）
 * - 移除 on* 事件属性
 * - 过滤 javascript: / vbscript: / data:（图片除外）协议
 */
const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption',
  'a', 'img', 'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins', 'mark', 'sub', 'sup',
  'span', 'div', 'details', 'summary', 'figure', 'figcaption', 'section', 'article',
  'video', 'source', 'iframe',
]);

/** 允许内嵌的 iframe 视频平台域名 */
const EMBED_HOSTS = ['bilibili.com', 'youtube.com', 'youtube-nocookie.com', 'qq.com', 'vimeo.com'];

function isAllowedEmbedSrc(value) {
  try {
    const u = new URL(String(value));
    if (!/^https?:$/.test(u.protocol)) return false;
    return EMBED_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h));
  } catch {
    return false;
  }
}

export function sanitizeHtml(html) {
  // 先去掉注释
  let out = String(html).replace(/<!--[\s\S]*?-->/g, '');
  // 剥离危险标签及其内容（iframe 交给下方逐标签白名单 + 域名校验）
  out = out.replace(/<(script|style|object|embed|form|input|button|textarea|select|option|link|meta|base|template)[^>]*>[\s\S]*?<\/\1>/gi, '');
  out = out.replace(/<(script|style|object|embed|form|input|button|textarea|select|option|link|meta|base|template)[^>]*\/?>/gi, '');
  // 逐标签清洗
  out = out.replace(/<(\/?)()([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g, (whole, closing, _sp, tag, attrs) => {
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

const ALLOWED_ATTRS = new Set([
  'id', 'class', 'alt', 'title', 'width', 'height', 'colspan', 'rowspan', 'lang', 'data-lang', 'start', 'type',
  'controls', 'poster', 'preload', 'playsinline', 'loop', 'muted', 'loading',
  'allowfullscreen', 'frameborder', 'allow',
]);

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
      // iframe 仅允许视频平台域名，且 src 必须 http(s)
      if (tag === 'iframe') {
        if (!isAllowedEmbedSrc(value)) continue;
        attrs.push(`${name}="${escapeAttr(value)}"`);
        continue;
      }
      if (name === 'href') attrs.push(`${name}="${escapeAttr(value)}" target="_blank" rel="noopener noreferrer nofollow"`);
      else attrs.push(`${name}="${escapeAttr(value)}"`);
      continue;
    }
    // 白名单属性
    if (ALLOWED_ATTRS.has(name)) {
      attrs.push(`${name}="${escapeAttr(value)}"`);
    }
  }
  return attrs.length ? ' ' + attrs.join(' ') : '';
}
