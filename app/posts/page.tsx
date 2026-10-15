import type { Metadata } from 'next';
import { Suspense } from 'react';
import PostsClient from '@/components/PostsClient';
import { PostCardSkeleton } from '@/components/Skeleton';

export const metadata: Metadata = {
  title: '文章列表',
  description: '全部博客文章',
};

export default function PostsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
          <div className="skeleton h-8 w-36 rounded-lg mb-2" aria-hidden="true" />
          <div className="skeleton h-4 w-24 rounded mb-8" aria-hidden="true" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          </div>
        </div>
      }
    >
      <PostsClient />
    </Suspense>
  );
}
