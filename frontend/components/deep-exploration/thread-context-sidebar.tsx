"use client"

import { useState } from "react"

interface RelevanceFactor {
  id: string
  label: string
  active: boolean
}

interface ThreadContextSidebarProps {
  threadCount: number
  papersAnalyzed: number
  contextSummary: string
  onFilterChange?: (activeFilters: string[]) => void
}

const DEFAULT_FACTORS: RelevanceFactor[] = [
  { id: "experimental", label: "EXPERIMENTAL", active: true },
  { id: "morphogenesis", label: "MORPHOGENESIS", active: true },
  { id: "levin", label: "LEVIN ET AL.", active: false },
]

export function ThreadContextSidebar({
  contextSummary,
  onFilterChange,
}: ThreadContextSidebarProps) {
  const [factors, setFactors] = useState<RelevanceFactor[]>(DEFAULT_FACTORS)

  const toggleFactor = (id: string) => {
    const updated = factors.map((f) =>
      f.id === id ? { ...f, active: !f.active } : f
    )
    setFactors(updated)
    onFilterChange?.(updated.filter((f) => f.active).map((f) => f.id))
  }

  return (
    <div className="w-56 shrink-0 space-y-6">
      {/* Thread Context Header */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3">Thread Context</h4>
        <p className="text-sm text-foreground/50 leading-relaxed">
          {contextSummary}
        </p>
      </div>

      {/* Relevance Factors */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[var(--golden-chestnut)]">◆</span>
          <h4 className="text-xs font-medium uppercase tracking-wider text-foreground/50">
            Relevance Factors
          </h4>
        </div>
        <div className="flex flex-wrap gap-2">
          {factors.map((factor) => (
            <button
              key={factor.id}
              onClick={() => toggleFactor(factor.id)}
              className={`px-3 py-1.5 text-[10px] font-medium rounded border transition-all ${
                factor.active
                  ? "border-[var(--golden-chestnut)] bg-[var(--golden-chestnut)]/20 text-[var(--golden-chestnut)]"
                  : "border-foreground/20 bg-transparent text-foreground/40 hover:border-foreground/40"
              }`}
            >
              {factor.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
