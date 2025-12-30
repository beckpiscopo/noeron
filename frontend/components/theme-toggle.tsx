"use client"

import { useTheme } from "@/contexts/theme-context"

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center justify-center size-9 rounded-full border-2 border-current transition-all hover:scale-110"
      aria-label="Toggle dark mode"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      <div className="relative size-4 overflow-hidden rounded-full">
        <div
          className="absolute inset-0 rounded-full bg-current transition-transform duration-300"
          style={{
            clipPath: theme === "dark" ? "inset(0 50% 0 0)" : "inset(0 0 0 50%)",
          }}
        />
      </div>
    </button>
  )
}

