import type { Metadata } from 'next';
import HomeClient from '@/components/HomeClient';

export const metadata: Metadata = {
  title: '首页',
  description: '我的个人博客：记录思考，分享知识',
};

export default function HomePage() {
  return <HomeClient />;
}
