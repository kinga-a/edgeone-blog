'use client';

/** 安全 Markdown 渲染组件（关于页 / 预览等） */
import { useMemo } from 'react';
import { renderMarkdown } from '@/lib/markdown';

export default function MarkdownView({ content, className }: { content: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(content || ''), [content]);
  return (
    <div
      className={className || 'prose'}
      // 内容已经过 sanitizeHtml 清洗（剥离 script/事件属性/危险协议）
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
