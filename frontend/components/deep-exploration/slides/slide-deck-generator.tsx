"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  Loader2,
  Presentation,
  Download,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Globe,
  Lock,
  Check,
  Sparkles,
  FileText,
  Image,
  FileCheck,
  Plus,
  User,
} from "lucide-react"
import {
  generateSlideDeck,
  updateSlideSharing,
  getUserSlides,
  type GeneratedSlides,
  type UserSlide,
} from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

// ============================================================================
// Types
// ============================================================================

type SlideStyle = "presenter" | "detailed"

interface SlideStyleOption {
  id: SlideStyle
  label: string
  description: string
  slideCount: string
  icon: React.ReactNode
}

interface GenerationStage {
  id: string
  label: string
  icon: React.ReactNode
}

interface SlideDeckGeneratorProps {
  claimId: string
  episodeId: string
  onGenerated?: (slides: GeneratedSlides) => void
  onShare?: (slides: GeneratedSlides) => void
}

// ============================================================================
// Constants
// ============================================================================

const STYLE_OPTIONS: SlideStyleOption[] = [
  {
    id: "presenter",
    label: "Presenter",
    description: "Clean visuals with key points for live presentation",
    slideCount: "5–7 slides",
    icon: <Sparkles className="w-4 h-4" />,
  },
  {
    id: "detailed",
    label: "Detailed",
    description: "Comprehensive deck to share without narration",
    slideCount: "8–12 slides",
    icon: <FileText className="w-4 h-4" />,
  },
]

const GENERATION_STAGES: GenerationStage[] = [
  { id: "planning", label: "Planning structure", icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: "content", label: "Generating content", icon: <FileText className="w-3.5 h-3.5" /> },
  { id: "visuals", label: "Creating visuals", icon: <Image className="w-3.5 h-3.5" /> },
  { id: "assembly", label: "Assembling PDF", icon: <FileCheck className="w-3.5 h-3.5" /> },
]

// ============================================================================
// Progress Indicator Component
// ============================================================================

