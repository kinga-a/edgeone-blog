import Link from 'next/link';

export const metadata = {
  title: '页面不存在',
};

export default function NotFound() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-24 text-center">
      <p className="text-6xl font-bold text-brand-600 dark:text-brand-400">404</p>
      <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">页面不存在</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">你访问的页面可能已被移动或删除。</p>
      <div className="mt-8 flex items-center justify-center gap-3">
        <Link href="/" className="px-5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors">
          返回首页
        </Link>
        <Link href="/posts/" className="px-5 py-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm border border-slate-200 dark:border-slate-700 hover:border-brand-400 transition-colors">
          浏览文章
        </Link>
      </div>
    </div>
  );
}
