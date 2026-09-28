'use client';

/** 页脚 */
import { useEffect, useState } from 'react';

export default function Footer() {
  const [config, setConfig] = useState<{ title?: string; footerText?: string }>({});
  const [year] = useState(() => new Date().getFullYear());

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && d.config) setConfig(d.config);
      })
      .catch(() => {});
  }, []);

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 text-center">
        <div className="footer-deco">
          <span className="footer-deco-line"></span>
          用文字存档思考
          <span className="footer-deco-line"></span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{config.footerText || 'Powered by EdgeOne Pages'}</p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          © {year} {config.title || '我的博客'} · Next.js + Tailwind CSS · EdgeOne KV / Blob
        </p>
      </div>
    </footer>
  );
}
