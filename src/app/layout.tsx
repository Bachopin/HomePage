import './globals.css';
import { CrosshairToggle, DisableContextMenu } from '@/components/ui';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        {/* 直接使用图片代理 API 作为 favicon */}
        <link rel="icon" href="/api/image-proxy?url=https%3A//s3-us-west-2.amazonaws.com/public.notion-static.com/a11ca87f-5336-48b5-9956-9d9e361ff028/31.jpg&w=32&h=32&f=png" sizes="32x32" />
        <link rel="icon" href="/api/image-proxy?url=https%3A//s3-us-west-2.amazonaws.com/public.notion-static.com/a11ca87f-5336-48b5-9956-9d9e361ff028/31.jpg&w=16&h=16&f=png" type="image/png" sizes="16x16" />
        <link rel="apple-touch-icon" href="/api/image-proxy?url=https%3A//s3-us-west-2.amazonaws.com/public.notion-static.com/a11ca87f-5336-48b5-9956-9d9e361ff028/31.jpg&w=192&h=192&f=png" sizes="192x192" />
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
