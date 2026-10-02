'use client';

/** 文章卡片（杂志式）：封面（真实图/分类渐变占位）+ 分类·日期·阅读时长 + 衬线标题 + 摘要 + 标签 */
import Link from 'next/link';
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
      <Link href={`/posts/${post.slug}/`} className="block card-cover">
        {/* 静态导出 + 禁用 next/image 优化，使用原生 img + 懒加载 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cover}
          alt={post.title}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </Link>
      <div className="card-body">
        <div className="card-meta">
          {post.visibility === 'private' && <span className="card-private">🔒 私人</span>}
          {post.categoryName && <span className="card-category">{post.categoryName}</span>}
          {post.categoryName && <span>·</span>}
          <span>{fmtDate(post.publishedAt || post.createdAt)}</span>
          <span>·</span>
          <span>{post.readingTime || 1} 分钟阅读</span>
          <span>·</span>
          <span title="阅读量">{post.views || 0} 阅读</span>
          <span>·</span>
          <span title="评论">{post.commentCount || 0} 评</span>
          <span>·</span>
          <span title="点赞">{post.likes || 0} 赞</span>
        </div>
        <Link href={`/posts/${post.slug}/`}>
          <h3 className="card-title">{post.title}</h3>
        </Link>
        {post.summary && <p className="card-excerpt">{post.summary}</p>}
        {tagNames.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
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
