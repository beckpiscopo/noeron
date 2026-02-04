"use client"

import { useState, useEffect } from "react"
import {
  ArrowLeft,
  FlaskConical,
  Loader2,
  Search,
  Settings,
  HelpCircle as HelpIcon,
} from "lucide-react"
import { NoeronHeader } from "./noeron-header"
import { callMcpTool, analyzePaperFigures, type FigureAnalysis, type AnalyzeFiguresResponse } from "@/lib/api"
import { AIChatSidebar } from "./ai-chat"
import { useGeminiKey } from "@/contexts/gemini-key-context"
import { ApiKeyModal } from "./api-key-modal"
import type { GeneratePodcastResponse } from "@/lib/chat-types"

// New components
import { ClaimCard } from "./deep-exploration/claim-card"
import { SegmentedTabBar, type TabId } from "./deep-exploration/segmented-tab-bar"
import { OverviewTab, EvidenceTab, FiguresTab, GraphTab, CreateTab, CommunityTab } from "./deep-exploration/tabs"

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
  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>("overview")

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

  // Figure Analysis state (Agentic Vision)
  const [figureAnalysis, setFigureAnalysis] = useState<AnalyzeFiguresResponse | null>(null)
  const [isLoadingFigures, setIsLoadingFigures] = useState(false)
  const [figuresError, setFiguresError] = useState<string | null>(null)
  const [selectedFigure, setSelectedFigure] = useState<FigureAnalysis | null>(null)
  const [pendingFigurePaperId, setPendingFigurePaperId] = useState<string | null>(null)
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false)
  const { hasKey: hasGeminiKey } = useGeminiKey()

  // Fetch claim context data on mount
  useEffect(() => {
    let cancelled = false

    const fetchClaimContext = async () => {
      setIsLoading(true)
      setError(null)

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

  // Auto-fetch evidence threads after deep dive finishes
  useEffect(() => {
    if (contextData && !aiEvidenceThreads && !isLoadingThreads && !threadsError
        && !isLoadingDeepDive.technical && (deepDiveSummaries.technical || deepDiveErrors.technical)) {
      fetchEvidenceThreads()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextData, isLoadingDeepDive.technical, deepDiveSummaries.technical, deepDiveErrors.technical])

  // Function to fetch deep dive summary on-demand
  const fetchDeepDiveSummary = async (style: "simplified" | "technical", forceRegenerate = false) => {
    if (!claim.id.includes("-")) return

    setIsLoadingDeepDive(prev => ({ ...prev, [style]: true }))
    setDeepDiveErrors(prev => ({ ...prev, [style]: null }))

    try {
      // TODO: Consider increasing n_results to 10-12 for richer synthesis on future episodes
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

  // Function to analyze figures from papers
  const fetchFigureAnalysis = async (paperId: string) => {
    if (!hasGeminiKey) {
      setPendingFigurePaperId(paperId)
      setApiKeyModalOpen(true)
      return
    }

    setPendingFigurePaperId(paperId)
    setIsLoadingFigures(true)
    setFiguresError(null)

    try {
      const data = await analyzePaperFigures(
        paperId,
        synthesis?.claim_text || claim.title
      )

      if (data.error) {
        if (data.error.includes("No figures found") || data.error.includes("No figures with images")) {
          setFiguresError("no_figures")
        } else {
          setFiguresError(data.error)
        }
      } else {
        setFigureAnalysis(data)
        if (data.figures.length > 0) {
          setSelectedFigure(data.figures[0])
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to analyze figures"
      console.error("Error analyzing figures:", err)

      if (errorMessage.includes("429") || errorMessage.includes("rate") || errorMessage.includes("quota")) {
        setFiguresError("rate_limited")
      } else if (errorMessage.includes("401") || errorMessage.includes("403") || errorMessage.includes("Invalid API")) {
        setFiguresError("invalid_key")
      } else {
        setFiguresError(errorMessage)
      }
    } finally {
      setIsLoadingFigures(false)
    }
  }

  // Retry figure analysis after API key modal
  useEffect(() => {
    if (hasGeminiKey && pendingFigurePaperId && !apiKeyModalOpen && !isLoadingFigures) {
      const timer = setTimeout(() => {
        fetchFigureAnalysis(pendingFigurePaperId)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [hasGeminiKey, apiKeyModalOpen])

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // Use real data or fallback
  const synthesis = contextData?.synthesis

  // Clear figures state
  const handleClearFigures = () => {
    setFigureAnalysis(null)
    setSelectedFigure(null)
    setFiguresError(null)
    setPendingFigurePaperId(null)
  }

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

      {/* Main Content - Single Column Tabbed Layout */}
      {!isLoading && !error && contextData && (
        <main
          className="flex-1 w-full transition-all duration-300 ease-in-out"
          style={{ marginRight: chatOpen ? '440px' : '0' }}
        >
          <div className="max-w-6xl mx-auto px-4 lg:px-6 py-6">
            {/* Claim Card */}
            <ClaimCard
              claim={claim}
              synthesis={synthesis}
              guest={episode.guest}
              formatTime={formatTime}
            />

            {/* Segmented Tab Bar - sticky below header */}
            <div className="sticky top-[112px] z-30 bg-background/95 backdrop-blur-sm pt-4 pb-3 -mx-4 px-4 lg:-mx-6 lg:px-6 border-b border-transparent [&.is-stuck]:border-border transition-colors">
              <SegmentedTabBar
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            </div>

            {/* Tab Content */}
            <div className="mt-4">
              {activeTab === "overview" && (
                <OverviewTab
                  synthesisMode={synthesisMode}
                  onSynthesisModeChange={setSynthesisMode}
                  deepDiveSummaries={deepDiveSummaries}
                  isLoadingDeepDive={isLoadingDeepDive}
                  deepDiveErrors={deepDiveErrors}
                  onFetchDeepDive={fetchDeepDiveSummary}
                  episodeId={episodeId}
                  onViewSourcePaper={onViewSourcePaper}
                />
              )}

              {activeTab === "evidence" && (
                <EvidenceTab
                  aiEvidenceThreads={aiEvidenceThreads}
                  isLoadingThreads={isLoadingThreads}
                  threadsError={threadsError}
                  onFetchThreads={fetchEvidenceThreads}
                  onFetchFigureAnalysis={fetchFigureAnalysis}
                  fallbackPapers={deepDiveSummaries.technical?.papers}
                />
              )}

              {activeTab === "figures" && (
                <FiguresTab
                  claimId={claim.id}
                  episodeId={episodeId}
                  figureAnalysis={figureAnalysis}
                  isLoadingFigures={isLoadingFigures}
                  figuresError={figuresError}
                  selectedFigure={selectedFigure}
                  onSelectFigure={setSelectedFigure}
                  onFetchFigureAnalysis={fetchFigureAnalysis}
                  onClearFigures={handleClearFigures}
                  onOpenApiKeyModal={() => setApiKeyModalOpen(true)}
                  pendingFigurePaperId={pendingFigurePaperId}
                  onViewSourcePaper={onViewSourcePaper}
                />
              )}

              {activeTab === "graph" && (
                <GraphTab
                  kgSubgraph={kgSubgraph}
                  isLoadingKG={isLoadingKG}
                  kgError={kgError}
                  onFetchKG={fetchKGSubgraph}
                  claimId={claim.id}
                  claimText={synthesis?.claim_text || claim.description}
                />
              )}

              {activeTab === "create" && (
                <CreateTab
                  claimId={claim.id}
                  episodeId={episodeId}
                  miniPodcast={miniPodcast}
                  isLoadingPodcast={isLoadingPodcast}
                  podcastError={podcastError}
                  onGeneratePodcast={() => fetchMiniPodcast(false)}
                  onRegeneratePodcast={() => fetchMiniPodcast(true)}
                  synthesisMode={synthesisMode}
                />
              )}

              {activeTab === "community" && (
                <CommunityTab claimId={claim.id} />
              )}
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

      {/* API Key Modal for Figure Analysis */}
      <ApiKeyModal
        open={apiKeyModalOpen}
        onOpenChange={setApiKeyModalOpen}
      />
    </div>
  )
}
