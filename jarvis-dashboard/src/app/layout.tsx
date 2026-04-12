import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import Footer from "@/components/Footer"
import PWAInstallBanner from "@/components/mobile/PWAInstallBanner"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "JARVIS",
  description: "AI-powered command center",
  metadataBase: new URL("https://jarvis.dylangmurdy.com"),
  alternates: {
    canonical: "/",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "JARVIS",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
      </head>
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col">
          <main className="flex-1">
            {children}
          </main>
          <div className="hidden md:block">
            <Footer />
          </div>
        </div>
        <PWAInstallBanner />
      </body>
    </html>
  )
}
