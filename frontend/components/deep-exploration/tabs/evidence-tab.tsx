"use client"

import {
  GitBranch,
  FlaskConical,
  Sparkles,
  TrendingUp,
  ArrowUp,
  Loader2,
  BookOpen,
  FileText,
  AlertCircle,
} from "lucide-react"

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

interface ThreadMilestone {
  year: number
  paper_title: string
  paper_id: string
  finding: string
}

interface AIEvidenceThread {
  name: string
  type: "experimental_validation" | "theoretical_framework" | "mechanism_discovery" | "cross_domain"
  strength: "foundational" | "developing" | "speculative"
  milestones: ThreadMilestone[]
  narrative: string
}

interface EvidenceThreadsResponse {
  claim_id: string
  threads: AIEvidenceThread[]
  cached: boolean
  generated_at: string
  papers_analyzed: number
  eligible: boolean
  eligibility_reason: string
  error?: string
}

interface FallbackPaper {
  paper_id: string
  title: string
  section?: string
  year?: string | number
  key_finding?: string
}

interface EvidenceTabProps {
  aiEvidenceThreads: EvidenceThreadsResponse | null
  isLoadingThreads: boolean
  threadsError: string | null
  onFetchThreads: (forceRegenerate?: boolean) => void
  onFetchFigureAnalysis: (paperId: string) => void
  fallbackPapers?: FallbackPaper[]
}

