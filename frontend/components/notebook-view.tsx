"use client"

import { useEffect, useState, useMemo } from "react"
import {
  ArrowLeft,
  FileText,
  Quote,
  Search,
  Settings,
  HelpCircle,
  Trash2,
  Edit3,
  Loader2,
  Sparkles,
  ImageIcon,
  Brain,
  Clock,
  Download,
  Share2,
  BarChart3,
  Radio,
  Zap,
} from "lucide-react"
import { NoeronHeader } from "./noeron-header"
import { Button } from "@/components/ui/button"
import { useBookmarks } from "@/hooks/use-bookmarks"
import { callMcpTool } from "@/lib/api"
import type { BookmarkWithDetails, BookmarkType, NotebookClusterDistribution, BookmarkClusterMapping } from "@/lib/supabase"
import { getNotebookClusterDistribution, getBookmarkClusterMappings } from "@/lib/supabase"
import { NotebookSynthesisPanel } from "./notebook-synthesis-panel"
import { ClusterDistributionBars, TaxonomyBubbleMap } from "./taxonomy-bubble-map"
import { Layers, Map as MapIcon } from "lucide-react"

interface EpisodeMetadata {
  id: string
  title: string
  podcast: string
  guest: string
  host: string
  duration: string
  date: string
}

interface NotebookViewProps {
  episodeId: string
  onBack: () => void
  onViewClaim: (claimId: number) => void
  onViewPaper: (paperId: string) => void
  onStartQuiz: () => void
  onBookmarksClick?: () => void
}

type TabType = "overview" | "saved"
type FilterType = "all" | BookmarkType
type SortType = "timestamp" | "type" | "date_added"

