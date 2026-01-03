"use client"

import { useTheme } from "@/contexts/theme-context"

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="flex h-9 w-9 items-center justify-center rounded-full text-current transition hover:text-[var(--golden-chestnut)]"
      aria-label="Toggle dark mode"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      <div
        className="relative h-4 w-4 overflow-hidden rounded-full"
        aria-hidden="true"
      >
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
