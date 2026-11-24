import './globals.css';
import { CrosshairToggle, DisableContextMenu } from '@/components/ui';
import { getDatabaseItems } from '@/lib/notion';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 服务端获取数据库图标（与 page/metadata 共用请求级缓存）
  const { icon } = await getDatabaseItems();

  const proxied = icon
    ? `/api/image-proxy?url=${encodeURIComponent(icon.url)}`
    : null;

  return (
    <html lang="en" className="scroll-smooth">
      <head>
        {/* 动态 favicon：基于 Notion 数据库图标；无图标时回退默认 favicon.ico */}
        <link
          rel="icon"
          href={proxied ? `${proxied}&w=32&h=32&f=png` : '/favicon.ico'}
          sizes="32x32"
        />
        <link
          rel="icon"
          href={proxied ? `${proxied}&w=16&h=16&f=png` : '/favicon.ico'}
          type="image/png"
          sizes="16x16"
        />
        <link
          rel="apple-touch-icon"
          href={proxied ? `${proxied}&w=192&h=192&f=png` : '/favicon.ico'}
          sizes="192x192"
        />
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
