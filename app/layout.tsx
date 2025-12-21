import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Homepage",
  description: "Developer and product designer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="no-scrollbar">{children}</body>
    </html>
  );
}
