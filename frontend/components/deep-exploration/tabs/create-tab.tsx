"use client"

import { useState } from "react"
import { Mic } from "lucide-react"
import { MiniPodcastPlayer } from "@/components/mini-podcast-player"
import { SlideDeckGenerator, ShareSlideModal } from "../slides"
import type { GeneratePodcastResponse } from "@/lib/chat-types"
import type { GeneratedSlides } from "@/lib/api"

function CornerBrackets({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute -top-px -left-px w-4 h-4 border-l border-t border-[var(--golden-chestnut)]/40" />
      <div className="absolute -top-px -right-px w-4 h-4 border-r border-t border-[var(--golden-chestnut)]/40" />
      <div className="absolute -bottom-px -left-px w-4 h-4 border-l border-b border-[var(--golden-chestnut)]/40" />
      <div className="absolute -bottom-px -right-px w-4 h-4 border-r border-b border-[var(--golden-chestnut)]/40" />
      {children}
    </div>
  )
}

interface CreateTabProps {
  claimId: string
  episodeId: string
  miniPodcast: GeneratePodcastResponse | null
  isLoadingPodcast: boolean
  podcastError: string | null
  onGeneratePodcast: () => void
  onRegeneratePodcast: () => void
  synthesisMode: "simplified" | "technical"
}

export function CreateTab({
  claimId,
  episodeId,
  miniPodcast,
  isLoadingPodcast,
  podcastError,
  onGeneratePodcast,
  onRegeneratePodcast,
  synthesisMode,
}: CreateTabProps) {
  const [generatedSlides, setGeneratedSlides] = useState<GeneratedSlides | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [currentSlideId, setCurrentSlideId] = useState<string | null>(null)

  const handleSlideGenerated = (slides: GeneratedSlides) => {
    setGeneratedSlides(slides)
  }

  const handleShareSlides = (slides: GeneratedSlides) => {
    // Use pdf_url as a temporary ID - in production this would be the DB id
    setCurrentSlideId(slides.pdf_url)
    setShowShareModal(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Mic className="w-6 h-6 text-[var(--golden-chestnut)]" />
        <h3 className="font-bold text-xl">Create with AI</h3>
      </div>

      {/* Mini Podcast - primary creation tool */}
      <CornerBrackets className="bg-card/30 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Mic className="w-5 h-5 text-[var(--golden-chestnut)]" />
          <h4 className="font-bold text-lg">Audio Overview</h4>
        </div>
        <p className="text-foreground/60 text-sm mb-4">
          Generate a mini podcast explaining this claim and its evidence
        </p>
        <MiniPodcastPlayer
          podcast={miniPodcast}
          isLoading={isLoadingPodcast}
          error={podcastError}
          onGenerate={onGeneratePodcast}
          onRegenerate={onRegeneratePodcast}
          style={synthesisMode === "simplified" ? "casual" : "academic"}
        />
      </CornerBrackets>

      {/* Placeholder for future creation options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CornerBrackets className="bg-card/20 p-6 opacity-50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">📝</span>
            <h4 className="font-medium">Study Notes</h4>
          </div>
          <p className="text-foreground/40 text-sm">Coming soon</p>
        </CornerBrackets>

        <CornerBrackets className="bg-card/20 p-6 opacity-50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">❓</span>
            <h4 className="font-medium">Quiz</h4>
          </div>
          <p className="text-foreground/40 text-sm">Coming soon</p>
        </CornerBrackets>

        <CornerBrackets className="bg-card/30 p-6">
          <SlideDeckGenerator
            claimId={claimId}
            episodeId={episodeId}
            onGenerated={handleSlideGenerated}
            onShare={handleShareSlides}
          />
        </CornerBrackets>

        <CornerBrackets className="bg-card/20 p-6 opacity-50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🎯</span>
            <h4 className="font-medium">Flashcards</h4>
          </div>
          <p className="text-foreground/40 text-sm">Coming soon</p>
        </CornerBrackets>
      </div>

      <ShareSlideModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        slideId={currentSlideId || ""}
        isCurrentlyPublic={false}
        onShareUpdated={(isPublic) => {
          console.log("Share updated:", isPublic)
        }}
      />
    </div>
  )
}
