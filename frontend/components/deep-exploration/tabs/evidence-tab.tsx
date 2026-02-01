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
import { ThreadContextSidebar } from "../thread-context-sidebar"
import { EvidenceCard } from "../evidence-card"
import { SynthesisReportCTA } from "../synthesis-report-cta"

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

function generateContextSummary(threads: AIEvidenceThread[]): string {
  if (threads.length === 0) return "No evidence threads available."

  const types = [...new Set(threads.map(t => t.type.replace(/_/g, " ")))]
  return `This thread tracks the ${types.join(" and ")} of the research. It synthesizes findings across multiple papers to show how the evidence has developed over time.`
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
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
              {/* Left Sidebar - hidden on mobile, shown on lg+ */}
              <div className="hidden lg:block">
                <ThreadContextSidebar
                  threadCount={aiEvidenceThreads.threads.length}
                  papersAnalyzed={aiEvidenceThreads.papers_analyzed}
                  contextSummary={generateContextSummary(aiEvidenceThreads.threads)}
                />
              </div>

              {/* Mobile stats bar - shown only on mobile */}
              <div className="lg:hidden flex items-center gap-4 text-xs text-foreground/50 pb-4 border-b border-border">
                <span>{aiEvidenceThreads.threads.length} threads</span>
                <span>•</span>
                <span>{aiEvidenceThreads.papers_analyzed} papers</span>
              </div>

              {/* Right Content - Evidence Cards */}
              <div className="flex-1 space-y-6">
                {aiEvidenceThreads.threads.map((thread, threadIndex) => (
                  <div key={threadIndex} className="space-y-4">
                    {/* Thread Header */}
                    <div className="flex items-center gap-3 pb-2 border-b border-border/50">
                      <div className={`size-6 rounded flex items-center justify-center shrink-0 ${
                        thread.type === "experimental_validation" ? "bg-green-500/20 text-green-400" :
                        thread.type === "mechanism_discovery" ? "bg-blue-500/20 text-blue-400" :
                        thread.type === "theoretical_framework" ? "bg-purple-500/20 text-purple-400" :
                        "bg-orange-500/20 text-orange-400"
                      }`}>
                        {thread.type === "experimental_validation" ? (
                          <FlaskConical className="w-3.5 h-3.5" />
                        ) : thread.type === "mechanism_discovery" ? (
                          <GitBranch className="w-3.5 h-3.5" />
                        ) : thread.type === "theoretical_framework" ? (
                          <Sparkles className="w-3.5 h-3.5" />
                        ) : (
                          <TrendingUp className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <h4 className="font-medium text-sm text-foreground">{thread.name}</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded ${
                        thread.strength === "foundational" ? "bg-[var(--evidence-foundational-bg)] text-[var(--evidence-foundational)]" :
                        thread.strength === "developing" ? "bg-[var(--evidence-supporting-bg)] text-[var(--evidence-supporting)]" :
                        "bg-[var(--evidence-speculative-bg)] text-[var(--evidence-speculative)]"
                      }`}>
                        {thread.strength}
                      </span>
                    </div>

                    {/* Milestone Cards */}
                    <div className="space-y-3 pl-4 border-l-2 border-border/30">
                      {thread.milestones.map((milestone, milestoneIndex) => (
                        <EvidenceCard
                          key={milestoneIndex}
                          type={mapStrengthToEvidenceType(thread.strength)}
                          year={milestone.year}
                          title={milestone.paper_title}
                          description={milestone.finding}
                          paperId={milestone.paper_id}
                          onViewPaper={(id) => onFetchFigureAnalysis(id)}
                        />
                      ))}
                    </div>

                    {/* Thread Narrative */}
                    <p className="text-sm text-foreground/50 italic pl-4">
                      {thread.narrative}
                    </p>
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
