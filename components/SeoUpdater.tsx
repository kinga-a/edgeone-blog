'use client';

/**
 * SEO 元信息注入（静态页用）：
 * 首页/列表/归档/关于等静态导出页面的 <head> 是构建时固定的，
 * 本组件挂载后读取站点配置，动态注入 og:image / twitter:site / google-site-verification。
 * 文章/分类/标签页由 edge SSR 渲染已包含，这里只做补全，不删除已有 meta。
 */
import { useEffect } from 'react';
import { api } from '@/lib/api';

export default function SeoUpdater() {
  useEffect(() => {
    let alive = true;
    api
      .getConfig()
      .then((d) => {
        if (!alive || !d?.ok) return;
        const seo = d.config?.seo || {};
        const ensureMeta = (attr: string, key: string, content?: string) => {
          if (!content?.trim()) return;
          // 已存在（如 SSR 文章页的封面 og:image / 分类页的 google-site-verification）则不覆盖，保留服务端值
          const existing = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
          if (existing) return;
          const el = document.createElement('meta');
          el.setAttribute(attr, key);
          el.content = content.trim();
          document.head.appendChild(el);
        };
        if (seo.ogImage) ensureMeta('property', 'og:image', seo.ogImage);
        if (seo.twitterHandle) {
          ensureMeta('name', 'twitter:site', `@${String(seo.twitterHandle).replace(/^@/, '')}`);
        }
        if (seo.googleSiteVerification) {
          ensureMeta('name', 'google-site-verification', seo.googleSiteVerification);
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return null;
}
