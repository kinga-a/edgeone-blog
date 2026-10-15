'use client';

/** 骨架屏与加载动画（克制暖纸微光）：用于前台与后台各页面数据加载占位 */
import { cx } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} aria-hidden="true" />;
}

/** 轻量旋转加载器（用于按钮内联或局部刷新态） */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx('spinner-ring shrink-0', className)}
      aria-hidden="true"
    />
  );
}

/** 文章卡片骨架（列表页 / 首页网格用，贴合真实卡片结构） */
export function PostCardSkeleton() {
  return (
    <div className="article-card p-0 pointer-events-none" aria-hidden="true">
      <Skeleton className="card-cover w-full rounded-none" />
      <div className="card-body">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-14 rounded-full" />
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
        <Skeleton className="h-6 w-11/12 rounded-md mt-1" />
        <Skeleton className="h-4 w-full rounded mt-1" />
        <Skeleton className="h-4 w-3/4 rounded" />
        <div className="mt-2 pt-2 flex items-center gap-1.5">
          <Skeleton className="h-5 w-14 rounded-md" />
          <Skeleton className="h-5 w-16 rounded-md" />
        </div>
      </div>
    </div>
  );
}

/** 整行骨架（后台列表 / 归档等用） */
export function LineSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cx('h-4 rounded', className)} />;
}
