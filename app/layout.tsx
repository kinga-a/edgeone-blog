import type { Metadata, Viewport } from 'next';
import './globals.css';
import ThemeProvider from '@/components/ThemeProvider';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BackToTop from '@/components/BackToTop';
import PageTransition from '@/components/PageTransition';
import FaviconUpdater from '@/components/FaviconUpdater';
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
      <body className="min-h-screen flex flex-col">
        <ThemeProvider>
          <FaviconUpdater />
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