function GenerationProgress({ currentStage }: { currentStage: number }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-3">
        <div className="relative">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--golden-chestnut)]" />
          <div className="absolute inset-0 animate-ping opacity-30">
            <Loader2 className="w-5 h-5 text-[var(--golden-chestnut)]" />
          </div>
        </div>
        <span className="text-sm font-medium text-foreground/80">
          {GENERATION_STAGES[currentStage]?.label || "Generating..."}
        </span>
      </div>

      <div className="flex items-center justify-center gap-1">
        {GENERATION_STAGES.map((stage, idx) => {
          const isComplete = idx < currentStage
          const isCurrent = idx === currentStage
          const isPending = idx > currentStage

          return (
            <div key={stage.id} className="flex items-center">
              <div
                className={`
                  flex items-center justify-center w-7 h-7 rounded-full transition-all duration-500
                  ${isComplete ? "bg-[var(--golden-chestnut)] text-white scale-90" : ""}
                  ${isCurrent ? "bg-[var(--golden-chestnut)]/20 text-[var(--golden-chestnut)] ring-2 ring-[var(--golden-chestnut)]/40 ring-offset-2 ring-offset-card" : ""}
                  ${isPending ? "bg-foreground/5 text-foreground/30" : ""}
                `}
              >
                {isComplete ? <Check className="w-3.5 h-3.5" /> : stage.icon}
              </div>
              {idx < GENERATION_STAGES.length - 1 && (
                <div
                  className={`
                    w-6 h-0.5 mx-1 transition-all duration-500
                    ${isComplete ? "bg-[var(--golden-chestnut)]" : "bg-foreground/10"}
                  `}
                />
              )}
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-foreground/40">This may take a few minutes</p>
    </div>
  )
}

// ============================================================================
// Thumbnail Carousel Component
// ============================================================================

function ThumbnailCarousel({
  thumbnails,
  onSelect,
}: {
  thumbnails: string[]
  onSelect: (index: number) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    setCanScrollLeft(scrollLeft > 0)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
  }, [])

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    el?.addEventListener("scroll", checkScroll)
    window.addEventListener("resize", checkScroll)
    return () => {
      el?.removeEventListener("scroll", checkScroll)
      window.removeEventListener("resize", checkScroll)
    }
  }, [checkScroll, thumbnails])

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return
    const scrollAmount = 200
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    })
  }

  return (
    <div className="relative group">
      {canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-card/95 border border-border shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-card"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-card/95 border border-border shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-card"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 snap-x snap-mandatory"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {thumbnails.map((url, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(idx)}
            className="flex-shrink-0 snap-start group/thumb relative"
          >
            <img
              src={url}
              alt={`Slide ${idx + 1}`}
              className="h-28 w-auto rounded border border-border shadow-sm transition-all duration-200 group-hover/thumb:border-[var(--golden-chestnut)]/50 group-hover/thumb:shadow-md group-hover/thumb:scale-[1.02]"
            />
            <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/10 transition-colors rounded flex items-center justify-center">
              <span className="opacity-0 group-hover/thumb:opacity-100 transition-opacity text-xs font-medium text-white bg-black/50 px-2 py-1 rounded">
                View
              </span>
            </div>
            <span className="absolute bottom-1 left-1 text-[10px] font-medium bg-card/90 px-1.5 py-0.5 rounded text-foreground/60">
              {idx + 1}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Lightbox Component
// ============================================================================

function SlideLightbox({
  thumbnails,
  currentIndex,
  onClose,
  onNavigate,
}: {
  thumbnails: string[]
  currentIndex: number
  onClose: () => void
  onNavigate: (index: number) => void
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft" && currentIndex > 0) onNavigate(currentIndex - 1)
      if (e.key === "ArrowRight" && currentIndex < thumbnails.length - 1) onNavigate(currentIndex + 1)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentIndex, thumbnails.length, onClose, onNavigate])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center animate-in fade-in duration-200"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white/60 hover:text-white transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      {currentIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onNavigate(currentIndex - 1)
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
      )}
      {currentIndex < thumbnails.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onNavigate(currentIndex + 1)
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
        >
          <ChevronRight className="w-6 h-6 text-white" />
        </button>
      )}

      <div
        className="max-w-[90vw] max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={thumbnails[currentIndex]}
          alt={`Slide ${currentIndex + 1}`}
          className="max-w-full max-h-[85vh] rounded-lg shadow-2xl"
        />
        <div className="text-center mt-4 text-white/60 text-sm">
          Slide {currentIndex + 1} of {thumbnails.length}
          <span className="ml-4 text-white/40">← → to navigate · Esc to close</span>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Single Slide Deck Display Component
// ============================================================================

