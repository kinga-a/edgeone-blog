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
  // theme-color 不在此导出：Next 会重复注入 meta 导致 iOS 取错；改为 body 静态 meta + 内联脚本按手动主题设置
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col">
        <meta name="theme-color" content="#faf7f1" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('blog-theme');var dark=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(dark){document.documentElement.classList.add('dark');}var color=dark?'#1c1916':'#faf7f1';document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.remove();});var m=document.createElement('meta');m.name='theme-color';m.content=color;document.head.appendChild(m);}catch(e){}})();`,
          }}
        />
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
