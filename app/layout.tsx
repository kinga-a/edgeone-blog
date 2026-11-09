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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf7f1' },
    { media: '(prefers-color-scheme: dark)', color: '#292524' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* 首屏前按站内主题（localStorage 优先、其次系统）定下深浅色，
            让 Safari 工具栏的 theme-color 与 color-scheme 跟站内主题走，
            而不是只跟系统外观走。ThemeProvider 挂载后会继续同步。 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('blog-theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;var r=document.documentElement;r.classList.toggle('dark',d);r.setAttribute('data-theme',d?'dark':'light');r.style.colorScheme=d?'dark':'light';var c=d?'#292524':'#faf7f1';var ms=document.querySelectorAll('meta[name="theme-color"]');if(ms.length){ms.forEach(function(m){m.removeAttribute('media');m.setAttribute('content',c);});}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col">
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
