import type React from "react"
import type { Metadata } from "next"
import { Cardo, Manrope } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const cardo = Cardo({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-cardo",
})

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
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
    <html lang="en" className="dark">
      <body className={`${cardo.variable} ${manrope.variable} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
