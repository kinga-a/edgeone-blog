import Link from 'next/link';

export const metadata = {
  title: '页面不存在',
};

export default function NotFound() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-24 text-center fade-in-up">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-brand-50 border border-brand-200 dark:border-brand-500 text-brand-600 dark:text-brand-400 text-3xl font-display font-bold mb-6 shadow-sm">
        404
      </div>
      <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">页面不存在</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
        你访问的页面可能已被移动、重命名或删除，不妨回到首页继续探索。
      </p>
      <div className="mt-8 flex items-center justify-center gap-3">
        <Link href="/" className="btn-primary !py-2.5 !px-5 !text-sm">
          返回首页
        </Link>
        <Link href="/posts/" className="btn-secondary !py-2.5 !px-5 !text-sm">
          浏览文章
        </Link>
      </div>
    </div>
  );
}
