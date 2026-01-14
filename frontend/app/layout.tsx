import type React from "react"
import type { Metadata } from "next"
import { Bodoni_Moda, Manrope, Space_Grotesk } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/contexts/theme-context"
import { BookmarkProvider } from "@/hooks/use-bookmarks"
import "./globals.css"
import "./noeron.css"

const bodoniModa = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["500"],
  style: ["normal", "italic"],
  variable: "--font-bodoni-moda",
})

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
})

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
})

export const metadata: Metadata = {
  title: "Research Companion - Podcast Interface",
  description: "Real-time contextualization for scientific podcasts",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${bodoniModa.variable} ${manrope.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        <ThemeProvider>
          <BookmarkProvider>
            {children}
            <Analytics />
          </BookmarkProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
