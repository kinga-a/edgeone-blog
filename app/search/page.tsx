import type { Metadata } from 'next';
import SearchClient from '@/components/SearchClient';

export const metadata: Metadata = {
  title: '搜索',
  description: '站内文章搜索',
};

export default function SearchPage() {
  return <SearchClient />;
}
