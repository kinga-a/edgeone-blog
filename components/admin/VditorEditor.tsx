'use client';

/**
 * Vditor Markdown 编辑器（后台文章创作）
 * - 动态导入 vditor（SSR 安全），资源走本地 /vditor/（不依赖 unpkg CDN）
 * - 所见即所得模式（WYSIWYG）：粘贴网页 HTML（表格/图片等）直接渲染为真实元素；
 *   工具栏 edit-mode 可切换 所见即所得 / 即时渲染(IR) / 源码(SV) 三种模式
 * - 代码高亮 + 行号
 * - 图片上传：复用站内预签名直传（/api/media/upload-url + PUT Blob），成功后插入 Markdown 图片链接
 * - 自动跟随站点暗色/浅色主题
 */
import { useEffect, useRef } from 'react';
import 'vditor/dist/index.css';
import { api } from '@/lib/api';

type VditorInstance = {
  getValue: () => string;
  setValue: (v: string, clearStack?: boolean) => void;
  insertValue: (v: string, render?: boolean) => void;
  insertMD: (md: string) => void;
  setTheme: (theme: 'dark' | 'classic', contentTheme?: string, codeTheme?: string) => void;
  destroy: () => void;
};

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** 缓存 ID：切换文章/新建时用于隔离 Vditor 本地草稿 */
  cacheId?: string;
}

const TOOLBAR = [
  'undo', 'redo', '|',
  'headings', 'bold', 'italic', 'strike', '|',
  'list', 'ordered-list', 'check', '|',
  'quote', 'code', 'inline-code', 'link', 'table', '|',
  'upload', '|',
  'both', 'preview', 'fullscreen', 'edit-mode', 'outline', 'export',
];

export default function VditorEditor({ value, onChange, cacheId = 'blog-post-new' }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<VditorInstance | null>(null);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  // 挂载编辑器（仅客户端执行；依赖 cancelled 标志兼容 StrictMode 双挂载）
  useEffect(() => {
    if (!mountRef.current) return;

    let editor: VditorInstance | null = null;
    let cancelled = false;
    const isDark = () => document.documentElement.classList.contains('dark');

    import('vditor')
      .then((mod) => {
        if (cancelled || !mountRef.current) return;
        const VditorCtor = (mod.default || mod) as new (
          id: string | HTMLElement,
          options: Record<string, unknown>,
        ) => VditorInstance;

        try {
          editor = new VditorCtor(mountRef.current, {
          height: 520,
          // 即时渲染模式（IR）：常规 Markdown 所见即所得，raw HTML 表格以源码块显示、
          // 预览区渲染真实表格；工具栏 edit-mode 可切换 所见即所得/即时渲染/源码 三种模式
          mode: 'ir',
          // 预览/导出不对 HTML 二次过滤：raw HTML 表格等结构原样预览（内容管理员自写，
          // 前台渲染由 md.js 白名单清洗兜底）
          sanitize: (html: string) => html,
          cache: { id: cacheId, enable: true },
          theme: isDark() ? 'dark' : 'classic',
          lang: 'zh_CN',
          icon: 'material',
          cdn: '/vditor',
          placeholder: '开始写作吧…',
          counter: { enable: true, type: 'text' },
          toolbarConfig: { pin: true },
          toolbar: TOOLBAR,
          preview: {
            theme: isDark() ? 'dark' : 'light',
            hljs: { lineNumber: true, style: isDark() ? 'github-dark' : 'github' },
          },
          upload: {
            multiple: true,
            handler: async (files: File[]) => {
              let failed = 0;
              for (const file of files) {
                try {
                  const { url, key } = await api.getUploadUrl({
                    name: file.name,
                    type: 'image',
                    contentType: file.type || 'image/png',
                  });
                  const put = await fetch(url, { method: 'PUT', body: file });
                  if (!put.ok) throw new Error(`HTTP ${put.status}`);
                  editor?.insertMD(`\n![${file.name.replace(/[\[\]]/g, '')}](${`/api/media/${key}`})\n`);
                } catch {
                  failed += 1;
                }
              }
              return failed > 0 ? `有 ${failed} 张图片上传失败` : null;
            },
          },
          input: (v: string) => changeRef.current(v || ''),
          after: () => {
            editorRef.current = editor;
            // 初始化后用服务器内容覆盖本地草稿缓存（编辑模式），新建模式清空残留草稿
            try {
              editor?.setValue(value || '', true);
            } catch {
              /* ignore */
            }
          },
        });
        } catch (e) {
          console.error('[VditorEditor] 初始化失败:', e);
        }
      })
      .catch((e) => console.error('[VditorEditor] 加载失败:', e));

    // 拦截粘贴：网页 HTML 表格（含 colspan/rowspan）以原始 HTML 块插入，
    // 前台 md.js 白名单会透传表格标签并保留合并单元格；避免 Vditor 默认
    // 转成 Lute 不支持的 kramdown 表格属性语法导致渲染丢失。
    const onPasteCapture = (e: ClipboardEvent) => {
      const html = e.clipboardData?.getData('text/html') || '';
      if (!/<table[\s>]/i.test(html)) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc
          .querySelectorAll('script,style,iframe,object,embed,form,input,button,textarea,link,meta')
          .forEach((el) => el.remove());
        doc.querySelectorAll('[style]').forEach((el) => el.removeAttribute('style'));
        const body = doc.body.innerHTML.trim();
        if (body) {
          // setValue 官方 API：不依赖光标位置，IR/WYSIWYG 均直接渲染；
          // setValue 的 enableInput=false 不触发 input 回调，需手动同步 onChange
          const ed = editorRef.current;
          if (ed) {
            const cur = ed.getValue() || '';
            const next = `${cur}\n\n${body}\n\n`;
            try {
              ed.setValue(next);
              changeRef.current(next);
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        /* 解析失败则交给默认处理 */
      }
    };
    if (mountRef.current) {
      mountRef.current.addEventListener('paste', onPasteCapture, true);
    }

    return () => {
      cancelled = true;
      mountRef.current?.removeEventListener('paste', onPasteCapture, true);
      try {
        editor?.destroy();
      } catch {
        /* ignore */
      }
      editorRef.current = null;
    };
  }, []);

  // 外部值变化（如切换文章）→ 同步到编辑器
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const cur = ed.getValue() || '';
    if (cur !== value) ed.setValue(value || '', true);
  }, [value]);

  // 跟随站点暗色模式
  useEffect(() => {
    const el = document.documentElement;
    const applyTheme = () => {
      const dark = el.classList.contains('dark');
      editorRef.current?.setTheme(
        dark ? 'dark' : 'classic',
        dark ? 'dark' : 'light',
        dark ? 'github-dark' : 'github',
      );
    };
    const observer = new MutationObserver(applyTheme);
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return <div ref={mountRef} />;
}
