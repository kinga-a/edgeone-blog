import type { Metadata } from 'next';
import { Suspense } from 'react';
import PostsClient from '@/components/PostsClient';

export const metadata: Metadata = {
  title: '文章列表',
  description: '全部博客文章',
};

export default function PostsPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-slate-400">加载中…</div>}>
      <PostsClient />
    </Suspense>
  );
}
