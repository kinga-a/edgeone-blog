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

/** 菜单图标（参考图左侧导航：图标 + 文字） */
const MENU_ICONS: Record<string, string> = {
  dashboard: 'M3 13h4l2-7 4 14 2-8h6',
  posts: 'M6 3h9l4 4v14H6V3zM15 3v5h4M9 13h6M9 17h6',
  comments: 'M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5zM8 10h.01M12 10h.01M16 10h.01',
  categories: 'M4 5a2 2 0 0 1 2-2h6v16H6a2 2 0 0 0-2 2V5zM14 3h4a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2h-4V3z',
  tags: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
  media: 'M3 4h18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM3 17l5-5 3 3 4-4 6 6',
  settings: 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM12 12l8-4.5M12 12v9M12 12L4 7.5',
};

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
          <aside className="lg:w-56 shrink-0 lg:pt-8">
            <div className="lg:sticky lg:top-20 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-3">
              <div className="px-3 py-2.5 mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                    B
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">博客后台</span>
                </div>
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
                      'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2.5',
                      mainKey === m.key
                        ? 'bg-blue-600 text-white font-medium shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400',
                    )}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <path d={MENU_ICONS[m.key]} />
                    </svg>
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
