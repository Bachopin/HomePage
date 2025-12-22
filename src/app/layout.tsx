import type { Metadata } from 'next';
import './globals.css';
import { CrosshairToggle, DisableContextMenu } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Personal Homepage',
  description: 'Developer and product designer',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="no-scrollbar">
        {children}
        <CrosshairToggle />
        <DisableContextMenu />
      </body>
    </html>
  );
}
