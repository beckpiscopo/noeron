"use client"

import { ReactNode } from "react"
import { ThemeToggle } from "./theme-toggle"

interface NoeronHeaderProps {
  onLogoClick?: () => void
  actions?: ReactNode
}

export function NoeronHeader({ onLogoClick, actions }: NoeronHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-xl px-10 py-3">
      <div className="flex w-full items-center justify-between gap-2">
        <button onClick={onLogoClick} className="flex items-center gap-2.5 transition-colors hover:opacity-80">
          <span className="text-2xl font-medium tracking-tight text-foreground italic" style={{ fontFamily: "var(--font-bodoni-moda)" }}>
            noeron
          </span>
        </button>
        <div className="flex items-center gap-2.5">
          {actions}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
