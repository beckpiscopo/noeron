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
  ChevronRight,
  Download,
  Share2,
  BarChart3,
} from "lucide-react"
import { NoeronHeader } from "./noeron-header"
import { Button } from "@/components/ui/button"
import { useBookmarks } from "@/hooks/use-bookmarks"
import { callMcpTool } from "@/lib/api"
import type { BookmarkWithDetails, BookmarkType, EpisodeNotebookStats } from "@/lib/supabase"
import { NotebookSynthesisPanel } from "./notebook-synthesis-panel"

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
        const [bookmarksData, episodes] = await Promise.all([
          getBookmarksForEpisode(episodeId),
          callMcpTool<EpisodeMetadata[]>("list_episodes", {}),
        ])

        if (!mounted) return

        setBookmarks(bookmarksData)
        const meta = episodes.find((ep) => ep.id === episodeId)
        if (meta) setEpisodeMetadata(meta)
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

    // Apply type filter
    if (filter !== "all") {
      result = result.filter((b) => b.bookmark_type === filter)
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(query) ||
          b.context_preview?.toLowerCase().includes(query) ||
          b.notes?.toLowerCase().includes(query)
      )
    }

    // Apply sort
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
  }, [bookmarks, filter, searchQuery, sortBy])

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
        return "bg-blue-500/10 text-blue-400"
      case "paper":
        return "bg-green-500/10 text-green-400"
      case "snippet":
        return "bg-gray-500/10 text-gray-400"
      case "ai_insight":
        return "bg-purple-500/10 text-purple-400"
      case "image":
        return "bg-amber-500/10 text-amber-400"
    }
  }

  const formatTimestamp = (ms?: number) => {
    if (!ms) return null
    const seconds = Math.floor(ms / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="noeron-theme relative flex min-h-screen w-full flex-col bg-background text-foreground">
      <NoeronHeader actions={headerActions} onLogoClick={onBack} />

      <main className="flex-1 w-full px-4 md:px-10 py-8">
        <div className="mx-auto max-w-[1200px]">
          {/* Page Header */}
          <div className="mb-6">
            <div className="eyebrow mb-2">Notebook</div>
            <h1 className="display text-2xl md:text-3xl font-normal leading-tight tracking-[-0.02em] text-foreground mb-1">
              {episodeMetadata?.title || episodeId}
            </h1>
            {episodeMetadata && (
              <p className="text-foreground/60 text-sm">
                {episodeMetadata.podcast} with {episodeMetadata.guest}
              </p>
            )}
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 mb-6 border-b border-border">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px ${
                activeTab === "overview"
                  ? "text-[var(--golden-chestnut)] border-[var(--golden-chestnut)]"
                  : "text-foreground/50 border-transparent hover:text-foreground"
              }`}
            >
              OVERVIEW
            </button>
            <button
              onClick={() => setActiveTab("saved")}
              className={`px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px ${
                activeTab === "saved"
                  ? "text-[var(--golden-chestnut)] border-[var(--golden-chestnut)]"
                  : "text-foreground/50 border-transparent hover:text-foreground"
              }`}
            >
              SAVED ITEMS
              <span className="ml-2 text-xs opacity-60">({stats.total})</span>
            </button>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-[var(--golden-chestnut)] animate-spin mr-3" />
              <span className="text-foreground/50">Loading notebook...</span>
            </div>
          )}

          {/* OVERVIEW TAB */}
          {!isLoading && activeTab === "overview" && (
            <div className="space-y-8">
              {/* Statistics Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="border border-border p-4 bg-card/50">
                  <div className="text-3xl font-bold mono text-foreground mb-1">
                    {stats.total}
                  </div>
                  <div className="text-xs uppercase tracking-wider text-foreground/50">
                    Items Saved
                  </div>
                </div>
                <div className="border border-border p-4 bg-card/50">
                  <div className="text-3xl font-bold mono text-foreground mb-1">
                    {stats.lastUpdated
                      ? stats.lastUpdated.toLocaleDateString()
                      : "—"}
                  </div>
                  <div className="text-xs uppercase tracking-wider text-foreground/50">
                    Last Updated
                  </div>
                </div>
                <div className="border border-border p-4 bg-card/50">
                  <div className="text-3xl font-bold mono text-foreground mb-1">
                    {stats.quizReady}
                  </div>
                  <div className="text-xs uppercase tracking-wider text-foreground/50">
                    Quiz Ready
                  </div>
                </div>
                <div className="border border-border p-4 bg-card/50">
                  <div className="text-3xl font-bold mono text-foreground mb-1">
                    {Object.values(stats.counts).filter((c) => c > 0).length}
                  </div>
                  <div className="text-xs uppercase tracking-wider text-foreground/50">
                    Item Types
                  </div>
                </div>
              </div>

              {/* Item Breakdown Bar Chart */}
              <div className="border border-border p-6 bg-card/50">
                <h3 className="text-sm font-medium text-foreground/70 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Item Breakdown
                </h3>
                <div className="space-y-3">
                  {(
                    [
                      { type: "claim", label: "Claims", color: "bg-blue-500" },
                      { type: "paper", label: "Papers", color: "bg-green-500" },
                      { type: "ai_insight", label: "AI Insights", color: "bg-purple-500" },
                      { type: "image", label: "Images", color: "bg-amber-500" },
                      { type: "snippet", label: "Snippets", color: "bg-gray-500" },
                    ] as const
                  ).map(({ type, label, color }) => {
                    const count = stats.counts[type]
                    const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0
                    return (
                      <div key={type} className="flex items-center gap-3">
                        <div className="w-24 text-sm text-foreground/70">{label}</div>
                        <div className="flex-1 h-6 bg-foreground/5 relative">
                          <div
                            className={`h-full ${color} opacity-60 transition-all duration-500`}
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

              {/* AI Synthesis Panel */}
              <NotebookSynthesisPanel
                episodeId={episodeId}
                bookmarks={bookmarks}
              />

              {/* Cross-Episode Connections (Stubbed) */}
              <div className="border border-dashed border-border/50 p-6 bg-card/30">
                <h3 className="text-sm font-medium text-foreground/50 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Share2 className="w-4 h-4" />
                  Cross-Episode Connections
                </h3>
                <p className="text-foreground/40 text-sm italic">
                  Coming soon: Discover how this notebook connects to your other saved research across episodes.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="!rounded-none"
                  disabled
                  title="Coming soon"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Notebook
                </Button>
                {stats.quizReady >= 3 && (
                  <Button
                    onClick={onStartQuiz}
                    className="!rounded-none !bg-[var(--golden-chestnut)] !text-background"
                  >
                    <Brain className="w-4 h-4 mr-2" />
                    Start Quiz ({stats.quizReady} cards)
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* SAVED ITEMS TAB */}
          {!isLoading && activeTab === "saved" && (
            <div>
              {/* Filter & Sort Controls */}
              <div className="flex flex-wrap items-center gap-4 mb-6">
                {/* Type Filters */}
                <div className="flex items-center gap-1 flex-wrap">
                  {(
                    [
                      { key: "all", label: "All" },
                      { key: "claim", label: "Claims" },
                      { key: "paper", label: "Papers" },
                      { key: "ai_insight", label: "AI Insights" },
                      { key: "image", label: "Images" },
                      { key: "snippet", label: "Snippets" },
                    ] as const
                  ).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setFilter(key)}
                      className={`px-3 py-1.5 text-xs font-medium mono uppercase tracking-wider border transition-all ${
                        filter === key
                          ? "bg-foreground text-background border-foreground"
                          : "bg-transparent text-foreground/60 border-border hover:border-foreground/30"
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

                {/* Sort Dropdown */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortType)}
                  className="px-3 py-1.5 text-xs font-medium mono uppercase bg-transparent border border-border text-foreground/60 focus:outline-none focus:border-foreground/30"
                >
                  <option value="date_added">Date Added</option>
                  <option value="timestamp">Timestamp</option>
                  <option value="type">Type</option>
                </select>

                {/* Search */}
                <div className="ml-auto flex items-center gap-2 bg-card border border-border px-3 py-1.5">
                  <Search className="w-4 h-4 text-foreground/40" />
                  <input
                    type="text"
                    placeholder="Search items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent text-sm text-foreground placeholder:text-foreground/40 focus:outline-none w-32 md:w-48"
                  />
                </div>
              </div>

              {/* Empty State */}
              {filteredBookmarks.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-foreground/50">
                    {searchQuery || filter !== "all"
                      ? "No items match your filters"
                      : "No items saved yet"}
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
                      className={`group relative flex flex-col border border-border p-5 transition-all duration-300 hover:bg-card hover:shadow-[0_0_25px_rgba(190,124,77,0.15)] hover:border-[var(--golden-chestnut)]/30 bg-card/50 ${
                        bookmark.bookmark_type === "claim" ||
                        bookmark.bookmark_type === "paper"
                          ? "cursor-pointer"
                          : ""
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div
                          className={`flex items-center gap-2 px-2 py-1 text-xs font-bold uppercase tracking-wider ${getTypeColor(
                            bookmark.bookmark_type
                          )}`}
                        >
                          {getBookmarkIcon(bookmark.bookmark_type)}
                          <span>{bookmark.bookmark_type.replace("_", " ")}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={(e) => handleStartEditNotes(bookmark, e)}
                            className="p-1 text-foreground/40 hover:text-foreground transition-all"
                            title="Edit notes"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleRemoveBookmark(bookmark.id, e)}
                            className="p-1 text-foreground/40 hover:text-red-400 transition-all"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Timestamp */}
                      {bookmark.start_ms && (
                        <div className="flex items-center gap-1 text-xs text-foreground/50 mb-2 mono">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(bookmark.start_ms)}
                        </div>
                      )}

                      {/* Title */}
                      <h3 className="text-foreground font-medium leading-snug mb-2 line-clamp-2">
                        {bookmark.title}
                      </h3>

                      {/* Preview */}
                      {bookmark.context_preview && (
                        <p className="text-foreground/60 text-sm leading-relaxed line-clamp-3 mb-3">
                          {bookmark.context_preview}
                        </p>
                      )}

                      {/* Image Preview */}
                      {bookmark.bookmark_type === "image" && bookmark.image_url && (
                        <div className="mb-3 rounded overflow-hidden border border-border/50">
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
                          className="mt-auto pt-3 border-t border-border/50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <textarea
                            value={notesValue}
                            onChange={(e) => setNotesValue(e.target.value)}
                            placeholder="Add your notes..."
                            className="w-full bg-background border border-border p-2 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-[var(--golden-chestnut)] resize-none"
                            rows={3}
                            autoFocus
                          />
                          <div className="flex gap-2 mt-2">
                            <Button
                              size="sm"
                              onClick={(e) => handleSaveNotes(bookmark.id, e)}
                              className="!rounded-none !bg-[var(--golden-chestnut)] !text-background"
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelNotes}
                              className="!rounded-none"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : bookmark.notes ? (
                        <div className="mt-2 p-2 bg-background/50 border-l-2 border-[var(--golden-chestnut)]/50">
                          <p className="text-xs text-foreground/70 italic line-clamp-2">
                            {bookmark.notes}
                          </p>
                        </div>
                      ) : null}

                      {/* Footer */}
                      <div className="mt-auto flex items-center justify-between pt-3 border-t border-border/50">
                        <span className="text-xs text-foreground/40 mono">
                          {new Date(bookmark.created_at).toLocaleDateString()}
                        </span>
                        {bookmark.quiz_count > 0 && (
                          <span className="text-xs text-[var(--golden-chestnut)] mono">
                            Quiz: {Math.round((bookmark.quiz_score || 0) * 100)}%
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
    </div>
  )
}
