'use client';

/** 骨架屏（克制微光）：用于前台各页面数据加载占位 */
import { cx } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} aria-hidden="true" />;
}

/** 文章卡片骨架（列表页 / 首页网格用） */
export function PostCardSkeleton() {
  return (
    <div className="article-card p-0">
      <Skeleton className="card-cover w-full" />
      <div className="card-body">
        <Skeleton className="h-3 w-24 rounded" />
        <Skeleton className="h-5 w-4/5 rounded" />
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-2/3 rounded" />
      </div>
    </div>
  );
}

/** 整行骨架（后台列表 / 归档等用） */
export function LineSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cx('h-4 rounded', className)} />;
}
