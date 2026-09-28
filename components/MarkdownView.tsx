'use client';

/** 安全 Markdown 渲染组件（关于页 / 预览等）：代码块工具条 + 行号 + 图片点击放大 */
import { useEffect, useMemo, useRef } from 'react';
import { renderMarkdown } from '@/lib/markdown';

export default function MarkdownView({ content, className }: { content: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(content || ''), [content]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    /* ---------- 代码块：语言标签 + 复制按钮 + 行号 ---------- */
    root.querySelectorAll('pre.code-block').forEach((preEl) => {
      if ((preEl as HTMLElement).dataset.enhanced === '1') return;
      (preEl as HTMLElement).dataset.enhanced = '1';
      const code = preEl.querySelector('code');
      if (!code) return;
      const lang = (preEl as HTMLElement).getAttribute('data-lang') || '';
      const raw = code.textContent || '';

      // 容器
      const wrap = document.createElement('div');
      wrap.className = 'code-block-wrap';
      preEl.parentNode?.insertBefore(wrap, preEl);
      wrap.appendChild(preEl);

      // 头部：语言 + 复制
      const head = document.createElement('div');
      head.className = 'code-block-head';
      const langLabel = document.createElement('span');
      langLabel.className = 'code-lang';
      langLabel.textContent = lang || 'code';
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'code-copy-btn';
      copyBtn.textContent = '复制';
      copyBtn.addEventListener('click', () => {
        if (!navigator.clipboard) return;
        navigator.clipboard.writeText(raw).then(() => {
          copyBtn.textContent = '已复制';
          copyBtn.classList.add('copied');
          setTimeout(() => { copyBtn.textContent = '复制'; copyBtn.classList.remove('copied'); }, 1600);
        }).catch(() => {});
      });
      head.appendChild(langLabel);
      head.appendChild(copyBtn);
      wrap.insertBefore(head, preEl);

      // 行号：按换行拆分为行
      const lines = document.createElement('div');
      lines.className = 'code-lines';
      lines.innerHTML = code.innerHTML
        .split('\n')
        .map((l) => `<span class="code-line">${l || '&nbsp;'}</span>`)
        .join('');
      code.innerHTML = '';
      code.appendChild(lines);
    });

    /* ---------- 正文图片点击放大预览 ---------- */
    const removeLightbox = () => {
      const boxes = root.ownerDocument.querySelectorAll('.lightbox');
      boxes.forEach((b) => b.remove());
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeyDown);
    };
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') removeLightbox();
    }
    root.querySelectorAll('img').forEach((img) => {
      if ((img as HTMLElement).dataset.zoomed === '1') return;
      (img as HTMLElement).dataset.zoomed = '1';
      img.addEventListener('click', () => {
        const box = document.createElement('div');
        box.className = 'lightbox';
        const big = document.createElement('img');
        big.src = img.src;
        big.alt = img.alt || '';
        const close = document.createElement('button');
        close.className = 'lightbox-close';
        close.textContent = '×';
        close.addEventListener('click', removeLightbox);
        box.addEventListener('click', (e) => { if (e.target === box) removeLightbox(); });
        box.appendChild(big);
        box.appendChild(close);
        document.body.appendChild(box);
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', onKeyDown);
      });
    });

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [html]);

  return (
    <div
      ref={ref}
      className={className || 'prose'}
      // 内容已经过 sanitizeHtml 清洗（剥离 script/事件属性/危险协议）
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
