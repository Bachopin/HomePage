import type { Metadata } from "next";
import "./globals.css";
import CrosshairToggle from "@/components/ui/CrosshairToggle";

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
      <body className="no-scrollbar">
        {children}
        <CrosshairToggle />
      </body>
    </html>
  );
}
