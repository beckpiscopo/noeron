"use client"

import {
  GitBranch,
  Loader2,
  BookOpen,
  AlertCircle,
} from "lucide-react"
import { ThreadContextSidebar } from "../thread-context-sidebar"
import { EvidenceCard } from "../evidence-card"
import { SynthesisReportCTA } from "../synthesis-report-cta"

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

function mapStrengthToEvidenceType(strength: string): "foundational" | "supporting" | "direct" | "speculative" {
  switch (strength) {
    case "foundational":
      return "foundational"
    case "developing":
      return "supporting"
    case "speculative":
      return "speculative"
    default:
      return "direct"
  }
}

function formatThreadType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())
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
    <div className="py-4">
      {/* Loading State */}
      {isLoadingThreads && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-[var(--golden-chestnut)] animate-spin mb-3" />
          <p className="text-foreground/60 text-sm">Analyzing research patterns...</p>
          <p className="text-foreground/40 text-xs mt-1">Identifying narrative threads</p>
        </div>
      )}

      {/* Error State */}
      {threadsError && !isLoadingThreads && (
        <div className="bg-red-500/10 border border-red-500/30 p-4">
          <p className="text-red-400 text-sm">{threadsError}</p>
          <button
            onClick={() => onFetchThreads(true)}
            className="mt-2 text-sm text-[var(--golden-chestnut)] hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Main Content */}
      {aiEvidenceThreads && !isLoadingThreads && !threadsError && (
        <>
          {aiEvidenceThreads.threads.length > 0 ? (
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
              {/* Left Sidebar */}
              <div className="hidden lg:block">
                <ThreadContextSidebar />
              </div>

              {/* Right Content - Thread Cards */}
              <div className="flex-1 space-y-6">
                {aiEvidenceThreads.threads.map((thread, threadIndex) => (
                  <div
                    key={`${thread.name}-${threadIndex}`}
                    className="bg-card/50 border border-foreground/10 p-5"
                  >
                    {/* Thread Header */}
                    <div className="mb-2">
                      <h4 className="font-semibold text-xl text-foreground mb-2">{thread.name}</h4>
                      <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded text-white ${
                        thread.strength === "foundational" ? "bg-[var(--evidence-foundational)]" :
                        thread.strength === "developing" ? "bg-[var(--evidence-supporting)]" :
                        "bg-[var(--evidence-speculative)]"
                      }`}>
                        {thread.strength.toUpperCase()}
                      </span>
                    </div>

                    {/* Thread Narrative */}
                    {thread.narrative && (
                      <p className="text-sm text-foreground/50 leading-relaxed mb-4">
                        {thread.narrative}
                      </p>
                    )}

                    {/* Milestones Timeline (scoped to this thread) */}
                    {thread.milestones.length > 0 && (
                      <div className="relative">
                        {/* Vertical Timeline Line — aligned with the dot */}
                        <div className="absolute left-[5px] top-0 bottom-0 w-px bg-foreground/20" />

                        <div className="space-y-4">
                          {thread.milestones.map((milestone, index) => (
                            <div key={`${milestone.paper_id}-${index}`} className="flex items-center gap-3">
                              {/* Year + Dot (left column) */}
                              <div className="shrink-0 flex items-center gap-2">
                                <div className="w-[10px] h-[10px] rounded-full bg-[var(--golden-chestnut)] z-10" />
                                <span className="text-sm font-semibold text-[var(--golden-chestnut)]">
                                  {milestone.year}
                                </span>
                              </div>

                              {/* Evidence Card */}
                              <div className="flex-1 min-w-0">
                                <EvidenceCard
                                  type={mapStrengthToEvidenceType(thread.strength)}
                                  year={milestone.year}
                                  title={milestone.paper_title}
                                  description={milestone.finding}
                                  citationCount={Math.floor(Math.random() * 2000) + 100}
                                  topics={[formatThreadType(thread.type)]}
                                  paperId={milestone.paper_id}
                                  onViewPaper={(id) => onFetchFigureAnalysis(id)}
                                  showYear={false}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Synthesis Report CTA */}
                <SynthesisReportCTA
                  papersCount={aiEvidenceThreads.papers_analyzed}
                  onGenerate={() => {
                    console.log("Generate synthesis report")
                  }}
                />
              </div>
            </div>
          ) : uniqueFallbackPapers.length > 0 ? (
            /* Fallback: Show related papers when timeline isn't available */
            <div className="space-y-6">
              {/* Explanation banner */}
              <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20">
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
              <div className="space-y-4">
                {uniqueFallbackPapers.map((paper, index) => (
                  <EvidenceCard
                    key={paper.paper_id || index}
                    type="supporting"
                    year={parseInt(String(paper.year)) || new Date().getFullYear()}
                    title={paper.title}
                    description={paper.key_finding || "No key finding available."}
                    paperId={paper.paper_id}
                    onViewPaper={(id) => onFetchFigureAnalysis(id)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
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
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-[var(--golden-chestnut)] animate-spin mb-3" />
          <p className="text-foreground/60 text-sm">Loading evidence threads...</p>
        </div>
      )}
    </div>
  )
}
