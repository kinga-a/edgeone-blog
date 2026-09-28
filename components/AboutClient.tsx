'use client';

/** 关于页：读取站点配置中的 about（Markdown）并渲染 */
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
      <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100 mb-2">关于</h1>
      {config ? (
        <>
          <MarkdownView content={config.about || '## 关于我\n\n这是我的个人博客。'} className="prose mt-6" />
          {(social.github || social.twitter || social.wechat || social.email) && (
            <div className="mt-8 p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">联系我</h2>
              <div className="flex flex-wrap gap-3 text-sm">
                {social.github && <a href={social.github} target="_blank" rel="noopener noreferrer" className="text-brand-600 dark:text-brand-400 hover:underline">GitHub</a>}
                {social.twitter && <a href={social.twitter} target="_blank" rel="noopener noreferrer" className="text-brand-600 dark:text-brand-400 hover:underline">Twitter / X</a>}
                {social.wechat && <span className="text-slate-600 dark:text-slate-300">微信：{social.wechat}</span>}
                {social.email && <a href={`mailto:${social.email}`} className="text-brand-600 dark:text-brand-400 hover:underline">{social.email}</a>}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16 text-slate-400">加载中…</div>
      )}
    </div>
  );
}
