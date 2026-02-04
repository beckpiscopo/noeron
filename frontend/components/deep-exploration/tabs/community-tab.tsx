"use client"

import { useState, useEffect } from "react"
import { Users, Presentation, Mic, FileText, HelpCircle, Download, Loader2 } from "lucide-react"
import { getCommunitySlides, type CommunitySlide } from "@/lib/api"

type AssetType = "all" | "slides" | "audio" | "notes" | "quiz"

const FILTERS: { id: AssetType; label: string; icon: React.ReactNode }[] = [
  { id: "all", label: "All", icon: null },
  { id: "slides", label: "Slides", icon: <Presentation className="w-3 h-3" /> },
  { id: "audio", label: "Audio", icon: <Mic className="w-3 h-3" /> },
  { id: "notes", label: "Notes", icon: <FileText className="w-3 h-3" /> },
  { id: "quiz", label: "Quiz", icon: <HelpCircle className="w-3 h-3" /> },
]

interface CommunityTabProps {
  claimId: string
}

export function CommunityTab({ claimId }: CommunityTabProps) {
  const [filter, setFilter] = useState<AssetType>("all")
  const [slides, setSlides] = useState<CommunitySlide[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCommunityContent = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await getCommunitySlides(claimId)
        setSlides(result.slides || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load community content")
      } finally {
        setIsLoading(false)
      }
    }

    fetchCommunityContent()
  }, [claimId])

  const filteredSlides = filter === "all" || filter === "slides" ? slides : []
  const hasContent = filteredSlides.length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Users className="w-6 h-6 text-[var(--golden-chestnut)]" />
        <h3 className="font-bold text-xl">Community</h3>
      </div>

      <p className="text-foreground/60 text-sm">
        See what others have created for this claim.
      </p>

      {/* Filter Chips */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`
              px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors
              ${filter === f.id
                ? "bg-[var(--golden-chestnut)] text-white"
                : "bg-foreground/10 text-foreground/60 hover:bg-foreground/20"
              }
            `}
          >
            {f.icon}
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-[var(--golden-chestnut)] animate-spin" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Content List */}
      {!isLoading && !error && (
        <div className="space-y-3">
          {filteredSlides.map((slide) => (
            <div
              key={slide.id}
              className="p-4 border border-border bg-card/30 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Presentation className="w-5 h-5 text-[var(--golden-chestnut)]" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Slide Deck</span>
                    <span className="text-xs px-2 py-0.5 bg-foreground/10 rounded">
                      {slide.style}
                    </span>
                  </div>
                  <div className="text-xs text-foreground/50">
                    by @{slide.creator_name} · {new Date(slide.created_at).toLocaleDateString()} · {slide.slide_count} slides
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <a
                  href={slide.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-sm border border-border hover:bg-foreground/5 transition-colors"
                >
                  View
                </a>
                <a
                  href={slide.pdf_url}
                  download
                  className="px-3 py-1.5 text-sm border border-[var(--golden-chestnut)] text-[var(--golden-chestnut)] hover:bg-[var(--golden-chestnut)]/10 transition-colors flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  PDF
                </a>
              </div>
            </div>
          ))}

          {/* Empty State */}
          {!hasContent && (
            <div className="py-12 text-center">
              <Users className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
              <p className="text-foreground/40">
                No community content yet.
              </p>
              <p className="text-foreground/30 text-sm mt-1">
                Create something in the Create tab and share it!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
