import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JARVIS — AI Chief of Staff",
  description: "Dylan's personal AI command center",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-jarvis-bg text-jarvis-text antialiased">
        {children}
      </body>
    </html>
  );
}
