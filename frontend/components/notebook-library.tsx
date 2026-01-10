"use client"

import { useEffect, useState } from "react"
import {
  BookOpen,
  Clock,
  FileText,
  Search,
  Settings,
  HelpCircle,
  ArrowLeft,
  Quote,
  Sparkles,
  ImageIcon,
  Loader2,
} from "lucide-react"
import { NoeronHeader } from "./noeron-header"
import { useBookmarks } from "@/hooks/use-bookmarks"
import type { EpisodeNotebookStats } from "@/lib/supabase"
import { callMcpTool } from "@/lib/api"

interface EpisodeMetadata {
  id: string
  title: string
  podcast: string
  guest: string
}

interface NotebookLibraryProps {
  onSelectNotebook: (episodeId: string) => void
  onBack: () => void
}

export function NotebookLibrary({ onSelectNotebook, onBack }: NotebookLibraryProps) {
  const { getEpisodeBookmarkCounts } = useBookmarks()
  const [notebookStats, setNotebookStats] = useState<EpisodeNotebookStats[]>([])
  const [episodeMetadata, setEpisodeMetadata] = useState<Map<string, EpisodeMetadata>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  const iconButtonClasses =
    "flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition hover:text-foreground"

  const headerActions = (
    <>
      <button onClick={onBack} className={iconButtonClasses} title="Back to Library">
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

  useEffect(() => {
    let mounted = true

    const loadNotebooks = async () => {
      setIsLoading(true)
      try {
        // Load notebook stats (episodes with bookmarks)
        const stats = await getEpisodeBookmarkCounts()
        if (!mounted) return

        setNotebookStats(stats)

        // Load episode metadata for each notebook
        if (stats.length > 0) {
          try {
            const episodes = await callMcpTool<EpisodeMetadata[]>("list_episodes", {})
            if (!mounted) return

            const metadataMap = new Map<string, EpisodeMetadata>()
            for (const ep of episodes) {
              metadataMap.set(ep.id, ep)
            }
            setEpisodeMetadata(metadataMap)
          } catch {
            // Fallback: create placeholder metadata
            console.warn("Could not load episode metadata")
          }
        }
      } catch (err) {
        console.error("Failed to load notebooks:", err)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    loadNotebooks()

    return () => {
      mounted = false
    }
  }, [getEpisodeBookmarkCounts])

  const filteredNotebooks = notebookStats.filter((notebook) => {
    if (!searchQuery) return true
    const meta = episodeMetadata.get(notebook.episode_id)
    const searchLower = searchQuery.toLowerCase()
    return (
      notebook.episode_id.toLowerCase().includes(searchLower) ||
      meta?.title.toLowerCase().includes(searchLower) ||
      meta?.guest.toLowerCase().includes(searchLower) ||
      meta?.podcast.toLowerCase().includes(searchLower)
    )
  })

  const formatLastUpdated = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffHours < 1) return "Just now"
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="noeron-theme relative flex min-h-screen w-full flex-col bg-background text-foreground">
      <NoeronHeader actions={headerActions} onLogoClick={onBack} />

      <main className="flex-1 w-full px-4 md:px-10 py-8">
        <div className="mx-auto max-w-[1200px]">
          {/* Page Header */}
          <div className="mb-8">
            <div className="eyebrow mb-2">Your Research</div>
            <h1 className="display text-3xl md:text-4xl font-normal leading-tight tracking-[-0.02em] text-foreground mb-2">
              Notebooks
            </h1>
            <p className="text-foreground/60 text-sm md:text-base">
              {notebookStats.length === 0
                ? "Start saving content while listening to create your first notebook"
                : `${notebookStats.length} episode${notebookStats.length !== 1 ? "s" : ""} with saved research`}
            </p>
          </div>

          {/* Search Bar */}
          {notebookStats.length > 0 && (
            <div className="mb-6 flex items-center gap-2 bg-card border border-border px-4 py-2 max-w-md">
              <Search className="w-4 h-4 text-foreground/40" />
              <input
                type="text"
                placeholder="Search notebooks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-sm text-foreground placeholder:text-foreground/40 focus:outline-none flex-1"
              />
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-[var(--golden-chestnut)] animate-spin mr-3" />
              <span className="text-foreground/50">Loading notebooks...</span>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && notebookStats.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <BookOpen className="w-16 h-16 text-foreground/20 mb-6" />
              <h3 className="text-xl font-medium text-foreground mb-2">No notebooks yet</h3>
              <p className="text-foreground/60 text-sm max-w-md mb-6">
                As you listen to episodes, save claims, papers, and insights to build your personal research notebooks.
              </p>
              <button
                onClick={onBack}
                className="btn-noeron btn-noeron-primary flex items-center gap-2"
              >
                Browse Episodes
              </button>
            </div>
          )}

          {/* Notebooks Grid */}
          {!isLoading && filteredNotebooks.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredNotebooks.map((notebook) => {
                const meta = episodeMetadata.get(notebook.episode_id)
                return (
                  <article
                    key={notebook.episode_id}
                    onClick={() => onSelectNotebook(notebook.episode_id)}
                    className="group relative flex flex-col border border-border p-6 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:bg-card hover:shadow-[0_0_25px_rgba(190,124,77,0.2)] hover:border-[var(--golden-chestnut)]/30 bg-card/50"
                  >
                    {/* Episode Info */}
                    <div className="flex flex-col gap-2 mb-4">
                      <span className="text-[var(--golden-chestnut)] text-xs font-bold uppercase tracking-wider mono">
                        {meta?.podcast || "Episode"}
                      </span>
                      <h3 className="text-foreground text-lg font-bold leading-tight line-clamp-2">
                        {meta?.title || notebook.episode_id}
                      </h3>
                      {meta?.guest && (
                        <p className="text-foreground/60 text-sm">with {meta.guest}</p>
                      )}
                    </div>

                    {/* Item Counts */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {notebook.claim_count > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-500/10 text-blue-400 font-medium">
                          <FileText className="w-3 h-3" />
                          {notebook.claim_count} Claims
                        </span>
                      )}
                      {notebook.paper_count > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-500/10 text-green-400 font-medium">
                          <FileText className="w-3 h-3" />
                          {notebook.paper_count} Papers
                        </span>
                      )}
                      {notebook.ai_insight_count > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-purple-500/10 text-purple-400 font-medium">
                          <Sparkles className="w-3 h-3" />
                          {notebook.ai_insight_count} AI
                        </span>
                      )}
                      {notebook.image_count > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-amber-500/10 text-amber-400 font-medium">
                          <ImageIcon className="w-3 h-3" />
                          {notebook.image_count} Images
                        </span>
                      )}
                      {notebook.snippet_count > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-500/10 text-gray-400 font-medium">
                          <Quote className="w-3 h-3" />
                          {notebook.snippet_count} Snippets
                        </span>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="mt-auto pt-4 border-t border-border/50 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-foreground/50 text-sm">
                        <Clock className="w-4 h-4" />
                        <span>{formatLastUpdated(notebook.last_updated)}</span>
                      </div>
                      <div className="text-foreground/60 text-sm font-medium">
                        {notebook.total_items} items
                      </div>
                    </div>

                    {/* Open Indicator */}
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <BookOpen className="w-5 h-5 text-[var(--golden-chestnut)]" />
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {/* No Results */}
          {!isLoading && notebookStats.length > 0 && filteredNotebooks.length === 0 && (
            <div className="text-center py-12">
              <p className="text-foreground/50">No notebooks match your search</p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-8 text-center border-t border-border bg-background">
        <p className="text-foreground/40 text-xs font-medium tracking-wide uppercase mono">
          Your Research Notebooks
        </p>
      </footer>
    </div>
  )
}