export function EvidenceTab({
  aiEvidenceThreads,
  isLoadingThreads,
  threadsError,
  onFetchThreads,
  onFetchFigureAnalysis,
  fallbackPapers = [],
}: EvidenceTabProps) {
  // Deduplicate fallback papers by paper_id
  const uniqueFallbackPapers = fallbackPapers.reduce((acc, paper) => {
    if (!acc.find(p => p.paper_id === paper.paper_id)) {
      acc.push(paper)
    }
    return acc
  }, [] as FallbackPaper[])
  return (
    <CornerBrackets className="bg-card/30 p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-[var(--golden-chestnut)]" />
          <h3 className="font-bold text-xl">Evidence Threads</h3>
        </div>
        {!aiEvidenceThreads && isLoadingThreads && (
          <Loader2 className="w-4 h-4 text-[var(--golden-chestnut)] animate-spin" />
        )}
      </div>

      {/* Loading State */}
      {isLoadingThreads && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[var(--golden-chestnut)] animate-spin mb-3" />
          <p className="text-foreground/60 text-sm">Analyzing research patterns...</p>
          <p className="text-foreground/50 text-xs mt-1">Identifying narrative threads</p>
        </div>
      )}

      {/* Error State */}
      {threadsError && !isLoadingThreads && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-none p-4">
          <p className="text-red-400 text-sm">{threadsError}</p>
          <button
            onClick={() => onFetchThreads(true)}
            className="mt-2 text-sm text-[var(--golden-chestnut)] hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* AI Threads Content */}
      {aiEvidenceThreads && !isLoadingThreads && !threadsError && (
        <>
          {/* Metadata bar */}
          <div className="flex items-center justify-between text-xs text-foreground/50 pb-4 mb-6 border-b border-border">
            <span>{aiEvidenceThreads.papers_analyzed} papers analyzed</span>
            <button
              onClick={() => onFetchThreads(true)}
              className="text-[var(--golden-chestnut)] hover:underline flex items-center gap-1"
            >
              <ArrowUp className="w-3 h-3 rotate-45" />
              Regenerate
            </button>
          </div>

          {aiEvidenceThreads.threads.length > 0 ? (
            <div className="space-y-8">
              {aiEvidenceThreads.threads.map((thread, threadIndex) => (
                <div key={threadIndex} className="relative">
                  {/* Thread Header */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`mt-0.5 size-8 rounded flex items-center justify-center shrink-0 ${
                      thread.type === "experimental_validation" ? "bg-green-500/20 text-green-400" :
                      thread.type === "mechanism_discovery" ? "bg-blue-500/20 text-blue-400" :
                      thread.type === "theoretical_framework" ? "bg-purple-500/20 text-purple-400" :
                      "bg-orange-500/20 text-orange-400"
                    }`}>
                      {thread.type === "experimental_validation" ? (
                        <FlaskConical className="w-4 h-4" />
                      ) : thread.type === "mechanism_discovery" ? (
                        <GitBranch className="w-4 h-4" />
                      ) : thread.type === "theoretical_framework" ? (
                        <Sparkles className="w-4 h-4" />
                      ) : (
                        <TrendingUp className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-base text-foreground leading-tight">{thread.name}</h4>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          thread.strength === "foundational" ? "bg-green-500/20 text-green-400" :
                          thread.strength === "developing" ? "bg-yellow-500/20 text-yellow-400" :
                          "bg-gray-500/20 text-foreground/60"
                        }`}>
                          {thread.strength}
                        </span>
                        <span className="text-xs text-foreground/50 capitalize">
                          {thread.type.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Timeline Milestones */}
                  <div className="relative pl-5 ml-4 border-l-2 border-border space-y-4">
                    {thread.milestones.map((milestone, milestoneIndex) => (
                      <div key={milestoneIndex} className="relative pl-5 group">
                        {/* Timeline dot */}
                        <div className="absolute -left-[9px] top-1.5 w-3 h-3 rounded-full bg-foreground/10 border-2 border-[var(--golden-chestnut)] group-hover:bg-[var(--golden-chestnut)] transition-colors" />

                        {/* Year badge */}
                        <span className="text-xs font-mono text-[var(--golden-chestnut)] font-bold">
                          {milestone.year}
                        </span>

                        {/* Finding */}
                        <p className="text-sm text-foreground/80 mt-1 leading-relaxed">
                          {milestone.finding}
                        </p>

                        {/* Paper reference - clickable for figure analysis */}
                        <button
                          onClick={() => milestone.paper_id && onFetchFigureAnalysis(milestone.paper_id)}
                          className="text-xs text-foreground/50 mt-1.5 truncate block text-left hover:text-[var(--golden-chestnut)] hover:underline transition-colors cursor-pointer disabled:cursor-default disabled:hover:no-underline disabled:hover:text-foreground/50"
                          title={milestone.paper_id ? `Analyze figures from: ${milestone.paper_title}` : milestone.paper_title}
                          disabled={!milestone.paper_id}
                        >
                          {milestone.paper_title.length > 60
                            ? milestone.paper_title.slice(0, 60) + "..."
                            : milestone.paper_title}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Thread Narrative */}
                  <div className="mt-4 ml-4 pl-5 border-l-2 border-transparent">
                    <p className="text-sm text-foreground/60 italic leading-relaxed">
                      {thread.narrative}
                    </p>
                  </div>

                  {/* Divider between threads */}
                  {threadIndex < aiEvidenceThreads.threads.length - 1 && (
                    <div className="mt-8 border-t border-border" />
                  )}
                </div>
              ))}
            </div>
          ) : uniqueFallbackPapers.length > 0 ? (
            /* Fallback: Show related papers when timeline isn't available */
            <div className="space-y-6">
              {/* Explanation banner */}
              <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-foreground/80 font-medium">Timeline view unavailable</p>
                  <p className="text-xs text-foreground/60 mt-1">
                    {aiEvidenceThreads.eligibility_reason.includes("insufficient_papers")
                      ? "Need 4+ papers to show evolution of evidence over time."
                      : aiEvidenceThreads.eligibility_reason.includes("insufficient_year")
                        ? "The available research spans too few years to show temporal progression."
                        : "Insufficient temporal data for narrative analysis."}
                  </p>
                </div>
              </div>

              {/* Related Research header */}
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[var(--golden-chestnut)]" />
                <h4 className="font-medium text-sm">Related Research ({uniqueFallbackPapers.length} papers)</h4>
              </div>

              {/* Paper list */}
              <div className="space-y-3">
                {uniqueFallbackPapers.map((paper, index) => (
                  <div
                    key={paper.paper_id || index}
                    className="group p-3 bg-card/50 hover:bg-card/80 border border-border/50 rounded-lg transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="size-8 rounded bg-foreground/5 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-foreground/40" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {paper.year && (
                            <span className="text-xs font-mono text-[var(--golden-chestnut)] font-bold">
                              {paper.year}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => paper.paper_id && onFetchFigureAnalysis(paper.paper_id)}
                          className="text-sm text-foreground/80 text-left hover:text-[var(--golden-chestnut)] hover:underline transition-colors cursor-pointer leading-snug"
                          title={paper.paper_id ? `Analyze figures from: ${paper.title}` : paper.title}
                          disabled={!paper.paper_id}
                        >
                          {paper.title}
                        </button>
                        {paper.key_finding && (
                          <p className="text-xs text-foreground/50 mt-1.5 leading-relaxed">
                            {paper.key_finding}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Hint to check Overview */}
              <p className="text-xs text-foreground/40 text-center pt-2">
                View the <span className="text-[var(--golden-chestnut)]">Overview</span> tab for a synthesis of these findings
              </p>
            </div>
          ) : (
            <div className="text-center py-12">
              <GitBranch className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
              <p className="text-foreground/50 text-sm">
                {!aiEvidenceThreads.eligible ? (
                  <>
                    <span className="block mb-1 font-medium">Unable to generate threads</span>
                    <span className="text-xs text-foreground/40">
                      {aiEvidenceThreads.eligibility_reason.includes("insufficient_papers")
                        ? "Need 4+ papers to identify patterns"
                        : aiEvidenceThreads.eligibility_reason.includes("insufficient_year")
                          ? "Need papers spanning 3+ years"
                          : "Insufficient data for narrative analysis"}
                    </span>
                  </>
                ) : (
                  "No distinct evidence threads identified"
                )}
              </p>
            </div>
          )}
        </>
      )}

      {/* Initial state - auto-loading */}
      {!aiEvidenceThreads && !isLoadingThreads && !threadsError && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[var(--golden-chestnut)] animate-spin mb-3" />
          <p className="text-foreground/60 text-sm">Loading evidence threads...</p>
        </div>
      )}
    </CornerBrackets>
  )
}
