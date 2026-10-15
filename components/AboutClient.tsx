'use client';

/** 关于页：读取站点配置中的 about（Markdown）并渲染 + 社交名片区 */
import { useEffect, useState } from 'react';
import MarkdownView from './MarkdownView';
import type { SiteConfig } from '@/lib/types';
import { api } from '@/lib/api';

export default function AboutClient() {
  const [config, setConfig] = useState<SiteConfig | null>(null);

  useEffect(() => {
    let alive = true;
    api.getConfig().then((d) => {
      if (!alive) return;
      if (d?.ok) setConfig(d.config);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const social = config?.social || {};

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
      <div className="pb-5 mb-6 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-slate-100">关于</h1>
        {config?.author && (
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            作者：{config.author}
          </p>
        )}
      </div>

      {config ? (
        <div className="fade-in-up">
          <div className="p-6 sm:p-8 rounded-2xl bg-[var(--t-card)] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-[var(--shadow-xs)]">
            <MarkdownView content={config.about || '## 关于我\n\n这是我的个人博客。'} className="prose" />
          </div>

          {(social.github || social.twitter || social.wechat || social.email) && (
            <div className="mt-6 p-6 rounded-2xl bg-[var(--t-card)] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-[var(--shadow-xs)]">
              <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <span className="w-1.5 h-4 rounded-full bg-brand-600 dark:bg-brand-400" />
                联系与社交网络
              </h2>
              <div className="flex flex-wrap gap-3 text-sm">
                {social.github && (
                  <a
                    href={social.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 transition-all"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                    </svg>
                    GitHub
                  </a>
                )}
                {social.twitter && (
                  <a
                    href={social.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 transition-all"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4l11.733 16h4.267l-11.733 -16zM4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
                    </svg>
                    Twitter / X
                  </a>
                )}
                {social.wechat && (
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                    </svg>
                    微信：{social.wechat}
                  </span>
                )}
                {social.email && (
                  <a
                    href={`mailto:${social.email}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 transition-all"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                    {social.email}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 sm:p-8 rounded-2xl bg-[var(--t-card)] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3.5">
          <div className="skeleton h-6 w-2/5 rounded-lg" aria-hidden="true" />
          <div className="skeleton h-4 w-full rounded" aria-hidden="true" />
          <div className="skeleton h-4 w-11/12 rounded" aria-hidden="true" />
          <div className="skeleton h-4 w-4/5 rounded" aria-hidden="true" />
          <div className="skeleton h-4 w-3/4 rounded" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
