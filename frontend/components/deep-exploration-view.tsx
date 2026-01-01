"use client"

import { useState, useEffect } from "react"
import {
  ArrowLeft,
  Quote,
  Sparkles,
  HelpCircle,
  TrendingUp,
  FlaskConical,
  ChevronLeft,
  ChevronRight,
  Plus,
  ExternalLink,
  GitBranch,
  Scissors,
  Mic,
  ArrowUp,
  Loader2,
} from "lucide-react"
import { NoeronHeader } from "./noeron-header"
import { callMcpTool } from "@/lib/api"

interface DeepExplorationViewProps {
  episode: {
    title: string
    host: string
    guest: string
    category: string
    currentTime: number
  }
  claim: {
    id: string
    title: string
    timestamp: number
    description: string
    source: string
  }
  episodeId: string
  onBack: () => void
  onViewSourcePaper: (paperId?: string) => void
}

interface EvidenceThread {
  type: "primary" | "replication" | "counter"
  title: string
  paper_title: string
  description: string
  paper_id: string
  source_link: string
  confidence_score: number
  citation_count: number
  highlighted: boolean
}

interface RelatedConcept {
  title: string
  description: string
  paper_title: string
  paper_id: string
  year: string | number
}

interface ClaimContextData {
  claim_id: string
  claim_data: {
    claim_text: string
    speaker_stance: string
    needs_backing_because: string
    claim_type: string
    context_tags: Record<string, string>
  }
  evidence_threads: EvidenceThread[]
  related_concepts: RelatedConcept[]
  synthesis: {
    claim_text: string
    rationale: string
    speaker_stance: string
    claim_type: string
    context_tags: Record<string, string>
  }
  confidence_metrics: {
    confidence_level: string
    confidence_score: number
    consensus_percentage: number
    evidence_counts: {
      primary: number
      replication: number
      counter: number
    }
  }
  segment_info: {
    timestamp: string
    speaker: string
    transcript_excerpt: string
  }
  error?: string
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
  }>
  error?: string
}

// AI-generated evidence threads (narrative research arcs)
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

