"use client"

import { useState } from "react"
import { Info, Filter } from "lucide-react"

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
  { id: "experimental", label: "Experimental", active: true },
  { id: "morphogenesis", label: "Morphogenesis", active: true },
  { id: "theoretical", label: "Theoretical", active: true },
]

export function ThreadContextSidebar({
  threadCount,
  papersAnalyzed,
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
    <div className="w-64 shrink-0 space-y-6">
      {/* Thread Context Header */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-foreground/50" />
          <h4 className="text-sm font-semibold text-foreground/80">Thread Context</h4>
        </div>
        <p className="text-xs text-foreground/60 leading-relaxed">
          {contextSummary}
        </p>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs text-foreground/50">
        <span>{threadCount} threads</span>
        <span>•</span>
        <span>{papersAnalyzed} papers</span>
      </div>

      {/* Relevance Factors */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-foreground/50" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
            Relevance Factors
          </h4>
        </div>
        <div className="flex flex-wrap gap-2">
          {factors.map((factor) => (
            <button
              key={factor.id}
              onClick={() => toggleFactor(factor.id)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                factor.active
                  ? "border-[var(--golden-chestnut)] bg-[var(--golden-chestnut)]/10 text-[var(--golden-chestnut)]"
                  : "border-border bg-transparent text-foreground/40 hover:border-foreground/30"
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
