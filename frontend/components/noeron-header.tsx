"use client"

import { FlaskConical } from "lucide-react"

interface NoeronHeaderProps {
  onLogoClick?: () => void
}

export function NoeronHeader({ onLogoClick }: NoeronHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-[#28392e] bg-[#102216]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <button onClick={onLogoClick} className="flex items-center gap-2.5 transition-colors hover:opacity-80">
          <div className="flex size-7 items-center justify-center rounded-full bg-[#FDA92B]">
            <FlaskConical className="size-4 text-[#102216]" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">Noeron</span>
        </button>
      </div>
    </header>
  )
}
