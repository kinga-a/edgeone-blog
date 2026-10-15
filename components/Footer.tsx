'use client';

/** 页脚：纸墨装饰线 + 快捷导航 + 版权信息 */
import Link from 'next/link';
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
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-transparent mt-12">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 text-center">
        <div className="footer-deco">
          <span className="footer-deco-line"></span>
          用文字存档思考
          <span className="footer-deco-line"></span>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mb-4 text-xs text-slate-500 dark:text-slate-400">
          <Link href="/" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">首页</Link>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <Link href="/posts/" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">全部文章</Link>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <Link href="/archives/" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">时间归档</Link>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <Link href="/about/" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">关于</Link>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <a href="/rss.xml" target="_blank" rel="noopener noreferrer" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">RSS 订阅</a>
        </nav>

        <p className="text-sm text-slate-500 dark:text-slate-400">{config.footerText || 'Powered by EdgeOne Pages'}</p>
        <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500 font-mono">
          © {year} {config.title || '我的博客'} · Next.js + Tailwind CSS · EdgeOne KV / Blob
        </p>
      </div>
    </footer>
  );
}
