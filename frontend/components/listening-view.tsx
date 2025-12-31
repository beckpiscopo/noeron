"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Play, Pause, RotateCcw, RotateCw, ChevronDown, ChevronUp } from "lucide-react"
import { NoeronHeader } from "./noeron-header"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

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
  if (claim.timestamp) {
    return formatTime(claim.timestamp)
  }
  if (claim.start_ms) {
    return formatTime(claim.start_ms / 1000)
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
  const [isExpanded, setIsExpanded] = useState(false)
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
              className={`transition-colors duration-200 text-foreground ${
                isHighlighted ? 'font-semibold' : ''
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
      <div className="mb-3 flex items-center gap-2 text-xs font-bold text-accent uppercase tracking-wider">
        <span>JUST NOW</span>
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75"></span>
          <span className="relative inline-flex size-2 rounded-full bg-accent"></span>
        </span>
        {hasDistilledClaim && (
          <span className="text-xs text-muted-foreground font-normal ml-1 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500"></span>
            AI-distilled
          </span>
        )}
        {hasWordTiming && (
          <span className="text-xs text-muted-foreground font-normal">• Word-level sync</span>
        )}
      </div>

      <div className="bg-gradient-to-br from-card to-muted/50 rounded-xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-all duration-300">
        {/* Main distilled claim text - large and prominent */}
        <h3 className="text-2xl font-bold mb-4 leading-relaxed text-foreground">
          {hasWordTiming && claim.timing?.words ? 
            renderWithWordHighlighting(displayText, claim.timing.words) :
            <span className="transition-colors duration-500">{displayText}</span>
          }
        </h3>

        {/* Timestamp */}
        <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="text-base">⏱️</span>
            <span className="font-mono">{timestamp}</span>
          </span>
        </div>

        {/* Expandable full transcript quote */}
        {hasDistilledClaim && fullText && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="mb-4">
            <CollapsibleTrigger className="flex items-center gap-2 text-sm text-accent hover:text-accent/80 transition-colors font-medium">
              {isExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Hide full quote
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  See full transcript quote
                </>
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="bg-muted/50 rounded-lg p-4 border-l-4 border-accent/30">
                <p className="text-sm text-muted-foreground leading-relaxed italic">
                  "{fullText}"
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            onClick={() => onDiveDeeper(claim.id)}
            className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold shadow-[0_4px_14px_rgba(253,169,43,0.2)]"
          >
            Dive Deeper
          </Button>
          <Button
            onClick={() => onViewSource(claim.id)}
            variant="outline"
            className="border-border bg-card text-foreground hover:border-accent/30 hover:bg-muted"
          >
            Read Source
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
  const [isExpanded, setIsExpanded] = useState(false)
  const hasDistilledClaim = !!claim.distilled_claim
  const displayText = getClaimDisplayText(claim)
  const fullText = getClaimFullText(claim)
  const timestamp = formatTimestamp(claim)
  
  return (
    <div>
      <div className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {relativeTime}
      </div>

      <div
        onClick={onSelect}
        className={`bg-card rounded-xl p-5 cursor-pointer transition-all ${
          isSelected
            ? "shadow-[0_8px_30px_rgba(253,169,43,0.15)]"
            : "shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)]"
        }`}
      >
        {/* Distilled claim or title - primary */}
        <div className="flex items-start gap-2 mb-3">
          <h3 className="text-lg font-bold text-foreground flex-1 leading-snug">
            {displayText}
          </h3>
          {hasDistilledClaim && (
            <span className="inline-flex items-center gap-1 text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full shrink-0">
              <span className="inline-block w-1 h-1 rounded-full bg-green-500"></span>
              AI
            </span>
          )}
        </div>

        {/* Timestamp */}
        <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span>⏱️</span>
            <span className="text-xs font-mono">{timestamp}</span>
          </span>
        </div>

        {/* Expandable full quote */}
        {hasDistilledClaim && fullText && (
          <Collapsible 
            open={isExpanded} 
            onOpenChange={(open) => {
              setIsExpanded(open)
            }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="mb-3"
          >
            <CollapsibleTrigger className="flex items-center gap-2 text-xs text-accent hover:text-accent/80 transition-colors">
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  Hide quote
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  Full quote
                </>
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="bg-muted/30 rounded p-3 border-l-2 border-accent/20">
                <p className="text-xs text-muted-foreground leading-relaxed italic">
                  "{fullText}"
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Action buttons (shown when selected) */}
        {isSelected && (
          <div className="flex gap-3 pt-3 border-t border-border">
            <Button
              onClick={(e) => {
                e.stopPropagation()
                onDiveDeeper(claim.id)
              }}
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              Dive Deeper
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation()
                onViewSource(claim.id)
              }}
              size="sm"
              variant="outline"
              className="border-border text-foreground hover:bg-muted"
            >
              View Source
            </Button>
          </div>
        )}
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
  
  // Timing offset adjustment (if claims timestamps are consistently off)
  // Positive value means claims come LATER in audio than their timestamp suggests
  // Negative value means claims come EARLIER
  const TIMING_OFFSET = -20 // Adjust this based on testing

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
    const claimStartMs = claim.start_ms || claim.timing?.start_ms || claim.timestamp * 1000
    return claimStartMs > 0 // Must have a valid start time
  })
  
  // Sort claims by start time
  const sortedClaims = [...validClaims].sort((a, b) => {
    const aTime = a.start_ms || a.timing?.start_ms || a.timestamp * 1000
    const bTime = b.start_ms || b.timing?.start_ms || b.timestamp * 1000
    return aTime - bTime
  })
  
  const currentTimeMs = episode.currentTime * 1000
  
  // Find the current claim: the most recent claim that has started
  // A claim is "current" from when it starts until the next claim starts
  let currentClaimIndex = -1
  
  for (let i = sortedClaims.length - 1; i >= 0; i--) {
    const claim = sortedClaims[i]
    const claimStartMs = claim.start_ms || claim.timing?.start_ms || claim.timestamp * 1000
    
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
    const claimStartMs = claim.start_ms || claim.timing?.start_ms || claim.timestamp * 1000
    const claimTimeSeconds = claimStartMs / 1000
    const diff = episode.currentTime - claimTimeSeconds
    
    if (diff < 60) return "JUST NOW"
    const mins = Math.floor(diff / 60)
    return `${mins} MIN AGO`
  }
  
  // Debug logging
  useEffect(() => {
    if (currentClaim) {
      const claimStartMs = currentClaim.start_ms || currentClaim.timing?.start_ms || (currentClaim.timestamp || 0) * 1000
      const claimTimeSeconds = claimStartMs / 1000
      const displayText = currentClaim.distilled_claim || currentClaim.title || currentClaim.claim_text || "Unknown"
      console.log(`[Sync Debug] Time: ${episode.currentTime.toFixed(1)}s, Claim at: ${claimTimeSeconds.toFixed(1)}s, "${displayText.substring(0, 50)}...", Past: ${pastClaims.length}`)
    }
  }, [currentClaim?.id, episode.currentTime, pastClaims.length])

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
    <div className="flex min-h-screen flex-col bg-background text-foreground font-sans">
      <NoeronHeader />
      <audio ref={audioRef} preload="metadata" className="hidden" />

      {/* Two Column Layout */}
      <div className="flex flex-1">
        {/* LEFT COLUMN - Sticky Podcast Player */}
        <aside className="w-[380px] shrink-0 border-r border-border bg-card sticky top-0 h-screen overflow-y-auto">
          <div className="p-6 w-full flex flex-col justify-center min-h-full">
            {/* Episode Artwork */}
            <div className="mb-6">
              <div className="aspect-square w-full rounded-lg shadow-lg overflow-hidden border border-border">
                <img 
                  src="/images/green_watercolor.jpg" 
                  alt={episode.title}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            {/* Episode Info */}
            <div className="mb-6">
              <h1 className="text-xl font-bold text-foreground mb-2">{episode.title}</h1>
              <p className="text-sm text-accent mb-1">EPISODE {episode.id.split('_')[1] || '325'}</p>
              <p className="text-sm text-muted-foreground italic">Host: {episode.host}</p>
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
                        isActive ? "bg-accent" : "bg-border"
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
                className="group relative h-1.5 cursor-pointer overflow-hidden rounded-full bg-muted mb-2"
                onClick={handleProgressClick}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-accent transition-all"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>

              {/* Time Display */}
              <div className="flex justify-between text-xs font-mono text-muted-foreground">
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
                className="relative size-12 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Skip back 15 seconds"
              >
                <RotateCcw className="size-7" />
                <span className="absolute text-[10px] font-bold">15</span>
              </Button>

              <Button
                size="icon"
                onClick={handlePlayPause}
                className="size-14 rounded-full bg-accent text-accent-foreground shadow-lg hover:bg-accent/90 transition-all hover:scale-105"
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
                className="relative size-12 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Skip forward 15 seconds"
              >
                <RotateCw className="size-7" />
                <span className="absolute text-[10px] font-bold">15</span>
              </Button>
            </div>
          </div>
        </aside>

        {/* RIGHT COLUMN - Live Research Stream */}
        <main className="flex-1 overflow-y-auto bg-muted">
          <div className="max-w-4xl mx-auto px-8 py-8">
            {/* Header */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 mb-2">
                <div className="h-px w-16 bg-border" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Live Research Stream
                </h2>
                <div className="h-px w-16 bg-border" />
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
                <div className="text-6xl mb-4">🎧</div>
                <p className="text-muted-foreground">Start playing to see research insights appear here</p>
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
