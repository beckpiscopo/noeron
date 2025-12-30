"use client"

import { ThemeToggle } from "./theme-toggle"

interface NoeronHeaderProps {
  onLogoClick?: () => void
}

export function NoeronHeader({ onLogoClick }: NoeronHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-xl px-6 py-4">
      <div className="mx-auto max-w-7xl flex items-center justify-between">
        <button onClick={onLogoClick} className="flex items-center gap-2.5 transition-colors hover:opacity-80">
          <span className="text-2xl font-medium tracking-tight text-foreground italic" style={{ fontFamily: 'var(--font-bodoni-moda)' }}>noeron</span>
        </button>
        <ThemeToggle />
      </div>
    </header>
  )
}
