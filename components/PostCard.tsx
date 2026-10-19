'use client';

/** 文章卡片（杂志式）：封面（真实图/分类占位 + 悬浮角标）+ 日期·阅读时长 + 衬线标题 + 摘要 + 标签 + 底部互动指标 */
import { useEffect, useState } from 'react';
import type { PostSummary, Tag } from '@/lib/types';
import { fmtDate, mediaUrl, defaultCoverFor } from '@/lib/utils';

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

  // 封面优先级：外部 URL > 上传的 Blob 封面 > 默认封面图（按文章 id 稳定选）
  const cover = post.coverUrl || (post.coverKey ? mediaUrl(post.coverKey) : '') || defaultCoverFor(post.id);

  return (
    <article className="article-card group">
      <a href={`/posts/${post.slug}/`} className="block card-cover">
        {/* 静态导出 + 禁用 next/image 优化，使用原生 img + 懒加载 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cover}
          alt={post.title}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        {(post.visibility === 'private' || post.categoryName) && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
            {post.visibility === 'private' && (
              <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/90 text-white backdrop-blur-sm shadow-sm">
                私人
              </span>
            )}
            {post.categoryName && (
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-black/55 text-white backdrop-blur-sm">
                {post.categoryName}
              </span>
            )}
          </div>
        )}
      </a>
      <div className="card-body">
        <div className="card-meta">
          {post.visibility === 'private' && <span className="card-private">私人</span>}
          {post.categoryName && <span className="card-category">{post.categoryName}</span>}
          {(post.visibility === 'private' || post.categoryName) && <span className="meta-dot">·</span>}
          <span>{fmtDate(post.publishedAt || post.createdAt)}</span>
          <span className="meta-dot">·</span>
          <span>{post.readingTime || 1} 分钟阅读</span>
        </div>

        <a href={`/posts/${post.slug}/`} className="block">
          <h3 className="card-title">{post.title}</h3>
        </a>

        {post.summary && <p className="card-excerpt">{post.summary}</p>}

        {tagNames.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {tagNames.map((name) => (
              <span
                key={name}
                className="px-2 py-0.5 rounded-md text-xs bg-[var(--t-forest-soft)] text-[var(--t-forest)] dark:bg-[rgba(47,91,79,0.3)] dark:text-[#7fb5a4]"
              >
                #{name}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11.5px] text-slate-400 font-mono">
          <div className="flex items-center gap-3">
            <span title="阅读量">{post.views || 0} 阅读</span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span title="评论">{post.commentCount || 0} 评论</span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span title="点赞">{post.likes || 0} 赞</span>
          </div>
          <a
            href={`/posts/${post.slug}/`}
            className="text-brand-600 dark:text-brand-400 font-sans font-medium opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200"
          >
            阅读 →
          </a>
        </div>
      </div>
    </article>
  );
}
