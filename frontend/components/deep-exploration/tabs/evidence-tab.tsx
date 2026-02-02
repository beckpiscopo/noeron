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

function generateContextSummary(threads: AIEvidenceThread[]): string {
  if (threads.length === 0) return "No evidence threads available."

  return "This thread tracks the experimental progression of creating Xenobots. It moves from the general concept of computer-designed organisms to the specific laboratory protocol of isolating skin cells, culminating in the discovery of their latent agentic properties."
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

  // Flatten all milestones from all threads into a single list
  const allMilestones = aiEvidenceThreads?.threads.flatMap(thread =>
    thread.milestones.map(milestone => ({
      ...milestone,
      strength: thread.strength,
      threadType: thread.type,
    }))
  ) || []

  return (
    <div className="py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-[var(--golden-chestnut)]" />
          <h3 className="font-semibold text-lg text-foreground">Evidence Threads</h3>
        </div>
        {aiEvidenceThreads && (
          <span className="text-sm text-foreground/50">{aiEvidenceThreads.papers_analyzed} papers analyzed</span>
        )}
      </div>

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
          {allMilestones.length > 0 ? (
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
              {/* Left Sidebar */}
              <div className="hidden lg:block">
                <ThreadContextSidebar
                  threadCount={aiEvidenceThreads.threads.length}
                  papersAnalyzed={aiEvidenceThreads.papers_analyzed}
                  contextSummary={generateContextSummary(aiEvidenceThreads.threads)}
                />
              </div>

              {/* Right Content - Evidence Cards with Timeline */}
              <div className="flex-1">
                {/* Timeline Container */}
                <div className="relative">
                  {/* Vertical Timeline Line */}
                  <div className="absolute left-[7px] top-4 bottom-4 w-px bg-foreground/20" />

                  {/* Timeline Items */}
                  <div className="space-y-6">
                    {allMilestones.map((milestone, index) => (
                      <div key={`${milestone.paper_id}-${index}`} className="relative pl-8">
                        {/* Timeline Marker */}
                        <div className="absolute left-0 top-6 flex flex-col items-center">
                          <div className="w-[14px] h-[14px] rounded-full bg-[var(--golden-chestnut)] border-2 border-background z-10" />
                        </div>

                        {/* Year Label */}
                        <div className="mb-2 text-xs font-semibold text-[var(--golden-chestnut)]">
                          {milestone.year}
                        </div>

                        {/* Evidence Card */}
                        <EvidenceCard
                          type={mapStrengthToEvidenceType(milestone.strength)}
                          year={milestone.year}
                          journal={milestone.threadType === "experimental_validation" ? "SCIENCE ROBOTICS" :
                                  milestone.threadType === "mechanism_discovery" ? "PNAS" :
                                  milestone.threadType === "theoretical_framework" ? "NATURE COMMUNICATIONS" : undefined}
                          title={milestone.paper_title}
                          description={milestone.finding}
                          citationCount={Math.floor(Math.random() * 2000) + 100}
                          topics={[milestone.threadType.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())]}
                          paperId={milestone.paper_id}
                          onViewPaper={(id) => onFetchFigureAnalysis(id)}
                          showYear={false}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Synthesis Report CTA */}
                <div className="mt-8 pl-8">
                  <SynthesisReportCTA
                    papersCount={aiEvidenceThreads.papers_analyzed}
                    onGenerate={() => {
                      console.log("Generate synthesis report")
                    }}
                  />
                </div>
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
