'use client';

/** 页面切换过渡：路由变化时容器重新挂载，触发克制的淡入动画（prefers-reduced-motion 时禁用） */
import { usePathname } from 'next/navigation';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
