"use client"

import { ReactNode } from "react"
import { Bookmark } from "lucide-react"
import { ThemeToggle } from "./theme-toggle"

interface NoeronHeaderProps {
  onLogoClick?: () => void
  onBookmarksClick?: () => void
  actions?: ReactNode
}

export function NoeronHeader({ onLogoClick, onBookmarksClick, actions }: NoeronHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-xl px-10 py-3">
      <div className="flex w-full items-center justify-between gap-2">
        <button onClick={onLogoClick} className="flex items-center gap-2.5 transition-colors hover:opacity-80">
          <span className="text-2xl font-normal tracking-[-0.5px] text-foreground" style={{ fontFamily: "'Russo One', sans-serif" }}>
            Noeron
          </span>
        </button>
        <div className="flex items-center gap-2.5">
          {onBookmarksClick && (
            <button
              onClick={onBookmarksClick}
              className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition hover:text-[var(--golden-chestnut)] hover:bg-[var(--golden-chestnut)]/10"
              title="Your Library"
            >
              <Bookmark className="h-4 w-4" />
            </button>
          )}
          {actions}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
