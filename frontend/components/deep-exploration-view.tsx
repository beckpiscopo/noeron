"use client"

import { useState, useEffect } from "react"
import {
  ArrowLeft,
  ArrowUp,
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
  Loader2,
  Network,
  Circle,
  ArrowRight,
  Search,
  Settings,
  HelpCircle as HelpIcon,
  Mic,
} from "lucide-react"
import { NoeronHeader } from "./noeron-header"
import { callMcpTool } from "@/lib/api"
import { ConceptExpansionGraph, convertKGSubgraph } from "./concept-graph"
import { BookmarkButton } from "./bookmark-button"
import { AIChatSidebar } from "./ai-chat"
import { MarkdownContent } from "@/components/ui/markdown-content"
import { MiniPodcastPlayer } from "./mini-podcast-player"
import type { Paper } from "@/lib/supabase"
import type { ChatContext, GeneratePodcastResponse } from "@/lib/chat-types"

// =============================================================================
// CORNER BRACKET FRAME (matches episode-overview.tsx)
// =============================================================================

function CornerBrackets({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      {/* Top-left corner */}
      <div className="absolute -top-px -left-px w-4 h-4 border-l border-t border-[var(--golden-chestnut)]/40" />
      {/* Top-right corner */}
      <div className="absolute -top-px -right-px w-4 h-4 border-r border-t border-[var(--golden-chestnut)]/40" />
      {/* Bottom-left corner */}
      <div className="absolute -bottom-px -left-px w-4 h-4 border-l border-b border-[var(--golden-chestnut)]/40" />
      {/* Bottom-right corner */}
      <div className="absolute -bottom-px -right-px w-4 h-4 border-r border-b border-[var(--golden-chestnut)]/40" />
      {children}
    </div>
  )
}

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
  onBookmarksClick?: () => void
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

// Knowledge Graph types
interface KGNode {
  id: string
  name: string
  type: string
  description?: string
  aliases?: string[]
  is_direct_match?: boolean
  papers?: string[]
}

interface KGEdge {
  source: string
  target: string
  relationship: string
  evidence?: string
  confidence?: number
}

