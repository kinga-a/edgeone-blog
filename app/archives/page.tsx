import type { Metadata } from 'next';
import ArchivesClient from '@/components/ArchivesClient';

export const metadata: Metadata = {
  title: '归档',
  description: '按时间归档全部文章',
};

export default function ArchivesPage() {
  return <ArchivesClient />;
}