export function NotebookView({
  episodeId,
  onBack,
  onViewClaim,
  onViewPaper,
  onStartQuiz,
  onBookmarksClick,
}: NotebookViewProps) {
  const { getBookmarksForEpisode, removeBookmark, updateBookmarkNotes } = useBookmarks()

  const [activeTab, setActiveTab] = useState<TabType>("overview")
  const [bookmarks, setBookmarks] = useState<BookmarkWithDetails[]>([])
  const [episodeMetadata, setEpisodeMetadata] = useState<EpisodeMetadata | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>("all")
  const [sortBy, setSortBy] = useState<SortType>("timestamp")
  const [searchQuery, setSearchQuery] = useState("")
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [notesValue, setNotesValue] = useState("")
  const [clusterDistribution, setClusterDistribution] = useState<NotebookClusterDistribution[]>([])
  const [showTaxonomyMap, setShowTaxonomyMap] = useState(false)
  const [clusterFilter, setClusterFilter] = useState<number | null>(null)
  const [bookmarkClusterMappings, setBookmarkClusterMappings] = useState<Map<string, BookmarkClusterMapping[]>>(new Map())

  const iconButtonClasses =
    "flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition hover:text-foreground"

  const headerActions = (
    <>
      <button onClick={onBack} className={iconButtonClasses} title="Back to Notebooks">
        <ArrowLeft className="h-4 w-4" />
      </button>
      <button className={iconButtonClasses}>
        <Settings className="h-4 w-4" />
      </button>
      <button className={iconButtonClasses}>
        <HelpCircle className="h-4 w-4" />
      </button>
    </>
  )

  // Load bookmarks and episode metadata
  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      setIsLoading(true)
      try {
        const [bookmarksData, episodes, clusterDist] = await Promise.all([
          getBookmarksForEpisode(episodeId),
          callMcpTool<EpisodeMetadata[]>("list_episodes", {}),
          getNotebookClusterDistribution(episodeId),
        ])

        if (!mounted) return

        setBookmarks(bookmarksData)
        setClusterDistribution(clusterDist)
        const meta = episodes.find((ep) => ep.id === episodeId)
        if (meta) setEpisodeMetadata(meta)

        // Load cluster mappings for all bookmarks
        const bookmarkIds = bookmarksData.map((b) => b.id)
        if (bookmarkIds.length > 0) {
          const mappings = await getBookmarkClusterMappings(bookmarkIds)
          if (mounted) setBookmarkClusterMappings(mappings)
        }
      } catch (err) {
        console.error("Failed to load notebook data:", err)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    loadData()

    return () => {
      mounted = false
    }
  }, [episodeId, getBookmarksForEpisode])

  // Compute stats
  const stats = useMemo(() => {
    const counts: Record<BookmarkType, number> = {
      claim: 0,
      paper: 0,
      snippet: 0,
      ai_insight: 0,
      image: 0,
    }
    bookmarks.forEach((b) => {
      counts[b.bookmark_type]++
    })

    const lastUpdated = bookmarks.length > 0
      ? new Date(Math.max(...bookmarks.map((b) => new Date(b.created_at).getTime())))
      : null

    const quizReady = bookmarks.filter((b) => b.quiz_enabled).length

    return { counts, total: bookmarks.length, lastUpdated, quizReady }
  }, [bookmarks])

  // Filter and sort bookmarks
  const filteredBookmarks = useMemo(() => {
    let result = bookmarks

    if (filter !== "all") {
      result = result.filter((b) => b.bookmark_type === filter)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(query) ||
          b.context_preview?.toLowerCase().includes(query) ||
          b.notes?.toLowerCase().includes(query)
      )
    }

    // Filter by cluster
    if (clusterFilter !== null) {
      result = result.filter((b) => {
        const mappings = bookmarkClusterMappings.get(b.id)
        return mappings?.some((m) => m.cluster_id === clusterFilter)
      })
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "timestamp":
          return (b.start_ms || 0) - (a.start_ms || 0)
        case "type":
          return a.bookmark_type.localeCompare(b.bookmark_type)
        case "date_added":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

    return result
  }, [bookmarks, filter, searchQuery, sortBy, clusterFilter, bookmarkClusterMappings])

  const handleBookmarkClick = (bookmark: BookmarkWithDetails) => {
    if (bookmark.bookmark_type === "claim" && bookmark.claim_id) {
      onViewClaim(bookmark.claim_id)
    } else if (bookmark.bookmark_type === "paper" && bookmark.paper_id) {
      onViewPaper(bookmark.paper_id)
    }
  }

  const handleStartEditNotes = (bookmark: BookmarkWithDetails, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingNotes(bookmark.id)
    setNotesValue(bookmark.notes || "")
  }

  const handleSaveNotes = async (bookmarkId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await updateBookmarkNotes(bookmarkId, notesValue)
    setBookmarks((prev) =>
      prev.map((b) => (b.id === bookmarkId ? { ...b, notes: notesValue } : b))
    )
    setEditingNotes(null)
    setNotesValue("")
  }

  const handleCancelNotes = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingNotes(null)
    setNotesValue("")
  }

  const handleRemoveBookmark = async (bookmarkId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await removeBookmark(bookmarkId)
    setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId))
  }

  const getBookmarkIcon = (type: BookmarkType) => {
    switch (type) {
      case "claim":
        return <FileText className="w-4 h-4" />
      case "paper":
        return <FileText className="w-4 h-4" />
      case "snippet":
        return <Quote className="w-4 h-4" />
      case "ai_insight":
        return <Sparkles className="w-4 h-4" />
      case "image":
        return <ImageIcon className="w-4 h-4" />
    }
  }

  const getTypeColor = (type: BookmarkType) => {
    switch (type) {
      case "claim":
        return "bg-[var(--golden-chestnut)]/20 text-[var(--golden-chestnut)]"
      case "paper":
        return "bg-emerald-500/20 text-emerald-400"
      case "snippet":
        return "bg-foreground/10 text-foreground/70"
      case "ai_insight":
        return "bg-purple-500/20 text-purple-400"
      case "image":
        return "bg-amber-500/20 text-amber-400"
    }
  }

  const formatTimestamp = (ms?: number) => {
    if (!ms) return null
    const seconds = Math.floor(ms / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const formatDate = (date: Date) => {
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(-2)}`
  }

  return (
    <div className="noeron-theme relative flex min-h-screen w-full flex-col bg-background text-foreground">
      <NoeronHeader actions={headerActions} onLogoClick={onBack} onBookmarksClick={onBookmarksClick} />

      <main className="flex-1 w-full px-4 md:px-10 py-6">
        <div className="mx-auto max-w-[1200px]">
          {/* Terminal Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <p className="eyebrow">
                NOTEBOOK // PUBLIC ACCESS
              </p>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-emerald-500 text-[0.65rem] mono uppercase tracking-wider">
                  <Radio className="w-3 h-3 animate-pulse" />
                  LIVE CONNECTION
                </span>
              </div>
            </div>
            <h1 className="display text-2xl md:text-3xl lg:text-4xl text-[var(--golden-chestnut)] uppercase tracking-wide leading-tight mb-2">
              {episodeMetadata?.title || episodeId}
            </h1>
            {episodeMetadata && (
              <p className="text-foreground/50 text-sm mono">
                <span className="text-[var(--golden-chestnut)]">*</span> {episodeMetadata.podcast} #{episodeId.split('_')[1]} with {episodeMetadata.guest}
              </p>
            )}
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-6 mb-8 border-b border-border/50">
            <button
              onClick={() => setActiveTab("overview")}
              className={`pb-3 text-sm mono uppercase tracking-wider transition-all border-b-2 -mb-px ${
                activeTab === "overview"
                  ? "text-[var(--golden-chestnut)] border-[var(--golden-chestnut)]"
                  : "text-foreground/40 border-transparent hover:text-foreground/60"
              }`}
            >
              OVERVIEW
            </button>
            <button
              onClick={() => setActiveTab("saved")}
              className={`pb-3 text-sm mono uppercase tracking-wider transition-all border-b-2 -mb-px ${
                activeTab === "saved"
                  ? "text-[var(--golden-chestnut)] border-[var(--golden-chestnut)]"
                  : "text-foreground/40 border-transparent hover:text-foreground/60"
              }`}
            >
              SAVED ITEMS ({stats.total})
            </button>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-[var(--golden-chestnut)] animate-spin mr-3" />
              <span className="text-foreground/50 mono text-sm">LOADING DATA...</span>
            </div>
          )}

          {/* OVERVIEW TAB */}
          {!isLoading && activeTab === "overview" && (
            <div className="space-y-8">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { value: stats.total, label: "ITEMS SAVED", icon: "□" },
                  { value: stats.lastUpdated ? formatDate(stats.lastUpdated) : "—", label: "LAST UPDATED", icon: "◇" },
                  { value: stats.quizReady, label: "QUIZ READY", icon: "◇" },
                  { value: Object.values(stats.counts).filter((c) => c > 0).length, label: "ITEM TYPES", icon: "△" },
                ].map((stat, i) => (
                  <div key={i} className="border border-border/50 bg-card/30 p-5">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-3xl md:text-4xl font-light text-foreground tracking-tight">
                        {stat.value}
                      </span>
                      <span className="text-foreground/20 text-lg">{stat.icon}</span>
                    </div>
                    <p className="text-[0.65rem] mono uppercase tracking-wider text-foreground/40">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>

              {/* Item Breakdown Analysis */}
              <div className="border border-border/50 bg-card/30 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm mono uppercase tracking-wider text-foreground/70 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[var(--golden-chestnut)]" />
                    ITEM BREAKDOWN ANALYSIS
                  </h3>
                  <span className="text-[0.6rem] mono text-foreground/30 uppercase">REF: META-STRUCT</span>
                </div>
                <div className="space-y-4">
                  {(
                    [
                      { type: "claim", label: "CLAIMS" },
                      { type: "paper", label: "PAPERS" },
                      { type: "ai_insight", label: "AI INSIGHTS" },
                      { type: "image", label: "IMAGES" },
                      { type: "snippet", label: "SNIPPETS" },
                    ] as const
                  ).map(({ type, label }) => {
                    const count = stats.counts[type]
                    const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0
                    return (
                      <div key={type} className="flex items-center gap-4">
                        <div className="w-24 text-xs mono text-foreground/50 flex items-center gap-2">
                          <span className="text-foreground/30">*</span>
                          {label}
                        </div>
                        <div className="flex-1 h-5 bg-foreground/5 relative overflow-hidden">
                          <div
                            className="h-full bg-[var(--golden-chestnut)]/80 transition-all duration-700"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="w-8 text-right text-sm mono text-foreground/60">
                          {count}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Research Territories */}
              {clusterDistribution.length > 0 && (
                <div className="border border-border/50 bg-card/30 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm mono uppercase tracking-wider text-foreground/70 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[var(--golden-chestnut)]" />
                      RESEARCH TERRITORIES
                    </h3>
                    <button
                      onClick={() => setShowTaxonomyMap(true)}
                      className="text-[10px] mono text-[var(--golden-chestnut)] hover:underline flex items-center gap-1"
                    >
                      <MapIcon className="w-3 h-3" />
                      VIEW MAP
                    </button>
                  </div>
                  <div className="mb-4">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-2xl font-light text-foreground">
                        {clusterDistribution.filter(c => c.bookmark_count > 0).length}
                      </span>
                      <span className="text-foreground/50 text-sm">
                        of {clusterDistribution.length} territories explored
                      </span>
                    </div>
                    <p className="text-[10px] text-foreground/40 mono">
                      Click a territory to filter your saved items
                    </p>
                  </div>

                  {/* Clickable Cluster Bars */}
                  <div className="space-y-2">
                    {clusterDistribution
                      .filter(c => c.bookmark_count > 0)
                      .sort((a, b) => b.bookmark_count - a.bookmark_count)
                      .slice(0, 6)
                      .map((cluster) => {
                        const maxCount = Math.max(...clusterDistribution.map(c => c.bookmark_count), 1)
                        const depthLabel = cluster.bookmark_count >= 5 ? "DEEP" : cluster.bookmark_count >= 2 ? "MODERATE" : "TOUCHED"
                        return (
                          <button
                            key={cluster.cluster_id}
                            onClick={() => {
                              setClusterFilter(cluster.cluster_id)
                              setActiveTab("saved")
                            }}
                            className="w-full flex items-center gap-3 p-2 -mx-2 hover:bg-[var(--golden-chestnut)]/5 transition-colors group rounded"
                          >
                            <div className="w-28 text-[10px] mono text-foreground/50 truncate text-left group-hover:text-[var(--golden-chestnut)] transition-colors" title={cluster.label}>
                              {cluster.label}
                            </div>
                            <div className="flex-1 h-2 bg-foreground/5 relative">
                              <div
                                className="h-full bg-[var(--golden-chestnut)] group-hover:bg-[var(--golden-chestnut)]/80 transition-colors"
                                style={{ width: `${(cluster.bookmark_count / maxCount) * 100}%` }}
                              />
                            </div>
                            <div className="w-6 text-right text-[10px] mono text-foreground/60 group-hover:text-[var(--golden-chestnut)] transition-colors">
                              {cluster.bookmark_count}
                            </div>
                            <div className="w-16 text-right">
                              <span className={`text-[8px] mono uppercase tracking-wider ${
                                depthLabel === "DEEP" ? "text-[var(--golden-chestnut)]" :
                                depthLabel === "MODERATE" ? "text-foreground/50" : "text-foreground/30"
                              }`}>
                                {depthLabel}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                  </div>

                  {clusterDistribution.filter(c => c.bookmark_count === 0).length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border/30">
                      <p className="text-[10px] text-foreground/40 mono mb-2">
                        Unexplored territories:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {clusterDistribution
                          .filter(c => c.bookmark_count === 0)
                          .slice(0, 4)
                          .map(c => (
                            <span
                              key={c.cluster_id}
                              className="px-2 py-0.5 bg-foreground/5 text-foreground/40 text-[10px]"
                            >
                              {c.label}
                            </span>
                          ))}
                        {clusterDistribution.filter(c => c.bookmark_count === 0).length > 4 && (
                          <span className="px-2 py-0.5 text-foreground/30 text-[10px]">
                            +{clusterDistribution.filter(c => c.bookmark_count === 0).length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Taxonomy Map Modal */}
              {showTaxonomyMap && (
                <div className="fixed inset-0 z-50 bg-background/90 flex items-center justify-center p-4">
                  <div className="bg-card border border-border max-w-4xl w-full max-h-[90vh] overflow-auto">
                    <div className="flex items-center justify-between p-4 border-b border-border/50">
                      <h3 className="mono uppercase tracking-wider text-sm text-foreground/70 flex items-center gap-2">
                        <MapIcon className="w-4 h-4 text-[var(--golden-chestnut)]" />
                        RESEARCH TERRITORY MAP
                      </h3>
                      <button
                        onClick={() => setShowTaxonomyMap(false)}
                        className="text-foreground/50 hover:text-foreground text-sm mono"
                      >
                        CLOSE
                      </button>
                    </div>
                    <div className="p-4">
                      <TaxonomyBubbleMap
                        highlightMode="notebook"
                        width={800}
                        height={500}
                        showLegend={true}
                      />
                      <p className="text-[10px] text-foreground/40 mono mt-4 text-center">
                        Bubble size represents paper count. Position reflects semantic similarity between clusters.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Intelligence Synthesis */}
              <div className="border border-border/50 bg-card/30 p-6">
                <h3 className="text-sm mono uppercase tracking-wider text-foreground/70 flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-[var(--golden-chestnut)]" />
                  INTELLIGENCE SYNTHESIS
                </h3>
                <div className="border border-dashed border-border/50 p-6 text-center mb-6">
                  <p className="text-foreground/40 text-sm mono">
                    Generate an AI-powered overview of your saved research items to detect latent patterns and cross-reference validity.
                  </p>
                </div>
                <div className="flex justify-center">
                  <Button
                    className="!rounded-none !bg-transparent border border-[var(--golden-chestnut)] text-[var(--golden-chestnut)] hover:!bg-[var(--golden-chestnut)]/10 mono uppercase tracking-wider text-xs px-6"
                    disabled={stats.total === 0}
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    INITIATE SYNTHESIS SEQUENCE
                  </Button>
                </div>
              </div>

              {/* Cross-Episode Connections */}
              <div className="border border-dashed border-border/30 p-6">
                <h3 className="text-sm mono uppercase tracking-wider text-foreground/40 flex items-center gap-2 mb-3">
                  <span className="text-foreground/20">※</span>
                  CROSS-EPISODE CONNECTIONS
                </h3>
                <p className="text-foreground/30 text-xs mono">
                  [SYSTEM NOTICE] Connection module currently offline. Algorithmic pairing of this notebook with external research nodes is pending update cycle v2.5.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 pt-4">
                <Button
                  variant="outline"
                  className="!rounded-none border-border/50 text-foreground/60 mono uppercase text-xs tracking-wider"
                  disabled
                >
                  <Download className="w-4 h-4 mr-2" />
                  EXPORT DATA
                </Button>
                {stats.quizReady >= 3 && (
                  <Button
                    onClick={onStartQuiz}
                    className="!rounded-none !bg-[var(--golden-chestnut)] !text-background mono uppercase text-xs tracking-wider"
                  >
                    <Brain className="w-4 h-4 mr-2" />
                    START QUIZ ({stats.quizReady})
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* SAVED ITEMS TAB */}
          {!isLoading && activeTab === "saved" && (
            <div>
              {/* Cluster Filter */}
              {clusterDistribution.filter(c => c.bookmark_count > 0).length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Layers className="w-3 h-3 text-foreground/40" />
                    <span className="text-[10px] mono text-foreground/40 uppercase tracking-wider">
                      Filter by Territory
                    </span>
                    {clusterFilter !== null && (
                      <button
                        onClick={() => setClusterFilter(null)}
                        className="text-[10px] mono text-[var(--golden-chestnut)] hover:underline ml-2"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setClusterFilter(null)}
                      className={`px-2 py-1 text-[10px] mono uppercase tracking-wider border transition-all ${
                        clusterFilter === null
                          ? "bg-[var(--golden-chestnut)] text-background border-[var(--golden-chestnut)]"
                          : "bg-transparent text-foreground/50 border-border/50 hover:border-foreground/30"
                      }`}
                    >
                      ALL TERRITORIES
                    </button>
                    {clusterDistribution
                      .filter(c => c.bookmark_count > 0)
                      .sort((a, b) => b.bookmark_count - a.bookmark_count)
                      .map((cluster) => (
                        <button
                          key={cluster.cluster_id}
                          onClick={() => setClusterFilter(cluster.cluster_id)}
                          className={`px-2 py-1 text-[10px] mono uppercase tracking-wider border transition-all ${
                            clusterFilter === cluster.cluster_id
                              ? "bg-[var(--golden-chestnut)] text-background border-[var(--golden-chestnut)]"
                              : "bg-transparent text-foreground/50 border-border/50 hover:border-foreground/30"
                          }`}
                        >
                          {cluster.label} ({cluster.bookmark_count})
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Filter & Sort Controls */}
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="flex items-center gap-1 flex-wrap">
                  {(
                    [
                      { key: "all", label: "ALL" },
                      { key: "claim", label: "CLAIMS" },
                      { key: "paper", label: "PAPERS" },
                      { key: "ai_insight", label: "AI" },
                      { key: "image", label: "IMAGES" },
                      { key: "snippet", label: "SNIPPETS" },
                    ] as const
                  ).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setFilter(key)}
                      className={`px-3 py-1.5 text-[0.65rem] mono uppercase tracking-wider border transition-all ${
                        filter === key
                          ? "bg-[var(--golden-chestnut)] text-background border-[var(--golden-chestnut)]"
                          : "bg-transparent text-foreground/50 border-border/50 hover:border-foreground/30"
                      }`}
                    >
                      {label}
                      {key !== "all" && (
                        <span className="ml-1 opacity-60">
                          ({stats.counts[key as BookmarkType]})
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortType)}
                  className="px-3 py-1.5 text-[0.65rem] mono uppercase bg-transparent border border-border/50 text-foreground/50 focus:outline-none focus:border-foreground/30"
                >
                  <option value="date_added">DATE ADDED</option>
                  <option value="timestamp">TIMESTAMP</option>
                  <option value="type">TYPE</option>
                </select>

                <div className="ml-auto flex items-center gap-2 bg-card/50 border border-border/50 px-3 py-1.5">
                  <Search className="w-4 h-4 text-foreground/30" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent text-sm mono text-foreground placeholder:text-foreground/30 focus:outline-none w-32 md:w-48"
                  />
                </div>
              </div>

              {/* Empty State */}
              {filteredBookmarks.length === 0 && (
                <div className="text-center py-16 border border-dashed border-border/30">
                  <p className="text-foreground/40 mono text-sm">
                    {searchQuery || filter !== "all" || clusterFilter !== null
                      ? "[NO MATCHING RECORDS]"
                      : "[NO ITEMS SAVED]"}
                  </p>
                </div>
              )}

              {/* Items Grid */}
              {filteredBookmarks.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredBookmarks.map((bookmark) => (
                    <article
                      key={bookmark.id}
                      onClick={() => handleBookmarkClick(bookmark)}
                      className={`group relative flex flex-col border border-border/50 p-5 transition-all duration-200 hover:border-[var(--golden-chestnut)]/50 hover:bg-card/50 bg-card/20 ${
                        bookmark.bookmark_type === "claim" ||
                        bookmark.bookmark_type === "paper"
                          ? "cursor-pointer"
                          : ""
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div
                          className={`flex items-center gap-2 px-2 py-1 text-[0.6rem] mono font-bold uppercase tracking-wider ${getTypeColor(
                            bookmark.bookmark_type
                          )}`}
                        >
                          {getBookmarkIcon(bookmark.bookmark_type)}
                          <span>{bookmark.bookmark_type.replace("_", " ")}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={(e) => handleStartEditNotes(bookmark, e)}
                            className="p-1 text-foreground/30 hover:text-foreground transition-all"
                            title="Edit notes"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleRemoveBookmark(bookmark.id, e)}
                            className="p-1 text-foreground/30 hover:text-red-400 transition-all"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Timestamp */}
                      {bookmark.start_ms && (
                        <div className="flex items-center gap-1 text-[0.65rem] text-foreground/40 mb-2 mono">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(bookmark.start_ms)}
                        </div>
                      )}

                      {/* Title */}
                      <h3 className="text-foreground font-medium leading-snug mb-2 line-clamp-2">
                        {bookmark.title}
                      </h3>

                      {/* Cluster Badges */}
                      {bookmarkClusterMappings.has(bookmark.id) && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {bookmarkClusterMappings.get(bookmark.id)?.slice(0, 2).map((mapping) => (
                            <span
                              key={mapping.cluster_id}
                              className="px-1.5 py-0.5 bg-[var(--golden-chestnut)]/10 text-[var(--golden-chestnut)] text-[9px] mono truncate max-w-[120px]"
                              title={mapping.cluster_label}
                            >
                              {mapping.cluster_label}
                            </span>
                          ))}
                          {(bookmarkClusterMappings.get(bookmark.id)?.length || 0) > 2 && (
                            <span className="text-[9px] text-foreground/40 mono">
                              +{(bookmarkClusterMappings.get(bookmark.id)?.length || 0) - 2}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Preview */}
                      {bookmark.context_preview && (
                        <p className="text-foreground/50 text-sm leading-relaxed line-clamp-3 mb-3">
                          {bookmark.context_preview}
                        </p>
                      )}

                      {/* Image Preview */}
                      {bookmark.bookmark_type === "image" && bookmark.image_url && (
                        <div className="mb-3 overflow-hidden border border-border/30">
                          <img
                            src={bookmark.image_url}
                            alt={bookmark.title}
                            className="w-full h-32 object-cover"
                          />
                        </div>
                      )}

                      {/* Notes Section */}
                      {editingNotes === bookmark.id ? (
                        <div
                          className="mt-auto pt-3 border-t border-border/30"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <textarea
                            value={notesValue}
                            onChange={(e) => setNotesValue(e.target.value)}
                            placeholder="Add your notes..."
                            className="w-full bg-background border border-border/50 p-2 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-[var(--golden-chestnut)]/50 resize-none mono"
                            rows={3}
                            autoFocus
                          />
                          <div className="flex gap-2 mt-2">
                            <Button
                              size="sm"
                              onClick={(e) => handleSaveNotes(bookmark.id, e)}
                              className="!rounded-none !bg-[var(--golden-chestnut)] !text-background text-xs mono uppercase"
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelNotes}
                              className="!rounded-none text-xs mono uppercase"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : bookmark.notes ? (
                        <div className="mt-2 p-2 bg-foreground/5 border-l-2 border-[var(--golden-chestnut)]/50">
                          <p className="text-xs text-foreground/60 italic line-clamp-2">
                            {bookmark.notes}
                          </p>
                        </div>
                      ) : null}

                      {/* Footer */}
                      <div className="mt-auto flex items-center justify-between pt-3 border-t border-border/30">
                        <span className="text-[0.6rem] text-foreground/30 mono">
                          {new Date(bookmark.created_at).toLocaleDateString()}
                        </span>
                        {bookmark.quiz_count > 0 && (
                          <span className="text-[0.6rem] text-[var(--golden-chestnut)] mono">
                            QUIZ: {Math.round((bookmark.quiz_score || 0) * 100)}%
                          </span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 px-4 md:px-10 border-t border-border/30">
        <div className="mx-auto max-w-[1200px] flex items-center justify-between">
          <div className="flex items-center gap-6 text-[0.6rem] mono text-foreground/30 uppercase tracking-wider">
            <span>TX:28001204:4-FREQ</span>
            <span>NODEID: TL-7048</span>
            <span>SUBNET: EPX-68</span>
          </div>
          <div className="text-[0.6rem] mono text-foreground/30 uppercase tracking-wider">
            NOERON SYSTEMS INC. // v.BETA
          </div>
        </div>
      </footer>
    </div>
  )
}
