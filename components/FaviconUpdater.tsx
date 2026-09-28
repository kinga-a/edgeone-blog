'use client';

/** 网站图标同步：读取站点配置的 faviconUrl 并更新 <link rel="icon"> / apple-touch-icon；
 *  未设置时回退到默认的纸墨风 B 图标 */
import { useEffect } from 'react';
import { api } from '@/lib/api';
import { DEFAULT_FAVICON } from '@/lib/constants';

export default function FaviconUpdater() {
  useEffect(() => {
    let alive = true;
    api
      .getConfig()
      .then((d) => {
        if (!alive) return;
        const url = d?.ok && d.config?.faviconUrl?.trim() ? d.config.faviconUrl.trim() : DEFAULT_FAVICON;

        let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        if (!icon) {
          icon = document.createElement('link');
          icon.rel = 'icon';
          document.head.appendChild(icon);
        }
        icon.href = url;
        if (url.startsWith('data:')) icon.type = 'image/svg+xml';
        else icon.removeAttribute('type');

        let apple = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
        if (!apple) {
          apple = document.createElement('link');
          apple.rel = 'apple-touch-icon';
          document.head.appendChild(apple);
        }
        apple.href = url;
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return null;
}
