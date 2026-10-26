import type { Metadata, Viewport } from 'next';
import './globals.css';
import ThemeProvider from '@/components/ThemeProvider';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BackToTop from '@/components/BackToTop';
import PageTransition from '@/components/PageTransition';
import FaviconUpdater from '@/components/FaviconUpdater';
import SeoUpdater from '@/components/SeoUpdater';
import ScrollManager from '@/components/ScrollManager';
import { DEFAULT_FAVICON } from '@/lib/constants';
import { THEME_KEY, THEME_COLOR_LIGHT, THEME_COLOR_DARK } from '@/lib/theme';

export const metadata: Metadata = {
  title: {
    default: '我的博客',
    template: '%s - 我的博客',
  },
  description: '基于 EdgeOne Pages + Next.js + Tailwind CSS 构建的个人博客系统',
  keywords: '博客, EdgeOne Pages, Next.js, Tailwind CSS',
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    siteName: '我的博客',
  },
  icons: {
    icon: DEFAULT_FAVICON,
    apple: DEFAULT_FAVICON,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // theme-color 不在此导出：Next 会重复注入 meta 导致 iOS 取色混乱；改为 body 静态 meta + 内联脚本按站内主题设置
};

/** 挂载前内联脚本：先按站内主题（localStorage 优先，其次系统偏好）应用 dark class，
 *  再同步 theme-color meta——iOS Safari 监听 content 属性变化即时刷新信号栏/地址栏
 *  （remove/append 替换节点不触发，必须 setAttribute 原地改）；随后去重保单 meta。 */
const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;var el=document.documentElement;el.classList.toggle('dark',d);el.setAttribute('data-theme',d?'dark':'light');var c=d?'${THEME_COLOR_DARK}':'${THEME_COLOR_LIGHT}';var ms=document.querySelectorAll('meta[name="theme-color"]');if(!ms.length){var m=document.createElement('meta');m.setAttribute('name','theme-color');m.setAttribute('content',c);document.head.appendChild(m);}else{ms.forEach(function(x){x.setAttribute('content',c);});for(var i=1;i<ms.length;i++){ms[i].remove();}}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col">
        <meta name="theme-color" content="#faf7f2" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ThemeProvider>
          <FaviconUpdater />
          <SeoUpdater />
          <ScrollManager />
          <Header />
          <main className="flex-1">
            <PageTransition>{children}</PageTransition>
          </main>
          <Footer />
          <BackToTop />
        </ThemeProvider>
      </body>
    </html>
  );
}
