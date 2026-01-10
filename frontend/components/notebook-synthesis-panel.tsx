"use client"

import { useEffect, useState, useCallback } from "react"
import { Sparkles, RefreshCw, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { callMcpTool } from "@/lib/api"
import {
  getNotebookSynthesis,
  saveNotebookSynthesis,
  type NotebookSynthesis,
  type NotebookSynthesisTheme,
  type BookmarkWithDetails,
} from "@/lib/supabase"

interface NotebookSynthesisPanelProps {
  episodeId: string
  bookmarks: BookmarkWithDetails[]
}

interface SynthesisResponse {
  synthesis: string
  themes: NotebookSynthesisTheme[]
  model: string
  error?: string
}

export function NotebookSynthesisPanel({
  episodeId,
  bookmarks,
}: NotebookSynthesisPanelProps) {
  const [synthesis, setSynthesis] = useState<NotebookSynthesis | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load existing synthesis from cache
  useEffect(() => {
    const loadSynthesis = async () => {
      setIsLoading(true)
      try {
        const cached = await getNotebookSynthesis(episodeId)
        setSynthesis(cached)
      } catch (err) {
        console.error("Failed to load synthesis:", err)
      } finally {
        setIsLoading(false)
      }
    }

    loadSynthesis()
  }, [episodeId])

  const generateSynthesis = useCallback(
    async (forceRegenerate = false) => {
      if (bookmarks.length === 0) {
        setError("No items to synthesize")
        return
      }

      setIsGenerating(true)
      setError(null)

      try {
        // Call the backend synthesis endpoint
        const response = await callMcpTool<SynthesisResponse>(
          "generate_notebook_synthesis",
          {
            episode_id: episodeId,
            force_regenerate: forceRegenerate,
            bookmarks: bookmarks.map((b) => ({
              type: b.bookmark_type,
              title: b.title,
              content: b.context_preview || b.snippet_text || "",
              timestamp: b.start_ms,
            })),
          }
        )

        if (response.error) {
          setError(response.error)
          return
        }

        // Save to cache
        const saved = await saveNotebookSynthesis(episodeId, {
          synthesis_text: response.synthesis,
          themes: response.themes,
          bookmark_count_at_generation: bookmarks.length,
          model_used: response.model || "gemini-3-pro-preview",
        })

        setSynthesis(saved)
      } catch (err) {
        console.error("Failed to generate synthesis:", err)
        setError(err instanceof Error ? err.message : "Failed to generate synthesis")
      } finally {
        setIsGenerating(false)
      }
    },
    [episodeId, bookmarks]
  )

  // Check if synthesis is stale
  const isStale =
    synthesis?.is_stale ||
    (synthesis && synthesis.bookmark_count_at_generation !== bookmarks.length)

  return (
    <div className="border border-border p-6 bg-card/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground/70 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--golden-chestnut)]" />
          AI Synthesis
        </h3>
        {synthesis && (
          <div className="flex items-center gap-2">
            {isStale && (
              <span className="text-xs text-amber-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Outdated
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => generateSynthesis(true)}
              disabled={isGenerating}
              className="!rounded-none text-xs"
            >
              <RefreshCw
                className={`w-3 h-3 mr-1 ${isGenerating ? "animate-spin" : ""}`}
              />
              Regenerate
            </Button>
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-foreground/30 animate-spin" />
        </div>
      )}

      {/* No Synthesis - Generate Prompt */}
      {!isLoading && !synthesis && !isGenerating && (
        <div className="text-center py-6">
          <p className="text-foreground/50 text-sm mb-4">
            {bookmarks.length === 0
              ? "Save some items to generate an AI synthesis"
              : "Generate an AI-powered overview of your saved research"}
          </p>
          {bookmarks.length > 0 && (
            <Button
              onClick={() => generateSynthesis(false)}
              className="!rounded-none !bg-[var(--golden-chestnut)] !text-background"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Synthesis
            </Button>
          )}
        </div>
      )}

      {/* Generating State */}
      {isGenerating && (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <Loader2 className="w-6 h-6 text-[var(--golden-chestnut)] animate-spin" />
          <p className="text-foreground/50 text-sm">
            Analyzing {bookmarks.length} items...
          </p>
        </div>
      )}

      {/* Error State */}
      {error && !isGenerating && (
        <div className="p-4 border border-red-500/30 bg-red-500/10 text-red-400 text-sm mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4" />
            <span className="font-medium">Generation failed</span>
          </div>
          <p className="text-red-400/80">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateSynthesis(true)}
            className="!rounded-none mt-3"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Synthesis Content */}
      {!isLoading && synthesis && !isGenerating && (
        <div className="space-y-4">
          {/* Main Synthesis Text */}
          <div className="p-4 bg-background/50 border-l-2 border-[var(--golden-chestnut)]/50">
            <p className="text-foreground/80 text-base leading-relaxed italic">
              "{synthesis.synthesis_text}"
            </p>
          </div>

          {/* Themes */}
          {synthesis.themes && synthesis.themes.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-medium text-foreground/50 uppercase tracking-wider mb-3">
                Identified Themes
              </h4>
              <div className="flex flex-wrap gap-2">
                {synthesis.themes.map((theme, idx) => (
                  <div
                    key={idx}
                    className="group relative px-3 py-1.5 bg-[var(--golden-chestnut)]/10 text-[var(--golden-chestnut)] text-sm font-medium"
                  >
                    {theme.name}
                    {theme.description && (
                      <div className="absolute bottom-full left-0 mb-2 w-64 p-2 bg-card border border-border text-xs text-foreground/70 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                        {theme.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center justify-between pt-3 border-t border-border/50 text-xs text-foreground/40">
            <span>
              Generated from {synthesis.bookmark_count_at_generation} items
            </span>
            <span>
              {new Date(synthesis.generated_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