interface KGSubgraphResponse {
  claim_text: string
  matched_entity_ids: string[]
  matched_entity_names: string[]
  nodes: KGNode[]
  edges: KGEdge[]
  stats: {
    direct_matches: number
    total_nodes: number
    total_edges: number
  }
  error?: string
  message?: string
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
    key_finding?: string
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

export function DeepExplorationView({ episode, claim, episodeId, onBack, onViewSourcePaper, onBookmarksClick }: DeepExplorationViewProps) {
  const [synthesisMode, setSynthesisMode] = useState<"simplified" | "technical">("technical")
  const [contextData, setContextData] = useState<ClaimContextData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Deep dive summary state (per style)
  const [deepDiveSummaries, setDeepDiveSummaries] = useState<Partial<Record<"simplified" | "technical", DeepDiveSummary>>>({})
  const [isLoadingDeepDive, setIsLoadingDeepDive] = useState<{ simplified: boolean; technical: boolean }>({ simplified: false, technical: false })
  const [deepDiveErrors, setDeepDiveErrors] = useState<{ simplified: string | null; technical: string | null }>({ simplified: null, technical: null })

  // AI Evidence threads state (narrative research arcs)
  const [aiEvidenceThreads, setAiEvidenceThreads] = useState<EvidenceThreadsResponse | null>(null)
  const [isLoadingThreads, setIsLoadingThreads] = useState(false)
  const [threadsError, setThreadsError] = useState<string | null>(null)

  // Knowledge Graph subgraph state
  const [kgSubgraph, setKgSubgraph] = useState<KGSubgraphResponse | null>(null)
  const [isLoadingKG, setIsLoadingKG] = useState(false)
  const [kgError, setKgError] = useState<string | null>(null)

  // AI Chat sidebar state - auto-open on large screens
  const [chatOpen, setChatOpen] = useState(false)

  // Auto-open chat sidebar on large screens
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)')
    if (mediaQuery.matches) {
      setChatOpen(true)
    }
  }, [])

  // Mini Podcast state
  const [miniPodcast, setMiniPodcast] = useState<GeneratePodcastResponse | null>(null)
  const [isLoadingPodcast, setIsLoadingPodcast] = useState(false)
  const [podcastError, setPodcastError] = useState<string | null>(null)

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

  // Auto-fetch technical deep dive summary when contextData loads
  useEffect(() => {
    if (contextData && !deepDiveSummaries.technical && !isLoadingDeepDive.technical && !deepDiveErrors.technical) {
      fetchDeepDiveSummary("technical")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextData])

  // Auto-fetch evidence threads after deep dive finishes (serialize to avoid concurrent Gemini calls)
  useEffect(() => {
    if (contextData && !aiEvidenceThreads && !isLoadingThreads && !threadsError
        && !isLoadingDeepDive.technical && (deepDiveSummaries.technical || deepDiveErrors.technical)) {
      fetchEvidenceThreads()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextData, isLoadingDeepDive.technical, deepDiveSummaries.technical, deepDiveErrors.technical])

  // Function to fetch deep dive summary on-demand (style-aware)
  const fetchDeepDiveSummary = async (style: "simplified" | "technical", forceRegenerate = false) => {
    if (!claim.id.includes("-")) return

    setIsLoadingDeepDive(prev => ({ ...prev, [style]: true }))
    setDeepDiveErrors(prev => ({ ...prev, [style]: null }))

    try {
      const data = await callMcpTool<DeepDiveSummary>("generate_deep_dive_summary", {
        claim_id: claim.id,
        episode_id: episodeId,
        n_results: 7,
        force_regenerate: forceRegenerate,
        style,
      })

      if (data.error) {
        setDeepDiveErrors(prev => ({ ...prev, [style]: data.error || "Failed to generate deep dive summary" }))
      } else {
        setDeepDiveSummaries(prev => ({ ...prev, [style]: data }))
      }
    } catch (err) {
      setDeepDiveErrors(prev => ({ ...prev, [style]: err instanceof Error ? err.message : "Failed to generate deep dive summary" }))
      console.error("Error fetching deep dive summary:", err)
    } finally {
      setIsLoadingDeepDive(prev => ({ ...prev, [style]: false }))
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

  // Function to fetch Knowledge Graph subgraph on-demand
  const fetchKGSubgraph = async () => {
    if (!claim.id.includes("-")) return

    setIsLoadingKG(true)
    setKgError(null)

    try {
      const data = await callMcpTool<KGSubgraphResponse>("get_relevant_kg_subgraph", {
        claim_id: claim.id,
        episode_id: episodeId,
        max_hops: 1,
        use_gemini_extraction: false,
      })

      if (data.error) {
        setKgError(data.error)
      } else {
        setKgSubgraph(data)
      }
    } catch (err) {
      setKgError(err instanceof Error ? err.message : "Failed to load knowledge graph")
      console.error("Error fetching KG subgraph:", err)
    } finally {
      setIsLoadingKG(false)
    }
  }

  // Function to fetch mini podcast on-demand
  const fetchMiniPodcast = async (forceRegenerate = false) => {
    if (!claim.id.includes("-")) return

    setIsLoadingPodcast(true)
    setPodcastError(null)

    try {
      const data = await callMcpTool<GeneratePodcastResponse>("generate_mini_podcast", {
        claim_id: claim.id,
        episode_id: episodeId,
        force_regenerate: forceRegenerate,
        style: synthesisMode === "simplified" ? "casual" : "academic",
      })

      if (data.error) {
        setPodcastError(data.error)
        // Still set the podcast data if script was generated (even if audio failed)
        if (data.script) {
          setMiniPodcast(data)
        }
      } else {
        setMiniPodcast(data)
      }
    } catch (err) {
      setPodcastError(err instanceof Error ? err.message : "Failed to generate mini podcast")
      console.error("Error generating mini podcast:", err)
    } finally {
      setIsLoadingPodcast(false)
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
    <div className="noeron-theme min-h-screen bg-background text-foreground flex flex-col">
      {/* Noeron Header */}
      <NoeronHeader
        actions={
          <>
            <button className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition hover:text-foreground">
              <Search className="h-4 w-4" />
            </button>
            <button className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition hover:text-foreground">
              <Settings className="h-4 w-4" />
            </button>
            <button className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition hover:text-foreground">
              <HelpIcon className="h-4 w-4" />
            </button>
          </>
        }
        onBookmarksClick={onBookmarksClick}
      />

      {/* Header */}
      <header
        className="sticky top-14 z-40 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur-sm px-6 py-3 lg:px-10 transition-all duration-300 ease-in-out"
        style={{ marginRight: chatOpen ? '440px' : '0' }}
      >
        <div className="flex items-center gap-4">
          <div className="size-6 text-[var(--golden-chestnut)]">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold leading-tight">{episode.title}</h2>
            <p className="text-xs text-foreground/50">{episode.category}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-3 bg-card py-1.5 px-3 rounded-none border border-border">
            <div className="size-2 rounded-full bg-[var(--golden-chestnut)] animate-pulse" />
            <span className="text-xs font-medium text-foreground/70 mono">Paused at {formatTime(episode.currentTime)}</span>
          </div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 border border-[var(--golden-chestnut)] bg-[var(--golden-chestnut)]/10 hover:bg-[var(--golden-chestnut)]/20 text-[var(--golden-chestnut)] font-medium tracking-wide transition-all"
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
            <Loader2 className="w-8 h-8 text-[var(--golden-chestnut)] animate-spin" />
            <p className="text-foreground/60">Loading claim context...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md bg-[var(--rosy-copper)]/10 border border-[var(--rosy-copper)]/30 rounded-none p-6 text-center">
            <p className="text-[var(--rosy-copper)] mb-4">{error}</p>
            <button
              onClick={onBack}
              className="btn-noeron btn-noeron-accent"
            >
              Go Back
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!isLoading && !error && contextData && (
        <main
          className={`flex-1 w-full max-w-[1280px] px-4 md:px-10 py-8 pb-8 grid grid-cols-1 lg:grid-cols-12 gap-8 transition-all duration-300 ease-in-out ${chatOpen ? '' : 'mx-auto'}`}
          style={{ marginRight: chatOpen ? '440px' : '0' }}
        >
          {/* Left Column: Core Exploration */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Anchor Claim */}
            <CornerBrackets className="relative overflow-hidden bg-gradient-to-br from-card to-background">
              <div className="blueprint-pattern" />
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Quote className="w-36 h-36" />
              </div>
              <div className="p-6 md:p-8 relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-2 py-1 rounded-none bg-[var(--golden-chestnut)]/20 text-[var(--golden-chestnut)] text-xs font-bold uppercase tracking-wider border border-[var(--golden-chestnut)]/30 mono">
                    {synthesis?.claim_type || "Claim"}
                  </span>
                  <span className="text-xs text-foreground/50 mono">
                    @ {formatTime(claim.timestamp)}
                  </span>
                </div>

                {/* Distilled claim as header */}
                <h1 className="display text-2xl md:text-3xl font-normal leading-tight mb-4 text-foreground">
                  {claim.title}
                </h1>

                {/* Full quote from transcript */}
                {synthesis?.claim_text && synthesis.claim_text !== claim.title && (
                  <p className="text-base text-foreground/80 leading-relaxed mb-6">
                    "{synthesis.claim_text}"
                  </p>
                )}

                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-[var(--golden-chestnut)]/20 flex items-center justify-center text-[var(--golden-chestnut)] text-sm font-bold">
                    {episode.guest.split(' ').map(n => n[0]).join('')}
                  </div>
                  <p className="text-sm font-medium text-foreground/80">
                    {episode.guest} • <span className="text-foreground/50">{synthesis?.speaker_stance || "assertion"}</span>
                  </p>
                </div>
              </div>
            </CornerBrackets>

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
                      setSynthesisMode("simplified")
                      if (!deepDiveSummaries.simplified && !isLoadingDeepDive.simplified) {
                        fetchDeepDiveSummary("simplified")
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
                      setSynthesisMode("technical")
                      if (!deepDiveSummaries.technical && !isLoadingDeepDive.technical) {
                        fetchDeepDiveSummary("technical")
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
                      onClick={() => fetchDeepDiveSummary(synthesisMode, true)}
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
                      <div className="flex items-center justify-between text-xs text-foreground/50 pb-3 border-b border-border">
                        <div className="flex items-center gap-4">
                          <span>{currentSummary.papers_retrieved} papers analyzed</span>
                          {currentSummary.cached && (
                            <span className="px-2 py-0.5 bg-card rounded text-foreground/60">Cached</span>
                          )}
                        </div>
                        <button
                          onClick={() => fetchDeepDiveSummary(synthesisMode, true)}
                          className="text-[var(--golden-chestnut)] hover:underline flex items-center gap-1"
                        >
                          <ArrowUp className="w-3 h-3 rotate-45" />
                          Regenerate
                        </button>
                      </div>

                      {/* Render markdown summary */}
                      <MarkdownContent content={currentSummary.summary} />

                      {/* Papers used */}
                      {currentSummary.papers && currentSummary.papers.length > 0 && (() => {
                        // Dedupe papers by paper_id
                        const uniquePapers = [...currentSummary.papers]
                          .filter((paper, index, self) =>
                            index === self.findIndex(p => p.paper_id === paper.paper_id)
                          )
                          .sort((a, b) => {
                            const yearA = parseInt(a.year) || 0
                            const yearB = parseInt(b.year) || 0
                            return yearB - yearA // newest first
                          })

                        return (
                          <div className="mt-6 pt-4 border-t border-border">
                            <h5 className="text-xs uppercase tracking-wider text-foreground/50 font-semibold mb-4">
                              Sources Retrieved ({uniquePapers.length} paper{uniquePapers.length !== 1 ? 's' : ''})
                            </h5>
                            <div className="space-y-5">
                              {uniquePapers.map((paper, idx) => (
                                <div key={idx} className="group">
                                  <div className="flex items-start gap-2">
                                    <span className="text-sm font-mono text-foreground/50 shrink-0 pt-0.5">
                                      {paper.year || "n/a"}
                                    </span>
                                    <span className="text-foreground/50 shrink-0 pt-0.5">•</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-foreground/80 leading-relaxed">
                                        {paper.title}
                                      </p>
                                      {paper.key_finding && (
                                        <p className="text-xs text-foreground/60 mt-2 leading-relaxed">
                                          <span className="text-foreground/50">Key finding:</span> {paper.key_finding}
                                        </p>
                                      )}
                                      <div className="flex flex-wrap items-center gap-2 mt-2">
                                        {paper.section && (
                                          <span className="text-[10px] text-foreground/50 px-1.5 py-0.5 bg-card rounded">
                                            {paper.section}
                                          </span>
                                        )}
                                        <button
                                          onClick={() => onViewSourcePaper(paper.paper_id)}
                                          className="text-[10px] text-[var(--golden-chestnut)] hover:text-[var(--golden-chestnut)]/80 transition-colors flex items-center gap-1"
                                        >
                                          View Paper
                                          <ExternalLink className="w-2.5 h-2.5" />
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
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })()}
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

          {/* Guided Prompts */}
          <div>
            <h4 className="text-sm uppercase tracking-wider text-foreground/50 font-semibold mb-3">
              Deepen Your Understanding
            </h4>
            <div className="flex flex-wrap gap-3">
              {guidedPrompts.map((prompt, index) => {
                const Icon = prompt.icon
                return (
                  <button
                    key={index}
                    className="flex items-center gap-2 bg-card hover:bg-foreground/10 text-[var(--golden-chestnut)] hover:text-foreground border border-border px-4 py-2.5 rounded-full text-sm font-medium transition-all group"
                  >
                    <Icon className="w-4 h-4" />
                    {prompt.text}
                    <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 -ml-2 group-hover:ml-0 transition-all" />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Knowledge Graph Relationships - hidden on mobile */}
          <div className="hidden md:block pt-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Network className="w-5 h-5 text-[var(--golden-chestnut)]" />
                <h4 className="font-bold text-lg">Knowledge Graph</h4>
              </div>
              {!kgSubgraph && !isLoadingKG && (
                <button
                  onClick={fetchKGSubgraph}
                  className="text-xs text-[var(--golden-chestnut)] hover:underline flex items-center gap-1"
                >
                  <Network className="w-3 h-3" />
                  Load Graph
                </button>
              )}
            </div>

            {/* Loading State */}
            {isLoadingKG && (
              <CornerBrackets className="bg-card/30 p-8">
                <div className="flex flex-col items-center justify-center">
                  <Loader2 className="w-6 h-6 text-[var(--golden-chestnut)] animate-spin mb-3" />
                  <p className="text-foreground/60 text-sm">Loading knowledge graph...</p>
                </div>
              </CornerBrackets>
            )}

            {/* Error State */}
            {kgError && !isLoadingKG && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-none p-4">
                <p className="text-red-400 text-sm">{kgError}</p>
                <button
                  onClick={fetchKGSubgraph}
                  className="mt-2 text-xs text-[var(--golden-chestnut)] hover:underline"
                >
                  Try again
                </button>
              </div>
            )}

            {/* KG Content - Interactive Concept Expansion Graph */}
            {kgSubgraph && !isLoadingKG && !kgError && (
              <div>
                {/* Stats bar */}
                <div className="flex items-center gap-4 text-xs text-foreground/50 pb-3 mb-3">
                  <span>{kgSubgraph.stats.direct_matches} matched entities</span>
                  <span>{kgSubgraph.stats.total_edges} relationships</span>
                  <span className="text-[var(--golden-chestnut)]">Double-click nodes to expand with AI</span>
                </div>

                {kgSubgraph.edges.length > 0 ? (
                  <>
                    {/* Matched entities pills */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {kgSubgraph.matched_entity_names.map((name, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 bg-[var(--golden-chestnut)]/20 text-[var(--golden-chestnut)] text-xs font-medium rounded-full border border-[var(--golden-chestnut)]/30"
                        >
                          {name}
                        </span>
                      ))}
                    </div>

                    {/* Interactive Graph */}
                    <ConceptExpansionGraph
                      initialNodes={convertKGSubgraph(kgSubgraph).nodes}
                      initialEdges={convertKGSubgraph(kgSubgraph).edges}
                      matchedEntityIds={kgSubgraph.matched_entity_ids}
                      initialDepth={0}
                      sourceClaimId={claim.id}
                      sourceClaimText={synthesis?.claim_text || claim.description}
                    />
                  </>
                ) : (
                  <CornerBrackets className="bg-card/30 p-6 text-center">
                    <Network className="w-8 h-8 text-foreground/40 mx-auto mb-3" />
                    <p className="text-foreground/50 text-sm">
                      {kgSubgraph.message || "No matching entities found in knowledge graph"}
                    </p>
                  </CornerBrackets>
                )}
              </div>
            )}

            {/* Initial state - prompt to load */}
            {!kgSubgraph && !isLoadingKG && !kgError && (
              <CornerBrackets className="bg-card/30 p-8 text-center">
                <Network className="w-10 h-10 text-foreground/40 mx-auto mb-4" />
                <p className="text-foreground/60 text-sm mb-4">
                  Explore how concepts in this claim connect to the broader research
                </p>
                <button
                  onClick={fetchKGSubgraph}
                  className="px-5 py-2.5 border border-[var(--golden-chestnut)] bg-[var(--golden-chestnut)]/10 hover:bg-[var(--golden-chestnut)]/20 text-[var(--golden-chestnut)] font-bold text-sm tracking-wide transition-all inline-flex items-center gap-2"
                >
                  <Network className="w-4 h-4" />
                  Load Knowledge Graph
                </button>
              </CornerBrackets>
            )}
          </div>
        </div>

        {/* Right Column: Evidence & Actions */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Mini Podcast */}
          <CornerBrackets className="bg-card/30 p-5 h-fit">
            <div className="flex items-center gap-2 mb-4">
              <Mic className="w-5 h-5 text-[var(--golden-chestnut)]" />
              <h3 className="font-bold text-lg">Mini Podcast</h3>
            </div>
            <MiniPodcastPlayer
              podcast={miniPodcast}
              isLoading={isLoadingPodcast}
              error={podcastError}
              onGenerate={() => fetchMiniPodcast(false)}
              onRegenerate={() => fetchMiniPodcast(true)}
              style={synthesisMode === "simplified" ? "casual" : "academic"}
            />
          </CornerBrackets>

          {/* AI Evidence Threads */}
          <CornerBrackets className="bg-card/30 p-5 h-fit">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-[var(--golden-chestnut)]" />
                <h3 className="font-bold text-lg">Evidence Threads</h3>
              </div>
              {!aiEvidenceThreads && isLoadingThreads && (
                <Loader2 className="w-4 h-4 text-[var(--golden-chestnut)] animate-spin" />
              )}
            </div>

            {/* Loading State */}
            {isLoadingThreads && (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-[var(--golden-chestnut)] animate-spin mb-3" />
                <p className="text-foreground/60 text-sm">Analyzing research patterns...</p>
                <p className="text-foreground/50 text-xs mt-1">Identifying narrative threads</p>
              </div>
            )}

            {/* Error State */}
            {threadsError && !isLoadingThreads && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-none p-4">
                <p className="text-red-400 text-xs">{threadsError}</p>
                <button
                  onClick={() => fetchEvidenceThreads(true)}
                  className="mt-2 text-xs text-[var(--golden-chestnut)] hover:underline"
                >
                  Try again
                </button>
              </div>
            )}

            {/* AI Threads Content */}
            {aiEvidenceThreads && !isLoadingThreads && !threadsError && (
              <>
                {/* Metadata bar */}
                <div className="flex items-center justify-between text-[10px] text-foreground/50 pb-3 mb-4 border-b border-border">
                  <span>{aiEvidenceThreads.papers_analyzed} papers analyzed</span>
                  <button
                    onClick={() => fetchEvidenceThreads(true)}
                    className="text-[var(--golden-chestnut)] hover:underline flex items-center gap-1"
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
                            <h4 className="font-medium text-sm text-foreground leading-tight">{thread.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                thread.strength === "foundational" ? "bg-green-500/20 text-green-400" :
                                thread.strength === "developing" ? "bg-yellow-500/20 text-yellow-400" :
                                "bg-gray-500/20 text-foreground/60"
                              }`}>
                                {thread.strength}
                              </span>
                              <span className="text-[10px] text-foreground/50 capitalize">
                                {thread.type.replace(/_/g, " ")}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Timeline Milestones */}
                        <div className="relative pl-4 ml-3 border-l border-border space-y-3">
                          {thread.milestones.map((milestone, milestoneIndex) => (
                            <div key={milestoneIndex} className="relative pl-4 group">
                              {/* Timeline dot */}
                              <div className="absolute -left-[7px] top-1.5 w-2.5 h-2.5 rounded-full bg-foreground/10 border-2 border-[var(--golden-chestnut)] group-hover:bg-[var(--golden-chestnut)] transition-colors" />

                              {/* Year badge */}
                              <span className="text-[10px] font-mono text-[var(--golden-chestnut)] font-bold">
                                {milestone.year}
                              </span>

                              {/* Finding */}
                              <p className="text-xs text-foreground/80 mt-0.5 leading-relaxed">
                                {milestone.finding}
                              </p>

                              {/* Paper reference */}
                              <p className="text-[10px] text-foreground/50 mt-1 truncate" title={milestone.paper_title}>
                                {milestone.paper_title.length > 50
                                  ? milestone.paper_title.slice(0, 50) + "..."
                                  : milestone.paper_title}
                              </p>
                            </div>
                          ))}
                        </div>

                        {/* Thread Narrative */}
                        <div className="mt-3 ml-3 pl-4 border-l border-transparent">
                          <p className="text-xs text-foreground/60 italic leading-relaxed">
                            {thread.narrative}
                          </p>
                        </div>

                        {/* Divider between threads */}
                        {threadIndex < aiEvidenceThreads.threads.length - 1 && (
                          <div className="mt-5 mb-2 border-t border-border" />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-foreground/50 text-sm">
                      {!aiEvidenceThreads.eligible ? (
                        <>
                          <span className="block mb-1">Unable to generate threads</span>
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
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-[var(--golden-chestnut)] animate-spin mb-3" />
                <p className="text-foreground/60 text-sm">Loading evidence threads...</p>
              </div>
            )}
          </CornerBrackets>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <CornerBrackets className="bg-card/30 p-3">
              <p className="text-foreground/50 text-[10px] uppercase font-bold tracking-wider mb-1">Confidence</p>
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
            </CornerBrackets>
            <CornerBrackets className="bg-card/30 p-3">
              <p className="text-foreground/50 text-[10px] uppercase font-bold tracking-wider mb-1">Consensus</p>
              <p className="text-lg font-bold">{confidenceMetrics?.consensus_percentage || 0}%</p>
            </CornerBrackets>
          </div>
        </div>
      </main>
      )}

      {/* AI Chat Sidebar */}
      <AIChatSidebar
        open={chatOpen}
        onOpenChange={setChatOpen}
        context={{
          episode_id: episodeId,
          episode_title: episode.title,
          guest: episode.guest,
          claim_id: claim.id,
          claim_text: claim.title,
        }}
        onViewPaper={onViewSourcePaper}
      />
    </div>
  )
}
