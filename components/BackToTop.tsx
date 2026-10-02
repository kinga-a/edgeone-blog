'use client';

/** 回到顶部 + 阅读进度环：按钮外圈圆环随阅读进度填充，滚动超过阈值淡入，点击平滑回顶 */
import { useEffect, useState } from 'react';

const R = 20;
const CIRC = 2 * Math.PI * R;

export default function BackToTop() {
  const [show, setShow] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = document.documentElement;
        const total = el.scrollHeight - el.clientHeight;
        const p = total > 0 ? Math.min(1, Math.max(0, el.scrollTop / total)) : 0;
        setProgress(p);
        setShow(window.scrollY > 400);
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

  return (
    <button
      type="button"
      className={`back-to-top ${show ? 'show' : ''}`}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="回到顶部"
    >
      <svg className="progress-ring" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
        <circle className="ring-track" cx="24" cy="24" r={R} />
        <circle
          className="ring-fill"
          cx="24" cy="24" r={R}
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - progress)}
        />
      </svg>
      <span className="ring-arrow">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <path d="M10 16V4M4 10l6-6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}
