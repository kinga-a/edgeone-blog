'use client';

/** 后台管理主应用：登录守卫 + Hash 路由 + 布局 */
import { useEffect, useState } from 'react';
import { ToastProvider, useToast, Loading } from './ui';
import { api } from '@/lib/api';
import { readHash } from '@/lib/utils';
import LoginView from './LoginView';
import DashboardView from './DashboardView';
import PostsManager from './PostsManager';
import CategoriesManager from './CategoriesManager';
import TagsManager from './TagsManager';
import CommentsManager from './CommentsManager';
import MediaManager from './MediaManager';
import SettingsView from './SettingsView';
import { cx } from '@/lib/utils';

const MENU = [
  { key: 'dashboard', label: '仪表盘' },
  { key: 'posts', label: '文章管理' },
  { key: 'comments', label: '评论审核' },
  { key: 'categories', label: '分类管理' },
  { key: 'tags', label: '标签管理' },
  { key: 'media', label: '媒体库' },
  { key: 'settings', label: '站点设置' },
];

export default function AdminApp() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [route, setRoute] = useState<string>('dashboard');

  useEffect(() => {
    setRoute(readHash('dashboard'));
    const onHash = () => setRoute(readHash('dashboard'));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    api.me().then((d) => setAuthed(d?.ok === true)).catch(() => setAuthed(false));
  }, []);

  const navigate = (key: string) => {
    window.location.hash = `#/${key}`;
    setRoute(key);
  };

  const logout = async () => {
    await api.logout().catch(() => {});
    setAuthed(false);
    navigate('dashboard');
  };

  if (authed === null) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (!authed) {
    return <LoginView onLogin={() => setAuthed(true)} />;
  }

  const mainKey = route.split('/')[0] || 'dashboard';

  return (
    <ToastProvider>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* 侧边栏 */}
          <aside className="lg:w-52 shrink-0 lg:pt-10">
            <div className="lg:sticky lg:top-20 bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 p-3">
              <div className="px-3 py-2 mb-2 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">后台管理</span>
                <button onClick={logout} className="text-xs text-slate-400 hover:text-rose-500 transition-colors">
                  退出
                </button>
              </div>
              <nav className="space-y-0.5">
                {MENU.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => navigate(m.key)}
                    className={cx(
                      'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                      mainKey === m.key
                        ? 'bg-brand-600 text-white font-medium'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50',
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* 内容区 */}
          <div className="flex-1 min-w-0">
            {mainKey === 'dashboard' && <DashboardView />}
            {mainKey === 'posts' && <PostsManager route={route} navigate={navigate} />}
            {mainKey === 'comments' && <CommentsManager />}
            {mainKey === 'categories' && <CategoriesManager />}
            {mainKey === 'tags' && <TagsManager />}
            {mainKey === 'media' && <MediaManager />}
            {mainKey === 'settings' && <SettingsView />}
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
