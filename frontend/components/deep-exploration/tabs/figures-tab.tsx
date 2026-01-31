"use client"

import { useState, useEffect } from "react"
import {
  Image as ImageIcon,
  Sparkles,
  Loader2,
  Settings,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { MarkdownContent } from "@/components/ui/markdown-content"
import { getClaimFigures, type ClaimFigure, type ClaimFiguresResponse, type FigureAnalysis, type AnalyzeFiguresResponse } from "@/lib/api"

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

interface FiguresTabProps {
  claimId: string
  episodeId: string
  // For AI analysis (Agentic Vision)
  figureAnalysis: AnalyzeFiguresResponse | null
  isLoadingFigures: boolean
  figuresError: string | null
  selectedFigure: FigureAnalysis | null
  onSelectFigure: (figure: FigureAnalysis | null) => void
  onFetchFigureAnalysis: (paperId: string) => void
  onClearFigures: () => void
  onOpenApiKeyModal: () => void
  pendingFigurePaperId: string | null
  onViewSourcePaper?: (paperId: string) => void
}

export function FiguresTab({
  claimId,
  episodeId,
  figureAnalysis,
  isLoadingFigures,
  figuresError,
  selectedFigure,
  onSelectFigure,
  onFetchFigureAnalysis,
  onClearFigures,
  onOpenApiKeyModal,
  pendingFigurePaperId,
  onViewSourcePaper,
}: FiguresTabProps) {
  // Claim figures state (auto-loaded from evidence papers)
  const [claimFigures, setClaimFigures] = useState<ClaimFiguresResponse | null>(null)
  const [isLoadingClaimFigures, setIsLoadingClaimFigures] = useState(false)
  const [claimFiguresError, setClaimFiguresError] = useState<string | null>(null)
  const [showAllFigures, setShowAllFigures] = useState(false)
  const [selectedClaimFigure, setSelectedClaimFigure] = useState<ClaimFigure | null>(null)

  // Auto-fetch claim figures on mount
  useEffect(() => {
    let cancelled = false

    const fetchClaimFigures = async () => {
      if (!claimId || !episodeId) return

      setIsLoadingClaimFigures(true)
      setClaimFiguresError(null)

      try {
        const data = await getClaimFigures(claimId, episodeId, 20)
        if (cancelled) return

        if (data.error) {
          setClaimFiguresError(data.error)
        } else {
          setClaimFigures(data)
          // Select first figure by default
          if (data.figures.length > 0) {
            setSelectedClaimFigure(data.figures[0])
          }
        }
      } catch (err) {
        if (!cancelled) {
          setClaimFiguresError(err instanceof Error ? err.message : "Failed to load figures")
        }
      } finally {
        if (!cancelled) {
          setIsLoadingClaimFigures(false)
        }
      }
    }

    fetchClaimFigures()

    return () => {
      cancelled = true
    }
  }, [claimId, episodeId])

  // Show top 5 figures initially, expand to show all
  const INITIAL_DISPLAY_LIMIT = 5
  const displayedFigures = claimFigures?.figures
    ? (showAllFigures ? claimFigures.figures : claimFigures.figures.slice(0, INITIAL_DISPLAY_LIMIT))
    : []
  const hasMoreFigures = (claimFigures?.figures.length ?? 0) > INITIAL_DISPLAY_LIMIT

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ImageIcon className="w-6 h-6 text-[var(--golden-chestnut)]" />
          <h3 className="font-bold text-xl">Paper Figures</h3>
        </div>
        {claimFigures && (
          <span className="text-sm text-foreground/50">
            {claimFigures.total_available} figure{claimFigures.total_available !== 1 ? 's' : ''} from {claimFigures.papers_with_figures} paper{claimFigures.papers_with_figures !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Loading State */}
      {isLoadingClaimFigures && (
        <CornerBrackets className="bg-card/30 p-12">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-[var(--golden-chestnut)] animate-spin mb-4" />
            <p className="text-foreground/60">Loading figures from evidence papers...</p>
          </div>
        </CornerBrackets>
      )}

      {/* Error State */}
      {claimFiguresError && !isLoadingClaimFigures && (
        <CornerBrackets className="bg-card/30 p-8 text-center">
          <ImageIcon className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
          <p className="text-foreground/60 mb-2">
            {claimFiguresError.includes("Not Found") || claimFiguresError.includes("evidence threads")
              ? "Evidence threads need to generate first"
              : claimFiguresError}
          </p>
          <p className="text-foreground/40 text-xs">
            Switch to the Evidence tab and wait for threads to load, then come back here.
          </p>
        </CornerBrackets>
      )}

      {/* No figures available */}
      {claimFigures && claimFigures.figures.length === 0 && !isLoadingClaimFigures && (
        <CornerBrackets className="bg-card/30 p-8 text-center">
          <ImageIcon className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
          <p className="text-foreground/50">
            {claimFigures.message || "No figures available from evidence papers"}
          </p>
          {claimFigures.papers_checked !== undefined && (
            <p className="text-foreground/40 text-xs mt-2">
              Checked {claimFigures.papers_checked} paper{claimFigures.papers_checked !== 1 ? 's' : ''} from evidence threads
            </p>
          )}
        </CornerBrackets>
      )}

      {/* Figures Grid */}
      {claimFigures && claimFigures.figures.length > 0 && !isLoadingClaimFigures && (
        <>
          {/* Selected Figure Detail */}
          {selectedClaimFigure && (
            <CornerBrackets className="bg-card/30 p-6">
              <div className="space-y-4">
                {/* Image */}
                <div className="aspect-video bg-background rounded overflow-hidden border border-border">
                  <img
                    src={selectedClaimFigure.image_url || `/api/figures/${selectedClaimFigure.image_path}`}
                    alt={selectedClaimFigure.title || "Selected figure"}
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* Title */}
                {selectedClaimFigure.title && (
                  <p className="text-base font-medium text-foreground/80">
                    {selectedClaimFigure.title}
                  </p>
                )}

                {/* Caption */}
                {selectedClaimFigure.caption && (
                  <p className="text-sm text-foreground/60 leading-relaxed">
                    {selectedClaimFigure.caption}
                  </p>
                )}

                {/* Paper link */}
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <span className="text-sm text-foreground/50 truncate max-w-[70%]">
                    From: {selectedClaimFigure.paper_title}
                  </span>
                  <div className="flex items-center gap-2">
                    {onViewSourcePaper && (
                      <button
                        onClick={() => onViewSourcePaper(selectedClaimFigure.paper_id)}
                        className="text-sm text-[var(--golden-chestnut)] hover:underline flex items-center gap-1"
                      >
                        View Paper
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => onFetchFigureAnalysis(selectedClaimFigure.paper_id)}
                      className="text-sm px-3 py-1.5 bg-[var(--golden-chestnut)]/10 text-[var(--golden-chestnut)] hover:bg-[var(--golden-chestnut)]/20 transition-colors flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      Analyze with AI
                    </button>
                  </div>
                </div>
              </div>
            </CornerBrackets>
          )}

          {/* Figure Thumbnails */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {displayedFigures.map((fig) => (
              <button
                key={`${fig.paper_id}-${fig.figure_id}`}
                onClick={() => setSelectedClaimFigure(fig)}
                className={`relative aspect-square border-2 transition-all overflow-hidden bg-background group ${
                  selectedClaimFigure?.figure_id === fig.figure_id && selectedClaimFigure?.paper_id === fig.paper_id
                    ? "border-[var(--golden-chestnut)]"
                    : "border-border hover:border-foreground/30"
                }`}
              >
                <img
                  src={fig.image_url || `/api/figures/${fig.image_path}`}
                  alt={fig.title || "Figure"}
                  className="w-full h-full object-cover"
                />
                {/* Paper title overlay on hover */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[10px] text-white truncate">
                    {fig.paper_title}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Show All / Show Less */}
          {hasMoreFigures && (
            <button
              onClick={() => setShowAllFigures(!showAllFigures)}
              className="w-full py-3 border border-border hover:bg-foreground/5 text-foreground/60 hover:text-foreground transition-colors flex items-center justify-center gap-2"
            >
              {showAllFigures ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Show fewer figures
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Show all {claimFigures.total_available} figures
                </>
              )}
            </button>
          )}
        </>
      )}

      {/* AI Analysis Section (when user clicks "Analyze with AI") */}
      {(isLoadingFigures || figuresError || figureAnalysis) && (
        <div className="pt-6 border-t border-border">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-[var(--golden-chestnut)]" />
            <h4 className="font-bold text-lg">AI Analysis</h4>
            <span className="text-xs text-foreground/50 bg-[var(--golden-chestnut)]/20 px-2 py-0.5 rounded">
              Agentic Vision
            </span>
          </div>

          {/* Loading AI Analysis */}
          {isLoadingFigures && (
            <CornerBrackets className="bg-card/30 p-8">
              <div className="flex flex-col items-center justify-center">
                <Loader2 className="w-6 h-6 text-[var(--golden-chestnut)] animate-spin mb-3" />
                <p className="text-foreground/60 text-sm">Analyzing figures with AI...</p>
                <p className="text-foreground/50 text-xs mt-1">Using Agentic Vision to examine graphs and diagrams</p>
              </div>
            </CornerBrackets>
          )}

          {/* AI Analysis Error States */}
          {figuresError && !isLoadingFigures && (
            <>
              {figuresError === "no_figures" && (
                <CornerBrackets className="bg-card/30 p-6">
                  <div className="flex flex-col items-center justify-center text-center">
                    <ImageIcon className="w-8 h-8 text-foreground/20 mb-3" />
                    <p className="text-foreground/60 text-sm">No figures available for AI analysis</p>
                    <button
                      onClick={onClearFigures}
                      className="mt-3 text-sm text-[var(--golden-chestnut)] hover:underline"
                    >
                      Dismiss
                    </button>
                  </div>
                </CornerBrackets>
              )}

              {figuresError === "rate_limited" && (
                <CornerBrackets className="bg-amber-500/10 p-6">
                  <div className="flex flex-col items-center justify-center text-center">
                    <p className="text-amber-400 text-sm">API rate limit reached</p>
                    <p className="text-foreground/40 text-xs mt-1">Wait a moment and try again.</p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => pendingFigurePaperId && onFetchFigureAnalysis(pendingFigurePaperId)}
                        className="text-sm px-3 py-1.5 bg-[var(--golden-chestnut)]/20 text-[var(--golden-chestnut)]"
                      >
                        Retry
                      </button>
                      <button onClick={onClearFigures} className="text-sm px-3 py-1.5 text-foreground/50">
                        Cancel
                      </button>
                    </div>
                  </div>
                </CornerBrackets>
              )}

              {figuresError === "invalid_key" && (
                <CornerBrackets className="bg-red-500/10 p-6">
                  <div className="flex flex-col items-center justify-center text-center">
                    <Settings className="w-8 h-8 text-red-400/60 mb-3" />
                    <p className="text-red-400 text-sm">API key issue</p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={onOpenApiKeyModal}
                        className="text-sm px-3 py-1.5 bg-[var(--golden-chestnut)]/20 text-[var(--golden-chestnut)]"
                      >
                        Update API Key
                      </button>
                      <button onClick={onClearFigures} className="text-sm px-3 py-1.5 text-foreground/50">
                        Cancel
                      </button>
                    </div>
                  </div>
                </CornerBrackets>
              )}

              {figuresError !== "no_figures" && figuresError !== "rate_limited" && figuresError !== "invalid_key" && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-none p-4">
                  <p className="text-red-400 text-sm">{figuresError}</p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => pendingFigurePaperId && onFetchFigureAnalysis(pendingFigurePaperId)}
                      className="text-sm text-[var(--golden-chestnut)] hover:underline"
                    >
                      Retry
                    </button>
                    <button onClick={onClearFigures} className="text-sm text-foreground/50 hover:underline">
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* AI Analysis Results */}
          {figureAnalysis && !isLoadingFigures && !figuresError && (
            <CornerBrackets className="bg-card/30 p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-foreground/50">
                  {figureAnalysis.total_figures} figure{figureAnalysis.total_figures !== 1 ? 's' : ''} analyzed
                </span>
                <button
                  onClick={onClearFigures}
                  className="text-sm text-foreground/50 hover:text-foreground"
                >
                  Close
                </button>
              </div>

              {/* Analyzed figure thumbnails */}
              {figureAnalysis.figures.length > 1 && (
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                  {figureAnalysis.figures.map((fig, idx) => (
                    <button
                      key={fig.figure_id}
                      onClick={() => onSelectFigure(fig)}
                      className={`shrink-0 w-16 h-16 border-2 transition-all overflow-hidden bg-background ${
                        selectedFigure?.figure_id === fig.figure_id
                          ? "border-[var(--golden-chestnut)]"
                          : "border-border hover:border-foreground/30"
                      }`}
                    >
                      <img
                        src={fig.image_url || `/api/figures/${fig.image_path}`}
                        alt={`Figure ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Selected analyzed figure detail */}
              {selectedFigure && (
                <div className="space-y-4">
                  <div className="aspect-video bg-background rounded overflow-hidden border border-border">
                    <img
                      src={selectedFigure.image_url || `/api/figures/${selectedFigure.image_path}`}
                      alt="Selected figure"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {selectedFigure.title && (
                    <p className="text-base font-medium text-foreground/80">{selectedFigure.title}</p>
                  )}

                  {selectedFigure.caption && (
                    <p className="text-sm text-foreground/50 italic">{selectedFigure.caption}</p>
                  )}

                  <div className="space-y-2 pt-4 border-t border-border">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[var(--golden-chestnut)]" />
                      <span className="font-medium text-sm">AI Analysis</span>
                      {selectedFigure.code_executed && (
                        <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                          Enhanced
                        </span>
                      )}
                    </div>
                    <MarkdownContent content={selectedFigure.analysis} />
                  </div>
                </div>
              )}

              {figureAnalysis.figures.length === 0 && (
                <p className="text-foreground/50 text-sm text-center py-4">
                  No figures found for this paper
                </p>
              )}
            </CornerBrackets>
          )}
        </div>
      )}
    </div>
  )
}
