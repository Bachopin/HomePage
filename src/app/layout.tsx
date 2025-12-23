import './globals.css';
import { CrosshairToggle, DisableContextMenu } from '@/components/ui';
import { getDatabaseItems } from '@/lib/notion';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 服务端获取数据库图标
  const { icon } = await getDatabaseItems();
  
  // 生成 favicon URL
  const faviconUrl = icon 
    ? `/api/image-proxy?url=${encodeURIComponent(icon.url)}`
    : '/favicon.ico'; // 回退到默认 favicon

  return (
    <html lang="en" className="scroll-smooth">
      <head>
        {/* 动态 favicon：基于 Notion 数据库图标 */}
        <link rel="icon" href={`${faviconUrl}&w=32&h=32&f=png`} sizes="32x32" />
        <link rel="icon" href={`${faviconUrl}&w=16&h=16&f=png`} type="image/png" sizes="16x16" />
        <link rel="apple-touch-icon" href={`${faviconUrl}&w=192&h=192&f=png`} sizes="192x192" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#6366f1" />
      </head>
      <body className="no-scrollbar">
        {children}
        <CrosshairToggle />
        <DisableContextMenu />
      </body>
    </html>
  );
}
