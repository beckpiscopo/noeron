"use client"

import {
  Sparkles,
  ExternalLink,
  Loader2,
} from "lucide-react"
import { MarkdownContent } from "@/components/ui/markdown-content"
import { BookmarkButton } from "@/components/bookmark-button"
import type { Paper } from "@/lib/supabase"

function CornerBrackets({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute -top-px -left-px w-4 h-4 border-l border-t border-[var(--golden-chestnut)]/40" />
      <div className="absolute -top-px -right-px w-4 h-4 border-r border-t border-[var(--golden-chestnut)]/40" />
      <div className="absolute -bottom-px -left-px w-4 h-4 border-l border-b border-[var(--golden-chestnut)]/40" />
      <div className="absolute -bottom-px -right-px w-4 h-4 border-r border-b border-[var(--golden-chestnut)]/40" />
      {children}
    </div>
  )
}

interface DeepDiveSummary {
  claim_id: string
  summary: string
  cached: boolean
  generated_at: string
  rag_query: string
  papers_retrieved: number
  papers?: Array<{
    paper_id: string
    title: string
    section: string
    year: string
    key_finding?: string
  }>
  error?: string
}

interface OverviewTabProps {
  synthesisMode: "simplified" | "technical"
  onSynthesisModeChange: (mode: "simplified" | "technical") => void
  deepDiveSummaries: Partial<Record<"simplified" | "technical", DeepDiveSummary>>
  isLoadingDeepDive: { simplified: boolean; technical: boolean }
  deepDiveErrors: { simplified: string | null; technical: string | null }
  onFetchDeepDive: (style: "simplified" | "technical", forceRegenerate?: boolean) => void
  episodeId: string
  onViewSourcePaper: (paperId?: string) => void
}

export function OverviewTab({
  synthesisMode,
  onSynthesisModeChange,
  deepDiveSummaries,
  isLoadingDeepDive,
  deepDiveErrors,
  onFetchDeepDive,
  episodeId,
  onViewSourcePaper,
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Synthesis Section */}
      <CornerBrackets className="bg-card/30 p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[var(--golden-chestnut)]" />
            Synthesis
          </h3>

          {/* Segmented Control */}
          <div className="flex p-1 bg-background rounded-none">
            <button
              onClick={() => {
                onSynthesisModeChange("simplified")
                if (!deepDiveSummaries.simplified && !isLoadingDeepDive.simplified) {
                  onFetchDeepDive("simplified")
                }
              }}
              className={`px-3 py-1.5 rounded-none text-sm font-medium transition-all ${
                synthesisMode === "simplified"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-foreground/50 hover:text-foreground"
              }`}
            >
              Simplified
            </button>
            <button
              onClick={() => {
                onSynthesisModeChange("technical")
                if (!deepDiveSummaries.technical && !isLoadingDeepDive.technical) {
                  onFetchDeepDive("technical")
                }
              }}
              className={`px-3 py-1.5 rounded-none text-sm font-medium transition-all ${
                synthesisMode === "technical"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-foreground/50 hover:text-foreground"
              }`}
            >
              Technical
            </button>
          </div>
        </div>

        <div className="space-y-4 text-foreground/80 leading-relaxed">
          {/* Loading State */}
          {isLoadingDeepDive[synthesisMode] && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 text-[var(--golden-chestnut)] animate-spin" />
                <div className="text-center">
                  <p className="text-foreground/80 font-medium">
                    Generating {synthesisMode === "simplified" ? "Simplified" : "Technical"} Summary...
                  </p>
                  <p className="text-foreground/50 text-sm mt-1">Searching papers and synthesizing evidence</p>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {deepDiveErrors[synthesisMode] && !isLoadingDeepDive[synthesisMode] && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-none p-4">
              <p className="text-red-400 text-sm">{deepDiveErrors[synthesisMode]}</p>
              <button
                onClick={() => onFetchDeepDive(synthesisMode, true)}
                className="mt-3 text-sm text-[var(--golden-chestnut)] hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Summary Content */}
          {deepDiveSummaries[synthesisMode] && !isLoadingDeepDive[synthesisMode] && !deepDiveErrors[synthesisMode] && (() => {
            const currentSummary = deepDiveSummaries[synthesisMode]!
            return (
              <>
                {/* Metadata bar */}
                <div className="flex items-center gap-4 text-xs text-foreground/50 pb-3 border-b border-border">
                  <span>{currentSummary.papers_retrieved} papers analyzed</span>
                  {currentSummary.cached && (
                    <span className="px-2 py-0.5 bg-card rounded text-foreground/60">Cached</span>
                  )}
                </div>

                {/* Render markdown summary */}
                <MarkdownContent content={currentSummary.summary} variant="synthesis" />
              </>
            )
          })()}

          {/* Initial state - auto-loading */}
          {!deepDiveSummaries[synthesisMode] && !isLoadingDeepDive[synthesisMode] && !deepDiveErrors[synthesisMode] && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 text-[var(--golden-chestnut)] animate-spin" />
                <p className="text-foreground/60 text-sm">Loading summary...</p>
              </div>
            </div>
          )}
        </div>
      </CornerBrackets>

      {/* Sources Section - Two Column Grid */}
      {deepDiveSummaries[synthesisMode]?.papers && deepDiveSummaries[synthesisMode]!.papers!.length > 0 && (() => {
        const currentSummary = deepDiveSummaries[synthesisMode]!
        const uniquePapers = [...currentSummary.papers!]
          .filter((paper, index, self) =>
            index === self.findIndex(p => p.paper_id === paper.paper_id)
          )
          .sort((a, b) => {
            const yearA = parseInt(a.year) || 0
            const yearB = parseInt(b.year) || 0
            return yearB - yearA
          })

        return (
          <div className="mt-8">
            {/* Sources Header */}
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-foreground">Sources Retrieved</h4>
              <span className="text-sm text-foreground/50">{uniquePapers.length} papers</span>
            </div>

            {/* Two Column Grid of Source Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {uniquePapers.map((paper, idx) => (
                <div
                  key={idx}
                  className="bg-card/50 border border-border p-4 hover:bg-card/70 transition-colors group"
                >
                  {/* Year and Journal */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--golden-chestnut)] bg-[var(--golden-chestnut)]/10 px-2 py-0.5 rounded">
                        {paper.year || "n/a"}
                      </span>
                      {paper.section && (
                        <span className="text-xs text-foreground/50">
                          {paper.section}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onViewSourcePaper(paper.paper_id)}
                        className="text-xs text-[var(--golden-chestnut)] hover:text-[var(--golden-chestnut)]/80 transition-colors flex items-center gap-1"
                      >
                        View
                        <ExternalLink className="w-3 h-3" />
                      </button>
                      <BookmarkButton
                        type="paper"
                        item={{ paper_id: paper.paper_id, title: paper.title } as Paper}
                        episodeId={episodeId}
                        size="icon"
                        variant="ghost"
                        className="!h-5 !w-5 !p-0"
                      />
                    </div>
                  </div>

                  {/* Title */}
                  <h5 className="text-sm font-medium text-foreground leading-snug mb-2">
                    {paper.title}
                  </h5>

                  {/* Key Finding */}
                  {paper.key_finding && (
                    <p className="text-xs text-foreground/60 leading-relaxed line-clamp-3">
                      {paper.key_finding}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
