import type { Metadata } from 'next';
import TagsClient from '@/components/TagsClient';

export const metadata: Metadata = {
  title: '标签',
  description: '文章标签云',
};

export default function TagsPage() {
  return <TagsClient />;
}
