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
    <div className="mt-12 py-8">
      <div className="text-center">
        <h4 className="text-base font-medium text-foreground mb-2">
          Want more structured evidence?
        </h4>
        <p className="text-sm text-foreground/50 mb-6">
          Generate a comprehensive summary of all {papersCount} papers in this thread.
        </p>
        <button
          onClick={onGenerate}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--golden-chestnut)] hover:bg-[var(--golden-chestnut)]/90 text-[var(--carbon-black)] font-semibold text-sm rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
