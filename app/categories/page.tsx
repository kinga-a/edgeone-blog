import type { Metadata } from 'next';
import CategoriesClient from '@/components/CategoriesClient';

export const metadata: Metadata = {
  title: '分类',
  description: '文章分类',
};

export default function CategoriesPage() {
  return <CategoriesClient />;
}
