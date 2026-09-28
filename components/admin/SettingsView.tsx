'use client';

/** 站点设置：基本信息 / SEO / 社交 / 评论策略 / TOTP 安全验证 / 备份 */
import { useEffect, useRef, useState } from 'react';
import { ActionBar, Btn, Card, Field, Input, SaveState, Textarea, useToast } from './ui';
import { api } from '@/lib/api';
import type { PostSummary, SiteConfig } from '@/lib/types';

export default function SettingsView() {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const toast = useToast();
  // 已保存基线（config + 精选勾选顺序），用于未保存修改判定
  const baseRef = useRef<{ config: SiteConfig; featured: string[] } | null>(null);

  // TOTP
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpSecret, setTotpSecret] = useState('');
  const [totpUri, setTotpUri] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpStep, setTotpStep] = useState<'idle' | 'pending'>('idle'); // idle=未启用流程 | pending=已生成密钥待验证
  const [totpBusy, setTotpBusy] = useState(false);

  // 备份
  const [backupBusy, setBackupBusy] = useState(false);
  // 备份文件选择 input（必须在早期 return 之前声明，保持 Hook 顺序稳定）
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 首页精选文章
  const [allPosts, setAllPosts] = useState<PostSummary[]>([]);
  const [featuredChecked, setFeaturedChecked] = useState<string[]>([]);

  useEffect(() => {
    api.getConfig().then((d) => {
      if (d?.ok) {
        setConfig(d.config);
        const featured = Array.isArray(d.config.featuredPostIds) ? d.config.featuredPostIds.filter(Boolean) : [];
        setFeaturedChecked(featured);
        baseRef.current = { config: d.config, featured };
      }
    }).catch(() => {});
    api.me().then((d) => {
      if (d?.ok) setTotpEnabled(Boolean(d.totpEnabled));
    }).catch(() => {});
    // 加载全部文章供精选勾选（分页拉取，直到取完）
    (async () => {
      const all: PostSummary[] = [];
      let page = 1;
      for (;;) {
        try {
          const d = await api.listPosts({ page, pageSize: 50, scope: 'admin', status: '' });
          if (!d?.ok) break;
          all.push(...d.items);
          if (all.length >= d.total) break;
          page += 1;
        } catch {
          break;
        }
      }
      setAllPosts(all);
    })();
  }, []);

  // 与已保存基线比较：任一字段或精选顺序变化 → 有未保存修改
  useEffect(() => {
    if (!config) return;
    const b = baseRef.current;
    if (!b) return;
    const c = config;
    const dirty =
      JSON.stringify(c) !== JSON.stringify(b.config) ||
      featuredChecked.length !== b.featured.length ||
      featuredChecked.some((id, i) => id !== b.featured[i]);
    setDirty(dirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, featuredChecked]);

  if (!config) return (
    <div className="py-10 space-y-3" aria-hidden="true">
      <div className="skeleton h-6 w-1/3 rounded" />
      <div className="skeleton h-4 w-2/3 rounded" />
      <div className="skeleton h-4 w-1/2 rounded" />
    </div>
  );

  const set = (patch: Partial<SiteConfig>) => setConfig({ ...config, ...patch });
  const setNested = <K extends 'seo' | 'social'>(key: K, patch: Partial<SiteConfig[K]>) =>
    setConfig({ ...config, [key]: { ...config[key], ...patch } } as SiteConfig);
  const setBackup = (patch: Partial<NonNullable<SiteConfig['backup']>>) =>
    setConfig({ ...config, backup: { ...(config.backup || {}), ...patch } } as SiteConfig);

  /** 精选文章勾选切换：保持勾选顺序（先勾的在前） */
  const toggleFeatured = (id: string) => {
    setFeaturedChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const save = async () => {
    setBusy(true);
    try {
      await api.saveConfig({ ...config, featuredPostIds: featuredChecked });
      const saved = { ...config, featuredPostIds: featuredChecked };
      setConfig(saved);
      baseRef.current = { config: saved, featured: [...featuredChecked] };
      setSavedAt(new Date());
      setDirty(false);
      toast('设置已保存');
    } catch (e) {
      toast(e instanceof Error ? e.message : '保存失败', 'error');
    }
    setBusy(false);
  };

  /* ---------------- TOTP ---------------- */
  const startTotp = async () => {
    setTotpBusy(true);
    try {
      const d = await api.totpAction('setup');
      setTotpSecret(d.secret || '');
      setTotpUri(d.uri || '');
      setTotpCode('');
      setTotpStep('pending');
      toast('密钥已生成，请在身份验证器中添加后输入验证码');
    } catch (e) {
      toast(e instanceof Error ? e.message : '操作失败', 'error');
    }
    setTotpBusy(false);
  };

  const verifyTotp = async () => {
    if (!totpCode.trim()) { toast('请输入 6 位验证码', 'error'); return; }
    setTotpBusy(true);
    try {
      const d = await api.totpAction('verify', totpCode.trim());
      setTotpEnabled(true);
      setTotpStep('idle');
      setTotpSecret('');
      setTotpUri('');
      setTotpCode('');
      toast('TOTP 二次验证已启用');
    } catch (e) {
      toast(e instanceof Error ? e.message : '验证失败', 'error');
    }
    setTotpBusy(false);
  };

  const disableTotp = async () => {
    if (!totpCode.trim()) { toast('请输入当前验证码以确认关闭', 'error'); return; }
    setTotpBusy(true);
    try {
      const d = await api.totpAction('disable', totpCode.trim());
      setTotpEnabled(false);
      setTotpCode('');
      toast('TOTP 二次验证已关闭');
    } catch (e) {
      toast(e instanceof Error ? e.message : '操作失败', 'error');
    }
    setTotpBusy(false);
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).then(() => toast(`${label}已复制`)).catch(() => toast('复制失败', 'error'));
  };

  /* ---------------- 备份 ---------------- */
  const doExport = async () => {
    setBackupBusy(true);
    try {
      await api.exportBackup();
      toast('备份文件已开始下载');
    } catch (e) {
      toast(e instanceof Error ? e.message : '导出失败', 'error');
    }
    setBackupBusy(false);
  };

  const doWebdav = async () => {
    setBackupBusy(true);
    try {
      const d = await api.backupToWebdav();
      toast(`备份成功：共 ${d.count} 条记录`);
    } catch (e) {
      toast(e instanceof Error ? e.message : '备份失败', 'error');
    }
    setBackupBusy(false);
  };

  const onPickBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      let payload: unknown;
      try {
        payload = JSON.parse(String(reader.result));
      } catch {
        toast('备份文件不是有效的 JSON', 'error');
        return;
      }
      if (!window.confirm('将从该备份文件恢复数据：同键记录将被覆盖，备份中不存在的键保持不变，会话将保持当前登录。确定继续？')) return;
      setBackupBusy(true);
      try {
        const d = await api.restoreBackup(payload);
        toast(`恢复成功：${d.restored} 条记录已写入${d.skipped ? `（跳过会话 ${d.skipped} 条）` : ''}，建议刷新页面查看`);
      } catch (err) {
        toast(err instanceof Error ? err.message : '恢复失败', 'error');
      }
      setBackupBusy(false);
    };
    reader.readAsText(file);
  };

  const doRestoreWebdav = async () => {
    if (!window.confirm('将从 WebDAV 拉取备份并恢复数据：同键记录将被覆盖，备份中不存在的键保持不变。确定继续？')) return;
    setBackupBusy(true);
    try {
      const d = await api.restoreFromWebdav();
      toast(`恢复成功：${d.restored} 条记录已写入${d.skipped ? `（跳过会话 ${d.skipped} 条）` : ''}，建议刷新页面查看`);
    } catch (e) {
      toast(e instanceof Error ? e.message : '恢复失败', 'error');
    }
    setBackupBusy(false);
  };

  return (
    <div className="pb-32">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">站点设置</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">配置展示在首页、页脚、SEO 与订阅源中的站点信息</p>
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
            <Field label="网站图标 URL（favicon）" hint="填写图片 URL 作为浏览器标签页/收藏夹图标，如 https://example.com/favicon.png；留空使用默认图标">
              <Input value={config.faviconUrl || ''} onChange={(e) => set({ faviconUrl: e.target.value })} placeholder="https://…" />
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
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">首页精选文章</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            勾选要展示在首页「精选文章 01」区的文章，按勾选顺序排列（第一篇为精选大卡，后两篇为侧边小卡）；留空则自动取最新文章。
          </p>
          <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-800">
            {allPosts.length === 0 ? (
              <div className="px-3 py-4 text-sm text-slate-400 text-center">文章加载中…</div>
            ) : (
              allPosts.map((p) => {
                const idx = featuredChecked.indexOf(p.id);
                const checked = idx >= 0;
                return (
                  <label
                    key={p.id}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${checked ? 'bg-brand-50 dark:bg-brand-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleFeatured(p.id)}
                      className="accent-brand-600"
                    />
                    <span className="flex-1 text-sm text-slate-800 dark:text-slate-200 truncate">{p.title}</span>
                    {checked && (
                      <span className="text-xs font-mono text-brand-600 dark:text-brand-400 shrink-0">精选 #{idx + 1}</span>
                    )}
                    <span className="text-xs text-slate-400 shrink-0">{p.status === 'published' ? '已发布' : p.status === 'draft' ? '草稿' : '私人'}</span>
                  </label>
                );
              })
            )}
          </div>
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
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">TOTP 安全验证</h2>
          {!totpEnabled && totpStep === 'idle' ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                为后台登录启用 TOTP 二次验证：登录时除密码外还需输入身份验证器（Google Authenticator / 1Password 等）中的 6 位动态验证码。
              </p>
              <Btn onClick={startTotp} disabled={totpBusy}>{totpBusy ? '生成中…' : '生成密钥并启用'}</Btn>
            </div>
          ) : !totpEnabled && totpStep === 'pending' ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                在身份验证器中添加账户（扫码或手动输入密钥），然后输入 6 位验证码完成启用：
              </p>
              {totpUri && (
                <div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(totpUri)}`}
                    alt="TOTP 二维码"
                    className="w-44 h-44 rounded-lg border border-slate-200 dark:border-slate-700 bg-white p-2"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <code className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm break-all">{totpSecret}</code>
                <Btn size="sm" variant="secondary" onClick={() => copyText(totpSecret, '密钥')}>复制</Btn>
              </div>
              <div className="flex items-end gap-2">
                <Field label="动态验证码" >
                  <Input value={totpCode} onChange={(e) => setTotpCode(e.target.value)} placeholder="6 位验证码" inputMode="numeric" className="w-40" />
                </Field>
                <Btn onClick={verifyTotp} disabled={totpBusy}>{totpBusy ? '验证中…' : '验证并启用'}</Btn>
                <Btn variant="secondary" onClick={() => { setTotpStep('idle'); setTotpSecret(''); setTotpUri(''); }}>取消</Btn>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">已启用</span>
                <span className="text-slate-500 dark:text-slate-400">登录时需要输入动态验证码</span>
              </div>
              <div className="flex items-end gap-2">
                <Field label="输入当前验证码以关闭">
                  <Input value={totpCode} onChange={(e) => setTotpCode(e.target.value)} placeholder="6 位验证码" inputMode="numeric" className="w-40" />
                </Field>
                <Btn variant="danger" onClick={disableTotp} disabled={totpBusy}>{totpBusy ? '处理中…' : '关闭 TOTP'}</Btn>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">备份与恢复</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-700 dark:text-slate-300">全量导出（KV 全部数据）</p>
                <p className="text-xs text-slate-400 mt-0.5">下载 JSON 备份文件，包含文章、分类、标签、评论、媒体元数据、配置与统计</p>
              </div>
              <Btn variant="secondary" onClick={doExport} disabled={backupBusy}>立即导出</Btn>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-700 dark:text-slate-300">从文件恢复</p>
                <p className="text-xs text-slate-400 mt-0.5">选择之前导出的 JSON 备份，合并式覆盖恢复（同键覆盖，缺失键保留）</p>
              </div>
              <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={onPickBackupFile} />
              <Btn variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={backupBusy}>选择文件恢复</Btn>
            </div>
            <div className="border-t border-slate-100 dark:border-slate-700/50 pt-4">
              <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">WebDAV 备份 / 恢复</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="WebDAV 地址" hint="完整文件 URL，如 https://dav.example.com/backup/blog.json">
                  <Input value={config.backup?.webdavUrl || ''} onChange={(e) => setBackup({ webdavUrl: e.target.value })} placeholder="https://dav.example.com/backup/blog.json" />
                </Field>
                <Field label="用户名">
                  <Input value={config.backup?.webdavUsername || ''} onChange={(e) => setBackup({ webdavUsername: e.target.value })} />
                </Field>
                <Field label="密码">
                  <Input value={config.backup?.webdavPassword || ''} onChange={(e) => setBackup({ webdavPassword: e.target.value })} type="password" />
                </Field>
                <Field label="子目录（可选）">
                  <Input value={config.backup?.webdavPath || ''} onChange={(e) => setBackup({ webdavPath: e.target.value })} placeholder="/backups" />
                </Field>
              </div>
              <p className="text-xs text-slate-400 mt-2">保存设置后，点击「立即备份」将当前全部数据推送到 WebDAV（PUT 覆盖）；「从 WebDAV 恢复」拉取该文件并合并式覆盖恢复</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Btn onClick={doWebdav} disabled={backupBusy}>{backupBusy ? '处理中…' : '立即备份到 WebDAV'}</Btn>
                <Btn variant="secondary" onClick={doRestoreWebdav} disabled={backupBusy}>{backupBusy ? '处理中…' : '从 WebDAV 恢复'}</Btn>
                <Btn variant="secondary" onClick={save} disabled={busy}>保存 WebDAV 配置</Btn>
              </div>
            </div>
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

      {/* 固定底部操作栏：未保存状态提示 + 保存设置 */}
      <ActionBar
        left={<SaveState dirty={dirty} busy={busy} savedAt={savedAt} />}
        primaryLabel="保存设置"
        busyLabel="保存中…"
        busy={busy}
        onPrimary={save}
      />
    </div>
  );
}
