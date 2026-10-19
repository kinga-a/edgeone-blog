'use client';

/**
 * Vditor Markdown 编辑器（后台文章创作）
 * - 动态导入 vditor（SSR 安全），资源走本地 /vditor/（不依赖 unpkg CDN）
 * - 加载期间展示平滑骨架占位，消除挂载闪烁
 */
import { useEffect, useRef, useState } from 'react';
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
  const [ready, setReady] = useState(false);

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
            mode: 'sv',
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
              setReady(true);
              try {
                editor?.setValue(value || '', true);
              } catch {
                /* ignore */
              }
            },
          });
        } catch (e) {
          console.error('[VditorEditor] 初始化失败:', e);
          setReady(true);
        }
      })
      .catch((e) => {
        console.error('[VditorEditor] 加载失败:', e);
        setReady(true);
      });

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

  return (
    <div className="relative min-h-[520px]">
      {!ready && (
        <div className="absolute inset-0 p-5 space-y-4 bg-[var(--t-card)] dark:bg-slate-800 z-10" aria-hidden="true">
          <div className="skeleton h-9 w-full rounded-lg" />
          <div className="skeleton h-6 w-1/3 rounded-md mt-4" />
          <div className="skeleton h-4 w-full rounded" />
          <div className="skeleton h-4 w-5/6 rounded" />
          <div className="skeleton h-4 w-2/3 rounded" />
        </div>
      )}
      <div ref={mountRef} />
    </div>
  );
}
