"use client"

import { FileText, Loader2 } from "lucide-react"

interface SynthesisReportCTAProps {
  papersCount: number
  onGenerate: () => void
  isLoading?: boolean
}

export function SynthesisReportCTA({
  papersCount,
  onGenerate,
  isLoading = false,
}: SynthesisReportCTAProps) {
  return (
    <div className="mt-8 pt-6 border-t border-border">
      <div className="text-center">
        <h4 className="text-sm font-medium text-foreground/80 mb-1">
          Want more structured evidence?
        </h4>
        <p className="text-xs text-foreground/50 mb-4">
          Generate a comprehensive summary of all {papersCount} papers in this thread.
        </p>
        <button
          onClick={onGenerate}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--golden-chestnut)] hover:bg-[var(--golden-chestnut)]/90 text-[var(--carbon-black)] font-medium text-sm rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              Generate Synthesis Report
            </>
          )}
        </button>
      </div>
    </div>
  )
}