function SlideDeckDisplay({
  slide,
  style,
  isRegenerating,
  onRegenerate,
  onToggleShare,
  isUpdatingShare,
  onViewSlide,
}: {
  slide: UserSlide
  style: SlideStyle
  isRegenerating: boolean
  onRegenerate: () => void
  onToggleShare: () => void
  isUpdatingShare: boolean
  onViewSlide: (index: number) => void
}) {
  const styleOption = STYLE_OPTIONS.find((o) => o.id === style)!

  return (
    <div className="space-y-3 p-4 bg-foreground/3 rounded-sm border border-border/50">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[var(--golden-chestnut)]/15 flex items-center justify-center text-[var(--golden-chestnut)]">
            {styleOption.icon}
          </div>
          <span className="font-medium text-sm">{styleOption.label}</span>
          <span className="text-xs text-foreground/40">· {slide.slide_count} slides</span>
        </div>
        <div className="flex items-center gap-1">
          {slide.is_public ? (
            <Globe className="w-3.5 h-3.5 text-[var(--golden-chestnut)]" />
          ) : (
            <Lock className="w-3.5 h-3.5 text-foreground/30" />
          )}
        </div>
      </div>

      {/* Thumbnails */}
      <ThumbnailCarousel thumbnails={slide.thumbnail_urls} onSelect={onViewSlide} />

      {/* Actions */}
      <div className="flex gap-2">
        <a
          href={slide.pdf_url}
          download
          className="flex-1 py-2 px-3 bg-[var(--golden-chestnut)] text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-[var(--golden-chestnut)]/90 transition-all rounded-sm"
        >
          <Download className="w-3.5 h-3.5" />
          Download
        </a>
        <button
          onClick={onToggleShare}
          disabled={isUpdatingShare}
          className={`
            py-2 px-3 text-sm flex items-center gap-2 transition-colors rounded-sm border
            ${slide.is_public
              ? "border-[var(--golden-chestnut)]/30 text-[var(--golden-chestnut)] hover:bg-[var(--golden-chestnut)]/10"
              : "border-border text-foreground/60 hover:bg-foreground/5"
            }
          `}
        >
          {slide.is_public ? <Lock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
          {slide.is_public ? "Unshare" : "Share"}
        </button>
        <button
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="py-2 px-3 border border-border text-foreground/50 flex items-center hover:bg-foreground/5 transition-colors rounded-sm disabled:opacity-50"
          title="Regenerate"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// Create New Style Card Component
// ============================================================================

function CreateStyleCard({
  style,
  onSelect,
  disabled,
}: {
  style: SlideStyle
  onSelect: () => void
  disabled: boolean
}) {
  const styleOption = STYLE_OPTIONS.find((o) => o.id === style)!

  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={`
        w-full p-4 text-left border border-dashed rounded-sm transition-all
        ${disabled
          ? "opacity-50 cursor-not-allowed border-border/50"
          : "border-border hover:border-[var(--golden-chestnut)]/50 hover:bg-[var(--golden-chestnut)]/5"
        }
      `}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center text-foreground/40">
          <Plus className="w-5 h-5" />
        </div>
        <div>
          <div className="font-medium text-sm">Create {styleOption.label} Deck</div>
          <div className="text-xs text-foreground/50">{styleOption.slideCount}</div>
        </div>
      </div>
    </button>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function SlideDeckGenerator({
  claimId,
  episodeId,
  onGenerated,
}: SlideDeckGeneratorProps) {
  const { user } = useAuth()

  // Loading state
  const [isLoadingExisting, setIsLoadingExisting] = useState(true)

  // Existing slides (keyed by style)
  const [existingSlides, setExistingSlides] = useState<Record<string, UserSlide>>({})

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatingStyle, setGeneratingStyle] = useState<SlideStyle | null>(null)
  const [generationStage, setGenerationStage] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Style selection (only used when no slides exist)
  const [selectedStyle, setSelectedStyle] = useState<SlideStyle | null>(null)

  // Lightbox state
  const [lightboxData, setLightboxData] = useState<{ thumbnails: string[]; index: number } | null>(null)

  // Share update state
  const [updatingShareFor, setUpdatingShareFor] = useState<string | null>(null)

  // Display name prompt state (for community sharing)
  const [showDisplayNamePrompt, setShowDisplayNamePrompt] = useState(false)
  const [displayNameInput, setDisplayNameInput] = useState("")
  const [currentDisplayName, setCurrentDisplayName] = useState<string | null>(null)
  const [pendingShareStyle, setPendingShareStyle] = useState<SlideStyle | null>(null)
  const [isSavingDisplayName, setIsSavingDisplayName] = useState(false)

  // LocalStorage key for anonymous slide storage
  const localStorageKey = `slides_${claimId}`

  // Fetch user's display name (to check if it's the default)
  useEffect(() => {
    async function fetchDisplayName() {
      if (!user?.id || !supabase) return

      const { data, error } = await supabase
        .from("user_profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle()

      if (!error && data?.display_name) {
        setCurrentDisplayName(data.display_name)
      }
    }
    fetchDisplayName()
  }, [user?.id])

  // Fetch existing slides on mount
  useEffect(() => {
    console.log("[SlideDeckGenerator] Mount effect - user:", user?.id, "claimId:", claimId)

    // If user is logged in, fetch from database
    if (user?.id) {
      async function fetchExisting() {
        console.log("[SlideDeckGenerator] Fetching existing slides for", claimId, user!.id)
        try {
          const result = await getUserSlides(claimId, user!.id)
          console.log("[SlideDeckGenerator] Fetch result:", result)
          if (result.slides) {
            setExistingSlides(result.slides)
          }
        } catch (err) {
          console.error("[SlideDeckGenerator] Failed to fetch existing slides:", err)
        } finally {
          setIsLoadingExisting(false)
        }
      }
      fetchExisting()
    } else {
      // No user - check localStorage for anonymous slides
      console.log("[SlideDeckGenerator] No user, checking localStorage")
      try {
        const stored = localStorage.getItem(localStorageKey)
        if (stored) {
          const parsed = JSON.parse(stored)
          console.log("[SlideDeckGenerator] Found localStorage slides:", parsed)
          setExistingSlides(parsed)
        }
      } catch (err) {
        console.error("[SlideDeckGenerator] Failed to load from localStorage:", err)
      }
      setIsLoadingExisting(false)
    }
  }, [claimId, user?.id, localStorageKey])

  // Simulate progress stages during generation
  useEffect(() => {
    if (!isGenerating) {
      setGenerationStage(0)
      return
    }

    const stageDurations = [3000, 8000, 25000, 5000]
    let elapsed = 0
    const timeouts: NodeJS.Timeout[] = []

    stageDurations.forEach((duration, idx) => {
      const timeout = setTimeout(() => {
        if (idx < GENERATION_STAGES.length - 1) {
          setGenerationStage(idx + 1)
        }
      }, elapsed + duration)
      timeouts.push(timeout)
      elapsed += duration
    })

    return () => timeouts.forEach(clearTimeout)
  }, [isGenerating])

  const handleGenerate = async (style: SlideStyle, forceRegenerate = false) => {
    setIsGenerating(true)
    setGeneratingStyle(style)
    setError(null)
    setGenerationStage(0)

    try {
      // Pass user.id if logged in, undefined otherwise
      const result = await generateSlideDeck(claimId, episodeId, style, user?.id, forceRegenerate)

      if (result.error) {
        setError(result.error)
      } else {
        // Update existing slides with the new one
        const newSlide: UserSlide = {
          id: result.pdf_url, // Use pdf_url as ID for now
          style,
          slide_count: result.slide_count,
          pdf_url: result.pdf_url,
          thumbnail_urls: result.thumbnail_urls,
          slide_specs: result.slide_specs,
          is_public: false,
          created_at: result.generated_at,
        }
        const updatedSlides = { ...existingSlides, [style]: newSlide }
        setExistingSlides(updatedSlides)
        setSelectedStyle(null)
        onGenerated?.(result)

        // If no user, save to localStorage for persistence
        if (!user?.id) {
          try {
            localStorage.setItem(localStorageKey, JSON.stringify(updatedSlides))
            console.log("[SlideDeckGenerator] Saved to localStorage:", updatedSlides)
          } catch (err) {
            console.error("[SlideDeckGenerator] Failed to save to localStorage:", err)
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate slides")
    } finally {
      setIsGenerating(false)
      setGeneratingStyle(null)
    }
  }

  // Check if display name is the auto-generated default (email username)
  const isDefaultDisplayName = useCallback(() => {
    if (!user?.email || !currentDisplayName) return true
    const emailUsername = user.email.split("@")[0]
    return currentDisplayName === emailUsername || currentDisplayName === user.user_metadata?.name
  }, [user?.email, user?.user_metadata?.name, currentDisplayName])

  // Save display name and continue with sharing
  const handleSaveDisplayNameAndShare = async () => {
    if (!user?.id || !supabase || !displayNameInput.trim() || !pendingShareStyle) return

    setIsSavingDisplayName(true)
    try {
      const { error } = await supabase
        .from("user_profiles")
        .upsert({
          id: user.id,
          display_name: displayNameInput.trim(),
          updated_at: new Date().toISOString(),
        })

      if (error) {
        toast.error("Failed to save display name")
        return
      }

      setCurrentDisplayName(displayNameInput.trim())
      setShowDisplayNamePrompt(false)
      setDisplayNameInput("")
      toast.success("Display name saved")

      // Continue with the share action
      await performShare(pendingShareStyle)
    } catch (err) {
      console.error("Failed to save display name:", err)
      toast.error("Failed to save display name")
    } finally {
      setIsSavingDisplayName(false)
      setPendingShareStyle(null)
    }
  }

  // Perform the actual share action
  const performShare = async (style: SlideStyle) => {
    const slide = existingSlides[style]
    if (!user?.id || !slide) return

    setUpdatingShareFor(style)
    try {
      const result = await updateSlideSharing(slide.id, !slide.is_public, user.id)
      if (result.success) {
        setExistingSlides((prev) => ({
          ...prev,
          [style]: { ...prev[style], is_public: !prev[style].is_public },
        }))
        if (!existingSlides[style].is_public) {
          toast.success("Slides shared to community")
        }
      }
    } catch (err) {
      console.error("Failed to update sharing:", err)
      toast.error("Failed to update sharing")
    } finally {
      setUpdatingShareFor(null)
    }
  }

  const handleToggleShare = async (style: SlideStyle) => {
    const slide = existingSlides[style]
    if (!user?.id || !slide) return

    // If unsharing, no need to check display name
    if (slide.is_public) {
      await performShare(style)
      return
    }

    // If sharing and display name is default, show prompt
    if (isDefaultDisplayName()) {
      setPendingShareStyle(style)
      setShowDisplayNamePrompt(true)
      return
    }

    // Display name is set, proceed with sharing
    await performShare(style)
  }

  const openLightbox = (style: SlideStyle, index: number) => {
    const slide = existingSlides[style]
    if (slide) {
      setLightboxData({ thumbnails: slide.thumbnail_urls, index })
    }
  }

  // Derived state
  const hasPresenter = !!existingSlides.presenter
  const hasDetailed = !!existingSlides.detailed
  const hasAnySlides = hasPresenter || hasDetailed
  const missingStyles = STYLE_OPTIONS.filter((o) => !existingSlides[o.id]).map((o) => o.id)

  // Loading state
  if (isLoadingExisting) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Presentation className="w-5 h-5 text-[var(--golden-chestnut)]" />
          <h4 className="font-bold text-lg font-serif">Slide Deck</h4>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-foreground/40" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Presentation className="w-5 h-5 text-[var(--golden-chestnut)]" />
        <h4 className="font-bold text-lg font-serif">Slide Deck</h4>
      </div>

      {!hasAnySlides && !isGenerating && (
        <p className="text-foreground/60 text-sm leading-relaxed">
          Generate a presentation explaining this claim and its supporting evidence.
        </p>
      )}

      {/* Generation in progress */}
      {isGenerating && (
        <div className="py-6">
          <GenerationProgress currentStage={generationStage} />
          <p className="text-center text-xs text-foreground/50 mt-2">
            Creating {generatingStyle} deck...
          </p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-sm">
          <div className="flex items-start justify-between gap-3">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-400/70 hover:text-red-400 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Display Name Prompt (for community sharing) */}
      {showDisplayNamePrompt && (
        <div className="p-4 bg-[var(--golden-chestnut)]/10 border border-[var(--golden-chestnut)]/30 rounded-sm space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--golden-chestnut)]/20 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-[var(--golden-chestnut)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Set a display name to share with the community</p>
              <p className="text-xs text-foreground/60 mt-1">
                Your name will be shown on shared slides.
              </p>
            </div>
            <button
              onClick={() => {
                setShowDisplayNamePrompt(false)
                setPendingShareStyle(null)
                setDisplayNameInput("")
              }}
              className="text-foreground/40 hover:text-foreground/60 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={displayNameInput}
              onChange={(e) => setDisplayNameInput(e.target.value)}
              placeholder="Your display name"
              className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-sm focus:outline-none focus:ring-2 focus:ring-[var(--golden-chestnut)]/30 focus:border-[var(--golden-chestnut)]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && displayNameInput.trim()) {
                  handleSaveDisplayNameAndShare()
                }
              }}
              disabled={isSavingDisplayName}
            />
            <button
              onClick={handleSaveDisplayNameAndShare}
              disabled={!displayNameInput.trim() || isSavingDisplayName}
              className="px-4 py-2 bg-[var(--golden-chestnut)] text-white text-sm font-medium rounded-sm hover:bg-[var(--golden-chestnut)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSavingDisplayName ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving
                </>
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5" />
                  Save & Share
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* No slides yet - show style selector */}
      {!hasAnySlides && !isGenerating && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {STYLE_OPTIONS.map((option) => {
              const isSelected = selectedStyle === option.id
              return (
                <button
                  key={option.id}
                  onClick={() => setSelectedStyle(option.id)}
                  className={`
                    relative p-4 text-left transition-all duration-200 group border rounded-sm
                    ${isSelected
                      ? "border-[var(--golden-chestnut)] bg-[var(--golden-chestnut)]/8"
                      : "border-border hover:border-foreground/30 hover:bg-foreground/3"
                    }
                  `}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-[var(--golden-chestnut)] rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div className="font-medium mb-1">{option.label}</div>
                  <div className="text-xs text-foreground/50 mb-2 leading-relaxed">
                    {option.description}
                  </div>
                  <div
                    className={`
                      text-[11px] font-medium uppercase tracking-wide
                      ${isSelected ? "text-[var(--golden-chestnut)]" : "text-foreground/40"}
                    `}
                  >
                    {option.slideCount}
                  </div>
                </button>
              )
            })}
          </div>

          <button
            onClick={() => selectedStyle && handleGenerate(selectedStyle)}
            disabled={!selectedStyle}
            className={`
              w-full py-3 font-medium transition-all duration-200 flex items-center justify-center gap-2 rounded-sm
              ${selectedStyle
                ? "bg-[var(--golden-chestnut)] text-white hover:bg-[var(--golden-chestnut)]/90 shadow-sm hover:shadow"
                : "bg-foreground/8 text-foreground/35 cursor-not-allowed"
              }
            `}
          >
            <Sparkles className="w-4 h-4" />
            Generate Slides
          </button>
        </>
      )}

      {/* Existing slides */}
      {hasAnySlides && !isGenerating && (
        <div className="space-y-4">
          {/* Show existing presenter deck */}
          {hasPresenter && (
            <SlideDeckDisplay
              slide={existingSlides.presenter}
              style="presenter"
              isRegenerating={generatingStyle === "presenter"}
              onRegenerate={() => handleGenerate("presenter", true)}
              onToggleShare={() => handleToggleShare("presenter")}
              isUpdatingShare={updatingShareFor === "presenter"}
              onViewSlide={(idx) => openLightbox("presenter", idx)}
            />
          )}

          {/* Show existing detailed deck */}
          {hasDetailed && (
            <SlideDeckDisplay
              slide={existingSlides.detailed}
              style="detailed"
              isRegenerating={generatingStyle === "detailed"}
              onRegenerate={() => handleGenerate("detailed", true)}
              onToggleShare={() => handleToggleShare("detailed")}
              isUpdatingShare={updatingShareFor === "detailed"}
              onViewSlide={(idx) => openLightbox("detailed", idx)}
            />
          )}

          {/* Option to create the other style */}
          {missingStyles.length > 0 && (
            <div className="pt-2">
              {missingStyles.map((style) => (
                <CreateStyleCard
                  key={style}
                  style={style}
                  onSelect={() => handleGenerate(style)}
                  disabled={isGenerating}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightboxData && (
        <SlideLightbox
          thumbnails={lightboxData.thumbnails}
          currentIndex={lightboxData.index}
          onClose={() => setLightboxData(null)}
          onNavigate={(idx) => setLightboxData((prev) => prev && { ...prev, index: idx })}
        />
      )}
    </div>
  )
}
