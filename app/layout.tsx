import type { Metadata } from 'next';
import './globals.css';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'FeedFoundry — 新聞網站 RSS 生成器',
  description: '貼上新聞網站網址，取得經過驗證、可持續訂閱的 RSS 連結。',
  openGraph: {
    title: 'FeedFoundry — 新聞網站 RSS 生成器',
    description: '官方 RSS 優先，沒有就從公開新聞頁面生成。',
    type: 'website',
    images: ['https://feedfoundry-rss.liora-m.chatgpt.site/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FeedFoundry — 新聞網站 RSS 生成器',
    description: '貼上新聞網站網址，自動生成可訂閱的 RSS 連結。',
    images: ['https://feedfoundry-rss.liora-m.chatgpt.site/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body><Providers>{children}</Providers></body></html>;
}
