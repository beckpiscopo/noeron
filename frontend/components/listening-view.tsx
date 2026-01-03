"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Play, Pause, RotateCcw, RotateCw, Info, Search, Settings, HelpCircle } from "lucide-react"
import { NoeronHeader } from "./noeron-header"

export interface ListeningEpisode {
  id: string
  title: string
  podcast: string
  host: string
  guest: string
  durationSeconds: number
  durationLabel: string
  currentTime: number
  audioUrl?: string
}

export interface WordTiming {
  text: string
  start_ms: number
  end_ms: number
  confidence?: number
  speaker?: string
}

export interface ClaimTiming {
  start_ms: number
  end_ms: number
  match_confidence: number
  fallback?: boolean
  word_count?: number
  words?: WordTiming[]
  note?: string
}

export interface Claim {
  id: string | number
  timestamp: number
  // New fields from Supabase
  segment_claim_id?: string  // Format: "segment_key-index" (e.g., "lex_325|00:00:00.160|1-0")
  claim_text?: string
  distilled_claim?: string
  distilled_word_count?: number
  paper_title?: string
  paper_url?: string
  confidence_score?: number
  start_ms?: number
  end_ms?: number
  // Legacy fields (for backward compatibility)
  category?: string
  title?: string
  description?: string
  source?: string
  status?: "past" | "current" | "future"
  timing?: ClaimTiming | null
}

interface ListeningViewProps {
  episode: ListeningEpisode
  claims: Claim[]
  onDiveDeeper: (claimId: string | number) => void
  onViewSource: (claimId: string | number) => void
  onAskQuestion: (question: string) => void
  onTimeUpdate: (time: number) => void
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

// Helper to get display text from claim (prioritizes distilled_claim)
function getClaimDisplayText(claim: Claim): string {
  return claim.distilled_claim || claim.title || claim.claim_text || "Unknown claim"
}

// Helper to get full text from claim
function getClaimFullText(claim: Claim): string {
  return claim.claim_text || claim.description || ""
}

// Helper to format timestamp
function formatTimestamp(claim: Claim): string {
  // Always use start_ms for precise timing (milliseconds)
  if (claim.start_ms) {
    return formatTime(claim.start_ms / 1000)
  }
  // Fallback to timestamp field (in seconds)
  if (claim.timestamp) {
    return formatTime(claim.timestamp)
  }
  return "00:00"
}

interface CurrentClaimCardProps {
  claim: Claim
  currentTimeMs: number
  onDiveDeeper: (id: string | number) => void
  onViewSource: (id: string | number) => void
}

function CurrentClaimCard({ claim, currentTimeMs, onDiveDeeper, onViewSource }: CurrentClaimCardProps) {
  const hasWordTiming = claim.timing?.words && claim.timing.words.length > 0
  const hasDistilledClaim = !!claim.distilled_claim
  const displayText = getClaimDisplayText(claim)
  const fullText = getClaimFullText(claim)
  const timestamp = formatTimestamp(claim)
  
  // Function to render text with word-level highlighting
  const renderWithWordHighlighting = (text: string, words: WordTiming[]) => {
    return (
      <span>
        {words.map((word, idx) => {
          const isHighlighted = currentTimeMs >= word.start_ms && currentTimeMs <= word.end_ms

          return (
            <span
              key={idx}
              className={`transition-colors duration-200 text-[var(--parchment)] ${
                isHighlighted ? 'font-semibold text-[var(--golden-chestnut)]' : ''
              }`}
            >
              {word.text}{' '}
            </span>
          )
        })}
      </span>
    )
  }
  
  return (
    <div className="mb-8">
      <div className="bg-[var(--dark-gray)] rounded-none p-8 shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-200 relative hover:shadow-[0_8px_24px_rgba(0,0,0,0.15)] hover:-translate-y-1 border border-[var(--parchment)]/10">
        {/* Top row: Claim type left, Timestamp right */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--golden-chestnut)] uppercase tracking-wider">
              {claim.category || 'Scientific Claim'}
            </span>
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--golden-chestnut)] opacity-75"></span>
              <span className="relative inline-flex size-2 rounded-full bg-[var(--golden-chestnut)]"></span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--parchment)]/40 mono">
            <span>{timestamp}</span>
          </div>
        </div>

        {/* Main distilled claim text - large and prominent */}
        <h3 className="display text-2xl font-normal mb-6 leading-relaxed text-[var(--parchment)]">
          {hasWordTiming && claim.timing?.words ?
            renderWithWordHighlighting(displayText, claim.timing.words) :
            <span className="transition-colors duration-500">{displayText}</span>
          }
        </h3>

        {/* Full transcript quote - always visible */}
        {hasDistilledClaim && fullText && (
          <p className="text-base text-[var(--parchment)]/60 leading-relaxed mb-4">
            "{fullText}"
          </p>
        )}

        {/* Confidence score and Dive Deeper button */}
        <div className="flex items-center justify-between">
          {claim.confidence_score !== undefined && (
            <div className="flex items-center gap-2 group relative">
              <span className="text-xs text-[var(--parchment)]/50 uppercase tracking-wider">Confidence:</span>
              <span className="text-xs font-bold text-[var(--golden-chestnut)] mono">
                {Math.round(claim.confidence_score * 100)}%
              </span>
              <Info className="w-3 h-3 text-[var(--parchment)]/30 hover:text-[var(--parchment)]/60 cursor-help" />
              {/* Tooltip */}
              <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-64 p-3 bg-[var(--carbon-black)] border border-[var(--parchment)]/20 text-xs text-[var(--parchment)]/70 leading-relaxed z-50">
                <p className="font-semibold text-[var(--parchment)] mb-1">How is this calculated?</p>
                <p>The confidence score indicates how strongly this claim needs scientific backing. Higher scores mean the claim is more extraordinary or counter-intuitive and benefits more from evidence.</p>
              </div>
            </div>
          )}
          <Button
            onClick={() => onDiveDeeper(claim.id)}
            className="!rounded-none !bg-transparent !border !border-[#BE7C4D] !text-[#BE7C4D] hover:!bg-[#BE7C4D]/10 ml-auto"
          >
            Dive Deeper
          </Button>
        </div>
      </div>
    </div>
  )
}

