'use client';

/** 站点设置：基本信息 / SEO / 社交 / 评论策略 */
import { useEffect, useState } from 'react';
import { Btn, Card, Field, Input, Textarea, useToast } from './ui';
import { api } from '@/lib/api';
import type { SiteConfig } from '@/lib/types';

export default function SettingsView() {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.getConfig().then((d) => {
      if (d?.ok) setConfig(d.config);
    }).catch(() => {});
  }, []);

  if (!config) return <div className="py-14 text-center text-sm text-slate-400">加载中…</div>;

  const set = (patch: Partial<SiteConfig>) => setConfig({ ...config, ...patch });
  const setNested = <K extends 'seo' | 'social'>(key: K, patch: Partial<SiteConfig[K]>) =>
    setConfig({ ...config, [key]: { ...config[key], ...patch } } as SiteConfig);

  const save = async () => {
    setBusy(true);
    try {
      await api.saveConfig(config);
      toast('设置已保存');
    } catch (e) {
      toast(e instanceof Error ? e.message : '保存失败', 'error');
    }
    setBusy(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">站点设置</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">配置展示在首页、页脚、SEO 与订阅源中的站点信息</p>
        </div>
        <Btn onClick={save} disabled={busy}>{busy ? '保存中…' : '保存设置'}</Btn>
      </div>

      <div className="space-y-5 max-w-3xl">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">基本信息</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="站点标题">
              <Input value={config.title} onChange={(e) => set({ title: e.target.value })} />
            </Field>
            <Field label="副标题">
              <Input value={config.subtitle} onChange={(e) => set({ subtitle: e.target.value })} />
            </Field>
            <Field label="作者">
              <Input value={config.author} onChange={(e) => set({ author: e.target.value })} />
            </Field>
            <Field label="站点 URL" hint="用于 canonical / sitemap / RSS 的绝对地址，如 https://blog.example.com">
              <Input value={config.siteUrl} onChange={(e) => set({ siteUrl: e.target.value })} placeholder="https://…" />
            </Field>
            <Field label="站点描述">
              <Input value={config.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
            <Field label="关键词">
              <Input value={config.keywords} onChange={(e) => set({ keywords: e.target.value })} />
            </Field>
            <Field label="语言">
              <Input value={config.language} onChange={(e) => set({ language: e.target.value })} />
            </Field>
            <Field label="每页文章数">
              <Input type="number" value={config.perPage} onChange={(e) => set({ perPage: parseInt(e.target.value, 10) || 10 })} />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="页脚文字">
              <Input value={config.footerText} onChange={(e) => set({ footerText: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">关于页内容（Markdown）</h2>
          <Textarea value={config.about} onChange={(e) => set({ about: e.target.value })} rows={8} />
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">评论策略</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={config.commentEnabled !== false} onChange={(e) => set({ commentEnabled: e.target.checked })} className="accent-brand-600" />
              启用评论功能
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={config.commentModeration !== false} onChange={(e) => set({ commentModeration: e.target.checked })} className="accent-brand-600" />
              新评论需要审核后才展示
            </label>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">SEO</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="默认分享图（OG 图片 URL）">
              <Input value={config.seo.ogImage} onChange={(e) => setNested('seo', { ogImage: e.target.value })} placeholder="https://…/og.png" />
            </Field>
            <Field label="Twitter 账号">
              <Input value={config.seo.twitterHandle} onChange={(e) => setNested('seo', { twitterHandle: e.target.value })} placeholder="username" />
            </Field>
            <Field label="Google 站点验证">
              <Input value={config.seo.googleSiteVerification} onChange={(e) => setNested('seo', { googleSiteVerification: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">社交链接</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="GitHub">
              <Input value={config.social.github} onChange={(e) => setNested('social', { github: e.target.value })} placeholder="https://github.com/…" />
            </Field>
            <Field label="Twitter / X">
              <Input value={config.social.twitter} onChange={(e) => setNested('social', { twitter: e.target.value })} placeholder="https://twitter.com/…" />
            </Field>
            <Field label="微信">
              <Input value={config.social.wechat} onChange={(e) => setNested('social', { wechat: e.target.value })} />
            </Field>
            <Field label="邮箱">
              <Input value={config.social.email} onChange={(e) => setNested('social', { email: e.target.value })} placeholder="hello@example.com" />
            </Field>
          </div>
        </Card>
      </div>
    </div>
  );
}