export function DeepExplorationView({ episode, claim, episodeId, onBack, onViewSourcePaper }: DeepExplorationViewProps) {
  const [synthesisMode, setSynthesisMode] = useState<"simplified" | "technical" | "ai_summary" | "raw">("technical")
  const [contextData, setContextData] = useState<ClaimContextData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Deep dive summary state
  const [deepDiveSummary, setDeepDiveSummary] = useState<DeepDiveSummary | null>(null)
  const [isLoadingDeepDive, setIsLoadingDeepDive] = useState(false)
  const [deepDiveError, setDeepDiveError] = useState<string | null>(null)

  // AI Evidence threads state (narrative research arcs)
  const [aiEvidenceThreads, setAiEvidenceThreads] = useState<EvidenceThreadsResponse | null>(null)
  const [isLoadingThreads, setIsLoadingThreads] = useState(false)
  const [threadsError, setThreadsError] = useState<string | null>(null)

  // Fetch claim context data on mount
  useEffect(() => {
    let cancelled = false

    const fetchClaimContext = async () => {
      setIsLoading(true)
      setError(null)

      // Check if claim.id is in the correct format
      if (!claim.id.includes("-")) {
        setError(
          "This claim doesn't have the required segment ID format. " +
          "Please ensure the database has been migrated with segment_claim_id values. " +
          `(Current ID: ${claim.id})`
        )
        setIsLoading(false)
        return
      }

      try {
        const data = await callMcpTool<ClaimContextData>("get_claim_context", {
          claim_id: claim.id,
          episode_id: episodeId,
          include_related_concepts: true,
          related_concepts_limit: 5,
        })

        if (cancelled) return

        if (data.error) {
          setError(data.error)
        } else {
          setContextData(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load claim context")
          console.error("Error fetching claim context:", err)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchClaimContext()

    return () => {
      cancelled = true
    }
  }, [claim.id, episodeId])

  // Function to fetch deep dive summary on-demand
  const fetchDeepDiveSummary = async (forceRegenerate = false) => {
    if (!claim.id.includes("-")) return

    setIsLoadingDeepDive(true)
    setDeepDiveError(null)

    try {
      const data = await callMcpTool<DeepDiveSummary>("generate_deep_dive_summary", {
        claim_id: claim.id,
        episode_id: episodeId,
        n_results: 7,
        force_regenerate: forceRegenerate,
      })

      if (data.error) {
        setDeepDiveError(data.error)
      } else {
        setDeepDiveSummary(data)
      }
    } catch (err) {
      setDeepDiveError(err instanceof Error ? err.message : "Failed to generate deep dive summary")
      console.error("Error fetching deep dive summary:", err)
    } finally {
      setIsLoadingDeepDive(false)
    }
  }

  // Function to fetch AI evidence threads on-demand
  const fetchEvidenceThreads = async (forceRegenerate = false) => {
    if (!claim.id.includes("-")) return

    setIsLoadingThreads(true)
    setThreadsError(null)

    try {
      const data = await callMcpTool<EvidenceThreadsResponse>("generate_evidence_threads", {
        claim_id: claim.id,
        episode_id: episodeId,
        n_results: 10,
        force_regenerate: forceRegenerate,
      })

      if (data.error) {
        setThreadsError(data.error)
      } else {
        setAiEvidenceThreads(data)
      }
    } catch (err) {
      setThreadsError(err instanceof Error ? err.message : "Failed to generate evidence threads")
      console.error("Error fetching evidence threads:", err)
    } finally {
      setIsLoadingThreads(false)
    }
  }

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // Use real data or fallback to placeholders
  const evidenceThreads = contextData?.evidence_threads ?? []
  const relatedConcepts = contextData?.related_concepts ?? []
  const synthesis = contextData?.synthesis
  const confidenceMetrics = contextData?.confidence_metrics

  // Fallback placeholder images for related concepts
  const conceptImages = [
    "/chemical-reaction-cycle-diagram-abstract.jpg",
    "/microscope-cell-view-molecular-structure.jpg",
    "/molecular-structure-protein-complex-3d.jpg",
  ]

  const guidedPrompts = [
    { icon: HelpCircle, text: `What is the mechanism behind ${claim.title.split(" ").slice(0, 5).join(" ")}?` },
    { icon: TrendingUp, text: "Show me related experimental data" },
    { icon: FlaskConical, text: "What are the implications of this finding?" },
  ]

  return (
    <div className="min-h-screen bg-[#102216] text-white flex flex-col">
      {/* Noeron Header */}
      <NoeronHeader />

      {/* Header */}
      <header className="sticky top-14 z-40 flex items-center justify-between border-b border-[#28392e] bg-[#102216]/95 backdrop-blur-sm px-6 py-3 lg:px-10">
        <div className="flex items-center gap-4">
          <div className="size-6 text-[#FDA92B]">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold leading-tight">{episode.title}</h2>
            <p className="text-xs text-gray-400">{episode.category}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-3 bg-[#182d21] py-1.5 px-3 rounded-lg border border-[#28392e]">
            <div className="size-2 rounded-full bg-[#FDA92B] animate-pulse" />
            <span className="text-xs font-medium text-gray-300">Paused at {formatTime(episode.currentTime)}</span>
          </div>
          <button
            onClick={onBack}
            className="flex items-center justify-center gap-2 rounded-lg h-9 px-4 bg-[#FDA92B] hover:bg-[#FDA92B]/90 transition-colors text-[#111813] text-sm font-bold shadow-[0_0_10px_rgba(88,61,50,0.2)]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Podcast</span>
          </button>
        </div>
      </header>

      {/* Loading State */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-[#FDA92B] animate-spin" />
            <p className="text-gray-400">Loading claim context...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={onBack}
              className="px-4 py-2 bg-[#FDA92B] hover:bg-[#FDA92B]/90 text-[#111813] font-bold rounded-lg"
            >
              Go Back
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!isLoading && !error && contextData && (
        <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 md:px-10 py-8 pb-32 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Core Exploration */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Anchor Claim */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#182d21] to-[#102216] border border-[#28392e] shadow-lg">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Quote className="w-36 h-36" />
              </div>
              <div className="p-6 md:p-8 relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-2 py-1 rounded bg-[#FDA92B]/20 text-[#FDA92B] text-xs font-bold uppercase tracking-wider border border-[#FDA92B]/30">
                    {synthesis?.claim_type || "Claim"}
                  </span>
                  <span className="text-xs text-gray-500">
                    @ {formatTime(claim.timestamp)}
                  </span>
                </div>

                {/* Distilled claim as header */}
                <h1 className="text-2xl md:text-3xl font-bold leading-tight mb-4 text-white">
                  {claim.title}
                </h1>

                {/* Full quote from transcript */}
                {synthesis?.claim_text && synthesis.claim_text !== claim.title && (
                  <p className="text-base text-gray-300 leading-relaxed mb-6">
                    "{synthesis.claim_text}"
                  </p>
                )}

                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-[#FDA92B]/20 flex items-center justify-center text-[#FDA92B] text-sm font-bold">
                    {episode.guest.split(' ').map(n => n[0]).join('')}
                  </div>
                  <p className="text-sm font-medium text-gray-300">
                    {episode.guest} • <span className="text-gray-500">{synthesis?.speaker_stance || "assertion"}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Synthesis Section */}
            <div className="bg-[#111813] border border-[#28392e] rounded-xl p-6 md:p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#FDA92B]" />
                  Synthesis
                </h3>

                {/* Segmented Control */}
                <div className="flex p-1 bg-[#1e2e24] rounded-lg">
                  <button
                    onClick={() => setSynthesisMode("simplified")}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      synthesisMode === "simplified"
                        ? "bg-[#102216] text-white shadow-sm"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Simplified
                  </button>
                  <button
                    onClick={() => setSynthesisMode("technical")}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      synthesisMode === "technical"
                        ? "bg-[#102216] text-white shadow-sm"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Technical
                  </button>
                  <button
                    onClick={() => {
                      setSynthesisMode("ai_summary")
                      if (!deepDiveSummary && !isLoadingDeepDive) {
                        fetchDeepDiveSummary()
                      }
                    }}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                      synthesisMode === "ai_summary"
                        ? "bg-[#102216] text-white shadow-sm"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    AI Deep Dive
                  </button>
                  <button
                    onClick={() => setSynthesisMode("raw")}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      synthesisMode === "raw" ? "bg-[#102216] text-white shadow-sm" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Raw Data
                  </button>
                </div>
              </div>

              <div className="space-y-4 text-gray-300 leading-relaxed">
                {synthesisMode === "raw" && (
                  <pre className="text-xs bg-[#1e2e24] p-4 rounded overflow-x-auto">
                    {JSON.stringify(contextData, null, 2)}
                  </pre>
                )}
                
                {synthesisMode === "simplified" && (
                  <>
                    <p className="text-lg">{claim.description}</p>
                    {synthesis?.rationale && (
                      <div className="bg-[#1e2e24] border-l-4 border-[#FDA92B] p-4 rounded-r-lg">
                        <p className="text-sm">{synthesis.rationale}</p>
                      </div>
                    )}
                  </>
                )}

                {synthesisMode === "technical" && (
                  <>
                    <p><strong>Claim:</strong> {synthesis?.claim_text || claim.title}</p>
                    {synthesis?.rationale && (
                      <div className="bg-[#1e2e24] border-l-4 border-[#FDA92B] p-4 rounded-r-lg my-4">
                        <p className="text-sm italic">
                          <strong>Why this needs verification:</strong> {synthesis.rationale}
                        </p>
                      </div>
                    )}
                    {synthesis?.context_tags && Object.keys(synthesis.context_tags).length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {Object.entries(synthesis.context_tags).map(([key, value]) => (
                          <span
                            key={key}
                            className="px-3 py-1 bg-[#1e2e24] border border-[#28392e] rounded-full text-xs"
                          >
                            <span className="text-gray-500">{key}:</span>{" "}
                            <span className="text-[#FDA92B]">{value}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {evidenceThreads.length > 0 && (
                      <p className="mt-4">
                        This claim is supported by {evidenceThreads.length} research paper
                        {evidenceThreads.length !== 1 ? "s" : ""}, with{" "}
                        {confidenceMetrics?.evidence_counts.primary || 0} primary source
                        {confidenceMetrics?.evidence_counts.primary !== 1 ? "s" : ""},{" "}
                        {confidenceMetrics?.evidence_counts.replication || 0} replication stud
                        {confidenceMetrics?.evidence_counts.replication !== 1 ? "ies" : "y"}, and{" "}
                        {confidenceMetrics?.evidence_counts.counter || 0} counter-evidence paper
                        {confidenceMetrics?.evidence_counts.counter !== 1 ? "s" : ""}.
                      </p>
                    )}
                  </>
                )}

                {synthesisMode === "ai_summary" && (
                  <div className="space-y-4">
                    {/* Loading State */}
                    {isLoadingDeepDive && (
                      <div className="flex items-center justify-center py-12">
                        <div className="flex flex-col items-center gap-4">
                          <Loader2 className="w-8 h-8 text-[#FDA92B] animate-spin" />
                          <div className="text-center">
                            <p className="text-gray-300 font-medium">Generating AI Deep Dive...</p>
                            <p className="text-gray-500 text-sm mt-1">Searching papers and synthesizing evidence</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Error State */}
                    {deepDiveError && !isLoadingDeepDive && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                        <p className="text-red-400 text-sm">{deepDiveError}</p>
                        <button
                          onClick={() => fetchDeepDiveSummary(true)}
                          className="mt-3 text-sm text-[#FDA92B] hover:underline"
                        >
                          Try again
                        </button>
                      </div>
                    )}

                    {/* Summary Content */}
                    {deepDiveSummary && !isLoadingDeepDive && !deepDiveError && (
                      <>
                        {/* Metadata bar */}
                        <div className="flex items-center justify-between text-xs text-gray-500 pb-3 border-b border-[#28392e]">
                          <div className="flex items-center gap-4">
                            <span>{deepDiveSummary.papers_retrieved} papers analyzed</span>
                            {deepDiveSummary.cached && (
                              <span className="px-2 py-0.5 bg-[#1e2e24] rounded text-gray-400">Cached</span>
                            )}
                          </div>
                          <button
                            onClick={() => fetchDeepDiveSummary(true)}
                            className="text-[#FDA92B] hover:underline flex items-center gap-1"
                          >
                            <ArrowUp className="w-3 h-3 rotate-45" />
                            Regenerate
                          </button>
                        </div>

                        {/* Render markdown-like summary */}
                        <div className="prose prose-invert prose-sm max-w-none">
                          {deepDiveSummary.summary.split('\n\n').map((paragraph, idx) => {
                            // Handle bold headers like **Finding**:
                            if (paragraph.startsWith('**')) {
                              const match = paragraph.match(/^\*\*([^*]+)\*\*:?\s*(.*)/)
                              if (match) {
                                const [, header, content] = match
                                return (
                                  <div key={idx} className="mb-4">
                                    <h4 className="text-[#FDA92B] font-bold text-sm uppercase tracking-wider mb-2">
                                      {header}
                                    </h4>
                                    <p className="text-gray-300">{content}</p>
                                  </div>
                                )
                              }
                            }
                            // Handle bullet points
                            if (paragraph.includes('\n- ') || paragraph.startsWith('- ')) {
                              const lines = paragraph.split('\n')
                              return (
                                <ul key={idx} className="list-disc list-inside space-y-1 text-gray-300 mb-4">
                                  {lines.map((line, lineIdx) => {
                                    const bulletContent = line.replace(/^-\s*/, '').trim()
                                    if (bulletContent) {
                                      return <li key={lineIdx}>{bulletContent}</li>
                                    }
                                    return null
                                  })}
                                </ul>
                              )
                            }
                            // Regular paragraph
                            return paragraph.trim() ? (
                              <p key={idx} className="text-gray-300 mb-3">{paragraph}</p>
                            ) : null
                          })}
                        </div>

                        {/* Papers used */}
                        {deepDiveSummary.papers && deepDiveSummary.papers.length > 0 && (() => {
                          // Dedupe papers by paper_id
                          const uniquePapers = [...deepDiveSummary.papers]
                            .filter((paper, index, self) =>
                              index === self.findIndex(p => p.paper_id === paper.paper_id)
                            )
                            .sort((a, b) => {
                              const yearA = parseInt(a.year) || 0
                              const yearB = parseInt(b.year) || 0
                              return yearB - yearA // newest first
                            })

                          return (
                            <div className="mt-6 pt-4 border-t border-[#28392e]">
                              <h5 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-4">
                                Sources Retrieved ({uniquePapers.length} paper{uniquePapers.length !== 1 ? 's' : ''})
                              </h5>
                              <div className="space-y-4">
                                {uniquePapers.map((paper, idx) => (
                                  <div key={idx} className="group">
                                    <div className="flex items-start gap-2">
                                      <span className="text-sm font-mono text-gray-500 shrink-0 pt-0.5">
                                        {paper.year || "n/a"}
                                      </span>
                                      <span className="text-gray-500 shrink-0 pt-0.5">•</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm text-gray-300 leading-relaxed">
                                          {paper.title}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                          {paper.section && (
                                            <span className="text-[10px] text-gray-500 px-1.5 py-0.5 bg-[#1e2e24] rounded">
                                              {paper.section}
                                            </span>
                                          )}
                                          <button
                                            onClick={() => onViewSourcePaper(paper.paper_id)}
                                            className="text-[10px] text-[#FDA92B] hover:text-[#FDA92B]/80 transition-colors flex items-center gap-1"
                                          >
                                            View Paper
                                            <ExternalLink className="w-2.5 h-2.5" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })()}
                      </>
                    )}

                    {/* Initial state - no summary yet */}
                    {!deepDiveSummary && !isLoadingDeepDive && !deepDiveError && (
                      <div className="text-center py-8">
                        <Sparkles className="w-10 h-10 text-[#FDA92B]/50 mx-auto mb-4" />
                        <p className="text-gray-400 mb-4">
                          Generate an AI-powered deep dive summary for this claim
                        </p>
                        <button
                          onClick={() => fetchDeepDiveSummary()}
                          className="px-6 py-2.5 bg-[#FDA92B] hover:bg-[#FDA92B]/90 text-[#111813] font-bold rounded-lg transition-colors"
                        >
                          Generate Deep Dive
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

          {/* Guided Prompts */}
          <div>
            <h4 className="text-sm uppercase tracking-wider text-gray-500 font-semibold mb-3">
              Deepen Your Understanding
            </h4>
            <div className="flex flex-wrap gap-3">
              {guidedPrompts.map((prompt, index) => {
                const Icon = prompt.icon
                return (
                  <button
                    key={index}
                    className="flex items-center gap-2 bg-[#1e2e24] hover:bg-[#28392e] text-[#FDA92B] hover:text-white border border-[#28392e] px-4 py-2.5 rounded-full text-sm font-medium transition-all group"
                  >
                    <Icon className="w-4 h-4" />
                    {prompt.text}
                    <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 -ml-2 group-hover:ml-0 transition-all" />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Related Concepts Carousel */}
          {relatedConcepts.length > 0 && (
            <div className="pt-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-lg">Related Concepts</h4>
                <div className="flex gap-2">
                  <button className="size-8 rounded-full bg-[#1e2e24] flex items-center justify-center hover:bg-[#FDA92B] hover:text-[#102216] transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button className="size-8 rounded-full bg-[#1e2e24] flex items-center justify-center hover:bg-[#FDA92B] hover:text-[#102216] transition-colors">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="flex overflow-x-auto gap-4 pb-4 snap-x scrollbar-hide">
                {relatedConcepts.map((concept, index) => {
                  const backgroundImage = conceptImages[index % conceptImages.length]
                  return (
                    <div
                      key={index}
                      className="snap-start min-w-[240px] w-[240px] h-[300px] rounded-xl relative group cursor-pointer overflow-hidden border border-[#28392e]"
                      style={{
                        backgroundImage: `linear-gradient(to top, rgba(16, 34, 22, 0.95), rgba(16, 34, 22, 0.3)), url('${backgroundImage}')`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    >
                      <div className="absolute inset-0 bg-[#FDA92B]/0 group-hover:bg-[#FDA92B]/10 transition-colors" />
                      <div className="absolute bottom-0 left-0 p-4 w-full">
                        <div className="mb-2 size-8 rounded bg-[#FDA92B]/20 flex items-center justify-center text-[#FDA92B] backdrop-blur-sm">
                          <FlaskConical className="w-5 h-5" />
                        </div>
                        <h5 className="font-bold text-lg leading-tight mb-1">{concept.title}</h5>
                        <p className="text-gray-400 text-xs line-clamp-2">{concept.description}</p>
                        {concept.year && (
                          <p className="text-gray-500 text-[10px] mt-1">
                            {concept.paper_title} ({concept.year})
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
                {/* Add More Card */}
                <div className="snap-start min-w-[240px] w-[240px] h-[300px] bg-[#1e2e24] rounded-xl relative group cursor-pointer overflow-hidden border border-[#28392e] flex flex-col justify-center items-center text-center p-6">
                  <div className="size-12 rounded-full bg-[#FDA92B]/10 flex items-center justify-center text-[#FDA92B] mb-4 group-hover:scale-110 transition-transform">
                    <Plus className="w-6 h-6" />
                  </div>
                  <h5 className="font-bold text-lg">Explore All Concepts</h5>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Evidence & Actions */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* AI Evidence Threads */}
          <div className="bg-[#111813] border border-[#28392e] rounded-xl p-5 h-fit">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-[#FDA92B]" />
                <h3 className="font-bold text-lg">Evidence Threads</h3>
              </div>
              {!aiEvidenceThreads && !isLoadingThreads && (
                <button
                  onClick={() => fetchEvidenceThreads()}
                  className="text-xs text-[#FDA92B] hover:underline flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  Generate
                </button>
              )}
            </div>

            {/* Loading State */}
            {isLoadingThreads && (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-[#FDA92B] animate-spin mb-3" />
                <p className="text-gray-400 text-sm">Analyzing research patterns...</p>
                <p className="text-gray-500 text-xs mt-1">Identifying narrative threads</p>
              </div>
            )}

            {/* Error State */}
            {threadsError && !isLoadingThreads && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-400 text-xs">{threadsError}</p>
                <button
                  onClick={() => fetchEvidenceThreads(true)}
                  className="mt-2 text-xs text-[#FDA92B] hover:underline"
                >
                  Try again
                </button>
              </div>
            )}

            {/* AI Threads Content */}
            {aiEvidenceThreads && !isLoadingThreads && !threadsError && (
              <>
                {/* Metadata bar */}
                <div className="flex items-center justify-between text-[10px] text-gray-500 pb-3 mb-4 border-b border-[#28392e]">
                  <span>{aiEvidenceThreads.papers_analyzed} papers analyzed</span>
                  <button
                    onClick={() => fetchEvidenceThreads(true)}
                    className="text-[#FDA92B] hover:underline flex items-center gap-1"
                  >
                    <ArrowUp className="w-2.5 h-2.5 rotate-45" />
                    Regenerate
                  </button>
                </div>

                {aiEvidenceThreads.threads.length > 0 ? (
                  <div className="space-y-6">
                    {aiEvidenceThreads.threads.map((thread, threadIndex) => (
                      <div key={threadIndex} className="relative">
                        {/* Thread Header */}
                        <div className="flex items-start gap-3 mb-3">
                          <div className={`mt-0.5 size-6 rounded flex items-center justify-center shrink-0 ${
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
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm text-white leading-tight">{thread.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                thread.strength === "foundational" ? "bg-green-500/20 text-green-400" :
                                thread.strength === "developing" ? "bg-yellow-500/20 text-yellow-400" :
                                "bg-gray-500/20 text-gray-400"
                              }`}>
                                {thread.strength}
                              </span>
                              <span className="text-[10px] text-gray-500 capitalize">
                                {thread.type.replace(/_/g, " ")}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Timeline Milestones */}
                        <div className="relative pl-4 ml-3 border-l border-[#28392e] space-y-3">
                          {thread.milestones.map((milestone, milestoneIndex) => (
                            <div key={milestoneIndex} className="relative pl-4 group">
                              {/* Timeline dot */}
                              <div className="absolute -left-[7px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#28392e] border-2 border-[#FDA92B] group-hover:bg-[#FDA92B] transition-colors" />

                              {/* Year badge */}
                              <span className="text-[10px] font-mono text-[#FDA92B] font-bold">
                                {milestone.year}
                              </span>

                              {/* Finding */}
                              <p className="text-xs text-gray-300 mt-0.5 leading-relaxed">
                                {milestone.finding}
                              </p>

                              {/* Paper reference */}
                              <p className="text-[10px] text-gray-500 mt-1 truncate" title={milestone.paper_title}>
                                {milestone.paper_title.length > 50
                                  ? milestone.paper_title.slice(0, 50) + "..."
                                  : milestone.paper_title}
                              </p>
                            </div>
                          ))}
                        </div>

                        {/* Thread Narrative */}
                        <div className="mt-3 ml-3 pl-4 border-l border-transparent">
                          <p className="text-xs text-gray-400 italic leading-relaxed">
                            {thread.narrative}
                          </p>
                        </div>

                        {/* Divider between threads */}
                        {threadIndex < aiEvidenceThreads.threads.length - 1 && (
                          <div className="mt-5 mb-2 border-t border-[#28392e]" />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-gray-500 text-sm">
                      {!aiEvidenceThreads.eligible ? (
                        <>
                          <span className="block mb-1">Unable to generate threads</span>
                          <span className="text-xs text-gray-600">
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

            {/* Initial state - show basic evidence if no AI threads */}
            {!aiEvidenceThreads && !isLoadingThreads && !threadsError && (
              <>
                {evidenceThreads.length > 0 ? (
                  <>
                    <div className="relative pl-2 border-l border-[#28392e] ml-2 space-y-6">
                      {evidenceThreads.slice(0, 3).map((thread, index) => (
                        <div
                          key={index}
                          className={`relative pl-6 group cursor-pointer ${thread.highlighted ? "" : "opacity-70 hover:opacity-100"} transition-opacity`}
                          onClick={() => {
                            if (thread.source_link) {
                              window.open(thread.source_link, "_blank")
                            }
                          }}
                        >
                          {thread.highlighted ? (
                            <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-[#FDA92B] border-4 border-[#102216] shadow-[0_0_0_1px_#FDA92B]" />
                          ) : (
                            <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-[#3d5646]" />
                          )}
                          <p className="text-[10px] font-mono text-[#FDA92B] mb-1 tracking-wider uppercase">
                            {thread.type === "primary"
                              ? "Primary Source"
                              : thread.type === "replication"
                                ? "Replication"
                                : "Counter-Evidence"}
                          </p>
                          <h4 className="font-medium text-sm mb-1 group-hover:text-[#FDA92B] transition-colors">
                            {thread.title}
                          </h4>
                          <p className="text-gray-400 text-xs mb-1">{thread.description}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-[#28392e]">
                      <button
                        onClick={() => fetchEvidenceThreads()}
                        className="w-full py-2 flex items-center justify-center gap-2 text-xs font-medium bg-[#1e2e24] hover:bg-[#28392e] text-[#FDA92B] rounded-lg transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Generate Research Narratives</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6">
                    <GitBranch className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm mb-3">
                      No evidence threads available yet
                    </p>
                    <button
                      onClick={() => fetchEvidenceThreads()}
                      className="px-4 py-2 text-xs font-medium bg-[#1e2e24] hover:bg-[#28392e] text-[#FDA92B] rounded-lg transition-colors inline-flex items-center gap-2"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Generate with AI
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Source Material Card */}
          <div className="bg-gradient-to-br from-[#182d21] to-[#111813] border border-[#28392e] rounded-xl p-5">
            <div className="flex items-start gap-4 mb-4">
              <div className="size-10 rounded bg-white/5 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-sm">Source Material</h4>
                <p className="text-gray-400 text-xs mt-1">Access the original PDF cited in this segment.</p>
              </div>
            </div>
            <button
              onClick={onViewSourcePaper}
              className="w-full flex items-center justify-center gap-2 bg-[#FDA92B] hover:bg-[#FDA92B]/90 text-[#111813] font-bold py-3 px-4 rounded-lg transition-all shadow-[0_4px_14px_rgba(88,61,50,0.2)]"
            >
              <span>View Source Paper</span>
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#111813] p-3 rounded-lg border border-[#28392e]">
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Confidence</p>
              <p className="text-lg font-bold flex items-center gap-1">
                {confidenceMetrics?.confidence_level || "Unknown"}
                <span
                  className={`size-2 rounded-full inline-block ${
                    confidenceMetrics?.confidence_level === "High"
                      ? "bg-green-500"
                      : confidenceMetrics?.confidence_level === "Medium"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }`}
                />
              </p>
            </div>
            <div className="bg-[#111813] p-3 rounded-lg border border-[#28392e]">
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Consensus</p>
              <p className="text-lg font-bold">{confidenceMetrics?.consensus_percentage || 0}%</p>
            </div>
          </div>
        </div>
      </main>
      )}

      {/* Sticky Chat Box Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-[#102216]/95 backdrop-blur-lg border-t border-[#28392e] px-6 py-4">
        <div className="max-w-[1280px] mx-auto">
          <div className="flex items-center gap-3 bg-[#1a261f] rounded-xl border border-[#28392e] p-3 focus-within:border-[#FDA92B] transition-colors">
            <button className="p-2 rounded-lg bg-[#28392e] hover:bg-[#364b3d] transition-colors text-white">
              <Scissors className="w-4 h-4" />
            </button>
            <input
              type="text"
              placeholder="Ask AI about this segment..."
              className="flex-1 bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm"
            />
            <button className="p-2 rounded-lg bg-transparent hover:bg-[#28392e] transition-colors text-gray-400 hover:text-white">
              <Mic className="w-4 h-4" />
            </button>
            <button className="p-2 rounded-full bg-[#FDA92B] hover:bg-[#FDA92B]/90 transition-colors text-[#102216]">
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
