import type { Metadata, Viewport } from 'next';
import './globals.css';
import ThemeProvider from '@/components/ThemeProvider';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BackToTop from '@/components/BackToTop';

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
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f7' },
    { media: '(prefers-color-scheme: dark)', color: '#1c1a17' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col">
        <ThemeProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <BackToTop />
        </ThemeProvider>
      </body>
    </html>
  );
}
