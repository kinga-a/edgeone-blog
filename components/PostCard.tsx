'use client';

/** 文章卡片：封面（懒加载）+ 标题/摘要/日期/标签，简约无厚重阴影 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PostSummary, Tag } from '@/lib/types';
import { fmtDate, mediaUrl } from '@/lib/utils';

/* 模块级缓存：全站只需拉一次标签列表 */
let tagsCache: Tag[] | null = null;
let tagsPromise: Promise<Tag[]> | null = null;
function loadTags(): Promise<Tag[]> {
  if (tagsCache) return Promise.resolve(tagsCache);
  if (!tagsPromise) {
    tagsPromise = fetch('/api/tags')
      .then((r) => r.json())
      .then((d) => {
        tagsCache = (d?.items as Tag[]) || [];
        return tagsCache;
      })
      .catch(() => {
        tagsCache = [];
        return tagsCache;
      });
  }
  return tagsPromise;
}

export default function PostCard({ post }: { post: PostSummary }) {
  const [tagNames, setTagNames] = useState<string[]>([]);

  useEffect(() => {
    if (!post.tags?.length) return;
    let alive = true;
    loadTags().then((tags) => {
      if (!alive) return;
      const map = new Map(tags.map((t) => [t.id, t.name]));
      setTagNames(post.tags.map((id) => map.get(id)).filter((n): n is string => !!n).slice(0, 3));
    });
    return () => { alive = false; };
  }, [post.tags]);

  // 封面优先级：外部 URL > 上传的 Blob 封面
  const cover = post.coverUrl || (post.coverKey ? mediaUrl(post.coverKey) : '');

  return (
    <article className="group bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden hover:border-brand-300 dark:hover:border-brand-600 transition-colors">
      {cover && (
        <Link href={`/posts/${post.slug}/`} className="block aspect-[16/7] overflow-hidden bg-slate-100 dark:bg-slate-800">
          {/* 静态导出 + 禁用 next/image 优化，使用原生 img + 懒加载 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover}
            alt={post.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
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
        {tagNames.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tagNames.map((name) => (
              <span
                key={name}
                className="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400"
              >
                #{name}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