interface PastClaimCardProps {
  claim: Claim
  relativeTime: string
  isSelected: boolean
  onSelect: () => void
  onDiveDeeper: (id: string | number) => void
  onViewSource: (id: string | number) => void
}

function PastClaimCard({ claim, relativeTime, isSelected, onSelect, onDiveDeeper, onViewSource }: PastClaimCardProps) {
  const hasDistilledClaim = !!claim.distilled_claim
  const displayText = getClaimDisplayText(claim)
  const fullText = getClaimFullText(claim)
  const timestamp = formatTimestamp(claim)

  return (
    <div>
      <div
        onClick={onSelect}
        className={`bg-[var(--dark-gray)] rounded-none p-6 cursor-pointer transition-all duration-200 border border-[var(--parchment)]/10 ${
          isSelected
            ? "shadow-[0_8px_30px_rgba(190,124,77,0.15)] -translate-y-1 border-[var(--golden-chestnut)]/30"
            : "shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.15)] hover:-translate-y-1"
        }`}
      >
        {/* Top row: Claim type left, Timestamp right */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-[var(--parchment)]/50 uppercase tracking-wider">
            {claim.category || 'Scientific Claim'}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-[var(--parchment)]/40 mono">
            <span>{timestamp}</span>
            <span className="text-[var(--parchment)]/30">•</span>
            <span>{relativeTime}</span>
          </div>
        </div>

        {/* Distilled claim or title - primary */}
        <h3 className="text-lg font-bold text-[var(--parchment)] mb-4 leading-snug">
          {displayText}
        </h3>

        {/* Full quote - always visible */}
        {hasDistilledClaim && fullText && (
          <p className="text-sm text-[var(--parchment)]/60 leading-relaxed mb-4">
            "{fullText}"
          </p>
        )}

        {/* Confidence score and Dive Deeper button */}
        <div className="flex items-center justify-between">
          {claim.confidence_score !== undefined && (
            <div className="flex items-center gap-2 group relative">
              <span className="text-xs text-[var(--parchment)]/50 uppercase tracking-wider">Confidence:</span>
              <span className="text-xs font-bold text-[var(--golden-chestnut)] mono">
                {Math.round(claim.confidence_score * 100)}%
              </span>
              <Info className="w-3 h-3 text-[var(--parchment)]/30 hover:text-[var(--parchment)]/60 cursor-help" />
              {/* Tooltip */}
              <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-64 p-3 bg-[var(--carbon-black)] border border-[var(--parchment)]/20 text-xs text-[var(--parchment)]/70 leading-relaxed z-50">
                <p className="font-semibold text-[var(--parchment)] mb-1">How is this calculated?</p>
                <p>The confidence score indicates how strongly this claim needs scientific backing. Higher scores mean the claim is more extraordinary or counter-intuitive and benefits more from evidence.</p>
              </div>
            </div>
          )}
          {isSelected && (
            <Button
              onClick={(e) => {
                e.stopPropagation()
                onDiveDeeper(claim.id)
              }}
              size="sm"
              className="!rounded-none !bg-transparent !border !border-[#BE7C4D] !text-[#BE7C4D] hover:!bg-[#BE7C4D]/10 ml-auto"
            >
              Dive Deeper
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export function ListeningView({
  episode,
  claims,
  onDiveDeeper,
  onViewSource,
  onAskQuestion,
  onTimeUpdate,
}: ListeningViewProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [question, setQuestion] = useState("")
  const [selectedClaimId, setSelectedClaimId] = useState<string | number | null>(null)
  const [isAudioReady, setIsAudioReady] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentClaimRef = useRef<HTMLDivElement | null>(null)
  const iconButtonClasses =
    "flex h-9 w-9 items-center justify-center rounded-full text-[var(--parchment)]/70 transition hover:text-[var(--parchment)]"
  const headerActions = (
    <>
      <button className={iconButtonClasses}>
        <Search className="h-4 w-4" />
      </button>
      <button className={iconButtonClasses}>
        <Settings className="h-4 w-4" />
      </button>
      <button className={iconButtonClasses}>
        <HelpCircle className="h-4 w-4" />
      </button>
    </>
  )
  
  // Audio offset correction (in milliseconds)
  // Audio offset in milliseconds - adjust this value to sync claims with audio
  // This can vary per podcast if audio files have different intro/edits
  // Positive: claims appear EARLIER (subtract from current time)
  // Negative: claims appear LATER (add to current time)
  // 
  // TO CALIBRATE:
  // 1. Note a claim's text and its timestamp (e.g., "Xenobots..." at 8:00 = 480s)
  // 2. Play the podcast and note when you actually hear it (e.g., 9:17 = 557s)
  // 3. Calculate: offset_ms = -(actual_time - transcript_time) * 1000
  //    Example: -(557 - 480) * 1000 = -77000
  const AUDIO_OFFSET_MS = 0 // Adjust based on manual testing
  
  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const handleSkipBack = () => {
    const audio = audioRef.current
    if (audio) {
      audio.currentTime = Math.max(0, audio.currentTime - 15)
      onTimeUpdate(audio.currentTime)
    }
  }

  const handleSkipForward = () => {
    const audio = audioRef.current
    if (audio) {
      audio.currentTime = Math.min(episode.durationSeconds, audio.currentTime + 15)
      onTimeUpdate(audio.currentTime)
    }
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    const newTime = percentage * episode.durationSeconds
    const audio = audioRef.current
    if (audio) {
      audio.currentTime = newTime
    }
    onTimeUpdate(newTime)
  }

  const handleSendQuestion = () => {
    if (question.trim()) {
      onAskQuestion(question)
      setQuestion("")
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendQuestion()
    }
  }

  const safeDuration = Math.max(episode.durationSeconds, 1)
  const progressPercentage = Math.min(100, Math.max(0, (episode.currentTime / safeDuration) * 100))

  // Filter out claims with invalid timestamps (0:00 or missing)
  const validClaims = claims.filter(claim => {
    const claimStartMs = claim.start_ms ?? 0
    return claimStartMs > 0 // Must have a valid start time
  })
  
  // Sort claims by start time
  const sortedClaims = [...validClaims].sort((a, b) => {
    const aTime = a.start_ms ?? 0
    const bTime = b.start_ms ?? 0
    return aTime - bTime
  })
  
  // Apply audio offset correction
  // The raw audio time needs to be adjusted to match the transcript timestamps
  // Ensure we don't go negative (audio before transcript starts)
  const currentTimeMs = Math.max(0, (episode.currentTime * 1000) + AUDIO_OFFSET_MS)
  
  // Find the current claim: the most recent claim that has started
  // A claim is "current" from when it starts until the next claim starts
  let currentClaimIndex = -1
  
  for (let i = sortedClaims.length - 1; i >= 0; i--) {
    const claim = sortedClaims[i]
    const claimStartMs = claim.start_ms ?? 0
    
    // If we've passed this claim's start time, it's the current one
    if (currentTimeMs >= claimStartMs) {
      currentClaimIndex = i
      break
    }
  }
  
  const currentClaim = currentClaimIndex >= 0 ? sortedClaims[currentClaimIndex] : null
  // Past claims in REVERSE order (most recent first, right below current)
  const pastClaims = sortedClaims
    .filter((_, idx) => idx < currentClaimIndex)
    .reverse()
  const futureClaims = sortedClaims.filter((_, idx) => idx > currentClaimIndex)
  
  // Calculate relative time for claims
  const getRelativeTime = (claim: Claim) => {
    const claimStartMs = claim.start_ms ?? 0
    const claimTimeSeconds = claimStartMs / 1000
    // Use the offset-corrected current time (don't go negative)
    const adjustedCurrentTime = Math.max(0, episode.currentTime + (AUDIO_OFFSET_MS / 1000))
    const diff = adjustedCurrentTime - claimTimeSeconds
    
    if (diff < 60) return "JUST NOW"
    const mins = Math.floor(diff / 60)
    return `${mins} MIN AGO`
  }
  
  // Debug logging - enhanced with more details
  useEffect(() => {
    const adjustedCurrentTime = Math.max(0, episode.currentTime + (AUDIO_OFFSET_MS / 1000))
    if (currentClaim) {
      const claimStartMs = currentClaim.start_ms ?? 0
      const claimTimeSeconds = claimStartMs / 1000
      const displayText = currentClaim.distilled_claim || currentClaim.title || currentClaim.claim_text || "Unknown"
      const timeDiff = adjustedCurrentTime - claimTimeSeconds
      console.log(`[Sync Debug] Raw Audio: ${episode.currentTime.toFixed(2)}s | Adjusted: ${adjustedCurrentTime.toFixed(2)}s (${currentTimeMs}ms) | Claim: ${claimTimeSeconds.toFixed(2)}s (${claimStartMs}ms) | Diff: ${timeDiff.toFixed(2)}s | "${displayText.substring(0, 50)}..." | Past: ${pastClaims.length}`)
    } else {
      console.log(`[Sync Debug] Raw Audio: ${episode.currentTime.toFixed(2)}s | Adjusted: ${adjustedCurrentTime.toFixed(2)}s (${currentTimeMs}ms) | No current claim | Valid claims: ${sortedClaims.length}`)
    }
  }, [currentClaim?.id, episode.currentTime, pastClaims.length, currentTimeMs, sortedClaims.length, AUDIO_OFFSET_MS])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    const handleLoadedMetadata = () => {
      setIsAudioReady(true)
    }
    const handleTimeUpdate = () => {
      onTimeUpdate(audio.currentTime)
    }
    const handleEnded = () => {
      setIsPlaying(false)
    }

    audio.addEventListener("loadedmetadata", handleLoadedMetadata)
    audio.addEventListener("timeupdate", handleTimeUpdate)
    audio.addEventListener("ended", handleEnded)

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata)
      audio.removeEventListener("timeupdate", handleTimeUpdate)
      audio.removeEventListener("ended", handleEnded)
    }
  }, [onTimeUpdate])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    audio.src = episode.audioUrl ?? ""
    audio.load()
    setIsAudioReady(false)
    setIsPlaying(false)
  }, [episode.audioUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    if (isPlaying) {
      audio.play().catch(() => {
        setIsPlaying(false)
      })
    } else {
      audio.pause()
    }
  }, [isPlaying])

  // Auto-scroll to current claim when it changes
  useEffect(() => {
    if (currentClaimRef.current) {
      currentClaimRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }, [currentClaim?.id])
  
  // Log filtering stats when claims load
  useEffect(() => {
    const invalidCount = claims.length - validClaims.length
    
    if (invalidCount > 0) {
      console.log(`[Claims Filter] ${invalidCount} claims with 0:00 timestamp filtered out`)
    }
    console.log(`[Claims Filter] ${validClaims.length} valid claims loaded`)
  }, [claims.length, validClaims.length])

  return (
    <div className="noeron-theme flex min-h-screen flex-col bg-[var(--carbon-black)] text-[var(--parchment)] font-sans">
      <NoeronHeader actions={headerActions} onLogoClick={() => window.location.assign("/")} />
      <audio ref={audioRef} preload="metadata" className="hidden" />

      {/* Two Column Layout */}
      <div className="flex flex-1">
        {/* LEFT COLUMN - Sticky Podcast Player */}
        <aside className="w-[380px] shrink-0 border-r border-[var(--parchment)]/10 bg-[var(--dark-gray)] sticky top-0 h-screen overflow-y-auto">
          <div className="p-6 w-full flex flex-col justify-center min-h-full">
            {/* Episode Artwork */}
            <div className="mb-6">
              <div className="aspect-square w-full rounded-none shadow-lg overflow-hidden border border-[var(--parchment)]/10">
                <img
                  src="/images/wavelengths.jpg"
                  alt={episode.title}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            {/* Episode Info */}
            <div className="mb-6">
              <h1 className="display text-xl font-normal text-[var(--parchment)] mb-2">{episode.title}</h1>
              <p className="eyebrow mb-1">EPISODE {episode.id.split('_')[1] || '325'}</p>
              <p className="text-sm text-[var(--parchment)]/60 italic">Host: {episode.host}</p>
            </div>

            {/* Waveform Visualization */}
            <div className="mb-4">
              <div className="flex items-end justify-between gap-[2px] h-16 mb-2">
                {Array.from({ length: 40 }).map((_, i) => {
                  const height = 30 + Math.random() * 70
                  const isActive = i < (progressPercentage / 100) * 40
                  return (
                    <div
                      key={i}
                      className={`w-[3px] rounded-full transition-all duration-150 ${
                        isActive ? "bg-[var(--golden-chestnut)]" : "bg-[var(--parchment)]/20"
                      }`}
                      style={{
                        height: `${height}%`,
                        animation: isPlaying ? `wave 1s ease-in-out infinite ${i * 0.05}s` : "none",
                      }}
                    />
                  )
                })}
              </div>

              {/* Progress Bar */}
              <div
                className="group relative h-1.5 cursor-pointer overflow-hidden rounded-full bg-[var(--parchment)]/10 mb-2"
                onClick={handleProgressClick}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-[var(--golden-chestnut)] transition-all"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>

              {/* Time Display */}
              <div className="flex justify-between text-xs mono text-[var(--parchment)]/50">
                <span>{formatTime(episode.currentTime)}</span>
                <span>{formatTime(episode.durationSeconds)}</span>
              </div>
            </div>

            {/* Player Controls */}
            <div className="flex items-center justify-center gap-4">
              <Button
                size="icon"
                variant="ghost"
                onClick={handleSkipBack}
                className="relative size-12 text-[var(--parchment)]/60 hover:bg-[var(--parchment)]/10 hover:text-[var(--parchment)]"
                title="Skip back 15 seconds"
              >
                <RotateCcw className="size-7" />
                <span className="absolute text-[10px] font-bold">15</span>
              </Button>

              <Button
                size="icon"
                onClick={handlePlayPause}
                className="size-14 rounded-full bg-[var(--golden-chestnut)] text-[var(--carbon-black)] shadow-lg hover:bg-[var(--parchment)] transition-all hover:scale-105"
              >
                {isPlaying ? (
                  <Pause className="size-7" fill="currentColor" />
                ) : (
                  <Play className="size-7 translate-x-0.5" fill="currentColor" />
                )}
              </Button>

              <Button
                size="icon"
                variant="ghost"
                onClick={handleSkipForward}
                className="relative size-12 text-[var(--parchment)]/60 hover:bg-[var(--parchment)]/10 hover:text-[var(--parchment)]"
                title="Skip forward 15 seconds"
              >
                <RotateCw className="size-7" />
                <span className="absolute text-[10px] font-bold">15</span>
              </Button>
            </div>
          </div>
        </aside>

        {/* RIGHT COLUMN - Live Research Stream */}
        <main className="flex-1 overflow-y-auto bg-[var(--carbon-black)]">
          <div className="max-w-4xl mx-auto px-8 py-8">
            {/* Header */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 mb-2">
                <div className="h-px w-16 bg-[var(--parchment)]/20" />
                <h2 className="eyebrow" text-2xl>
                  Live Research Stream
                </h2>
                <div className="h-px w-16 bg-[var(--parchment)]/20" />
              </div>
            </div>

            {/* Current Topic - Always at Top */}
            {currentClaim && (
              <div ref={currentClaimRef}>
                <CurrentClaimCard claim={currentClaim} currentTimeMs={episode.currentTime * 1000} onDiveDeeper={onDiveDeeper} onViewSource={onViewSource} />
              </div>
            )}

            {/* Past Claims */}
            <div className="space-y-8">
              {pastClaims.map((claim) => (
                <PastClaimCard
                  key={claim.id}
                  claim={claim}
                  relativeTime={getRelativeTime(claim)}
                  isSelected={selectedClaimId === claim.id}
                  onSelect={() => setSelectedClaimId(claim.id === selectedClaimId ? null : claim.id)}
                  onDiveDeeper={onDiveDeeper}
                  onViewSource={onViewSource}
                />
              ))}
            </div>

            {/* Empty State */}
            {!currentClaim && pastClaims.length === 0 && (
              <div className="text-center py-16">
                <p className="text-[var(--parchment)]/60">Start playing to see research insights appear here</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* CSS for wave animation */}
      <style jsx>{`
        @keyframes wave {
          0%, 100% {
            transform: scaleY(1);
          }
          50% {
            transform: scaleY(1.5);
          }
        }
      `}</style>
    </div>
  )
}
