'use client';

/** 阅读进度条：页面顶部 1px 朱砂进度条，随阅读进度延伸（仅文章详情页等长内容可见，全站通用） */
import { useEffect, useState } from 'react';

export default function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = document.documentElement;
        const total = el.scrollHeight - el.clientHeight;
        setProgress(total > 0 ? Math.min(1, Math.max(0, el.scrollTop / total)) : 0);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  if (progress <= 0.005) return null;
  return (
    <div
      aria-hidden="true"
      className="reading-progress"
      style={{ transform: `scaleX(${progress})` }}
    />
  );
}
