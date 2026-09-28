'use client';

/** 文章卡片：封面（懒加载）+ 元信息 + 摘要 */
import Link from 'next/link';
import type { PostSummary } from '@/lib/types';
import { fmtDate, mediaUrl } from '@/lib/utils';

export default function PostCard({ post }: { post: PostSummary }) {
  // 封面优先级：外部 URL > 上传的 Blob 封面
  const cover = post.coverUrl || (post.coverKey ? mediaUrl(post.coverKey) : '');
  return (
    <article className="group bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 overflow-hidden hover:shadow-lg hover:shadow-slate-200/60 dark:hover:shadow-black/30 hover:border-brand-300 dark:hover:border-brand-600 transition-all">
      {cover && (
        <Link href={`/posts/${post.slug}/`} className="block aspect-[16/7] overflow-hidden bg-slate-100 dark:bg-slate-800">
          {/* 静态导出 + 禁用 next/image 优化，使用原生 img + 懒加载 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover}
            alt={post.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        </Link>
      )}
      <div className="p-5">
        <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 mb-2 flex-wrap">
          <span>{fmtDate(post.publishedAt || post.createdAt)}</span>
          {post.categoryName && (
            <>
              <span>·</span>
              <span className="text-brand-600 dark:text-brand-400">{post.categoryName}</span>
            </>
          )}
          <span>·</span>
          <span>{post.readingTime || 1} 分钟</span>
        </div>
        <Link href={`/posts/${post.slug}/`}>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors leading-snug">
            {post.title}
          </h3>
        </Link>
        {post.summary && (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{post.summary}</p>
        )}
      </div>
    </article>
  );
}
