"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Play, Pause, RotateCcw, RotateCw } from "lucide-react"
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
  id: string
  timestamp: number
  category: string
  title: string
  description: string
  source: string
  status: "past" | "current" | "future"
  timing?: ClaimTiming | null
}

interface ListeningViewProps {
  episode: ListeningEpisode
  claims: Claim[]
  onDiveDeeper: (claimId: string) => void
  onViewSource: (claimId: string) => void
  onAskQuestion: (question: string) => void
  onTimeUpdate: (time: number) => void
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
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
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null)
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

  // Dynamically determine claim status based on current playback time
  // Sort claims by timestamp (use timing data if available, otherwise use claim timestamp)
  const sortedClaims = [...claims].sort((a, b) => {
    const aTime = a.timing?.start_ms ? a.timing.start_ms / 1000 : a.timestamp
    const bTime = b.timing?.start_ms ? b.timing.start_ms / 1000 : b.timestamp
    return aTime - bTime
  })
  
  const currentTimeMs = episode.currentTime * 1000
  
  // Find the current claim based on playback position
  // Use timing data if available, otherwise fall back to offset + thresholds
  const CURRENT_THRESHOLD_BEFORE = 2 // seconds before claim timestamp (very tight)
  const CURRENT_THRESHOLD_AFTER = 30 // seconds after claim timestamp (when it's being discussed)
  
  let currentClaimIndex = -1
  let bestMatch = -1
  let bestMatchScore = Infinity
  
  // Find the claim that best matches the current time
  for (let i = 0; i < sortedClaims.length; i++) {
    const claim = sortedClaims[i]
    
    // Use enriched timing data if available
    if (claim.timing) {
      const claimStartMs = claim.timing.start_ms
      const claimEndMs = claim.timing.end_ms
      
      // Check if current time is within the claim's timing window
      if (currentTimeMs >= claimStartMs && currentTimeMs <= claimEndMs) {
        currentClaimIndex = i
        break
      }
      
      // Track closest claim we've passed
      if (currentTimeMs > claimEndMs) {
        const diff = currentTimeMs - claimEndMs
        if (diff < bestMatchScore) {
          bestMatchScore = diff
          bestMatch = i
        }
      }
    } else {
      // Fallback to old logic with offset
      const adjustedCurrentTime = episode.currentTime + TIMING_OFFSET
      const timeDiff = adjustedCurrentTime - claim.timestamp
      
      if (timeDiff >= -CURRENT_THRESHOLD_BEFORE && timeDiff <= CURRENT_THRESHOLD_AFTER) {
        currentClaimIndex = i
        break
      }
      
      if (timeDiff > 0 && timeDiff < bestMatchScore) {
        bestMatchScore = timeDiff
        bestMatch = i
      }
    }
  }
  
  // If no claim is actively being discussed, use the most recent one we've passed
  if (currentClaimIndex === -1 && bestMatch >= 0) {
    currentClaimIndex = bestMatch
  }
  
  const currentClaim = currentClaimIndex >= 0 ? sortedClaims[currentClaimIndex] : null
  const pastClaims = sortedClaims.filter((_, idx) => idx < currentClaimIndex)
  const futureClaims = sortedClaims.filter((_, idx) => idx > currentClaimIndex)
  
  // Calculate relative time for claims
  const getRelativeTime = (claimTime: number) => {
    const diff = episode.currentTime - claimTime
    if (diff < 60) return "JUST NOW"
    const mins = Math.floor(diff / 60)
    return `${mins} MIN AGO`
  }
  
  // Debug logging
  useEffect(() => {
    if (currentClaim) {
      const claimTime = currentClaim.timing?.start_ms ? `${(currentClaim.timing.start_ms / 1000).toFixed(1)}s (enriched)` : `${currentClaim.timestamp}s (fallback)`
      console.log(`[Sync Debug] Current: ${episode.currentTime.toFixed(1)}s, Claim: ${claimTime}, Has word-timing: ${currentClaim.timing?.words ? 'yes' : 'no'}`)
    }
  }, [currentClaim?.id, episode.currentTime])

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

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground font-sans">
      <NoeronHeader />
      <audio ref={audioRef} preload="metadata" className="hidden" />

      {/* Two Column Layout */}
      <div className="flex flex-1">
        {/* LEFT COLUMN - Sticky Podcast Player */}
        <aside className="w-[380px] shrink-0 border-r border-border bg-card sticky top-0 min-h-screen overflow-y-auto flex items-center">
          <div className="p-6 w-full">
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
            {currentClaim && (() => {
              // Check if we have word-level timing
              const hasWordTiming = currentClaim.timing && currentClaim.timing.words && currentClaim.timing.words.length > 0
              const currentTimeMs = episode.currentTime * 1000
              
              // Function to render text with word-level highlighting
              const renderWithWordHighlighting = (text: string, words: WordTiming[]) => {
                return (
                  <span>
                    {words.map((word, idx) => {
                      const isHighlighted = currentTimeMs >= word.start_ms && currentTimeMs <= word.end_ms
                      const hasPassed = currentTimeMs > word.end_ms
                      
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
                <div className="mb-8" ref={currentClaimRef}>
                  <div className="mb-3 flex items-center gap-2 text-xs font-bold text-accent uppercase tracking-wider">
                    <span>JUST NOW</span>
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75"></span>
                      <span className="relative inline-flex size-2 rounded-full bg-accent"></span>
                    </span>
                    {hasWordTiming && (
                      <span className="text-xs text-muted-foreground font-normal">• Word-level sync</span>
                    )}
                  </div>

                  <div className="bg-gradient-to-br from-card to-muted/50 rounded-xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-all duration-300">
                    <div className="mb-3">
                      <span className="inline-block rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
                        {currentClaim.category}
                      </span>
                    </div>

                    {/* Title with word-level highlighting if available */}
                    <h3 className="text-2xl font-bold mb-4 leading-relaxed">
                      "{hasWordTiming ? 
                        renderWithWordHighlighting(currentClaim.title, currentClaim.timing!.words!) :
                        <span className="text-foreground transition-colors duration-500">{currentClaim.title}</span>
                      }"
                    </h3>

                    {/* Keep description in light color for readability */}
                    <p className="text-base text-muted-foreground leading-relaxed mb-4">
                      {currentClaim.description}
                    </p>

                    <p className="text-sm text-muted-foreground/60 mb-6 italic">"{currentClaim.source}"</p>

                    <div className="flex gap-3">
                      <Button
                        onClick={() => onDiveDeeper(currentClaim.id)}
                        className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold shadow-[0_4px_14px_rgba(253,169,43,0.2)]"
                      >
                        Dive Deeper
                      </Button>
                      <Button
                        onClick={() => onViewSource(currentClaim.id)}
                        variant="outline"
                        className="border-border bg-card text-foreground hover:border-accent/30 hover:bg-muted"
                      >
                        Read Source
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Past Claims */}
            <div className="space-y-8">
              {pastClaims.slice(0, 10).map((claim) => (
                <div key={claim.id}>
                  <div className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {getRelativeTime(claim.timestamp)}
                  </div>

                  <div
                    onClick={() => setSelectedClaimId(claim.id === selectedClaimId ? null : claim.id)}
                    className={`bg-card rounded-xl p-5 cursor-pointer transition-all ${
                      selectedClaimId === claim.id
                        ? "shadow-[0_8px_30px_rgba(253,169,43,0.15)]"
                        : "shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)]"
                    }`}
                  >
                    <div className="mb-2">
                      <span className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {claim.category}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-foreground mb-2">"{claim.title}"</h3>

                    <p className="text-sm text-muted-foreground leading-relaxed mb-3">{claim.description}</p>

                    <p className="text-xs text-muted-foreground/60 mb-4">Source: {claim.source}</p>

                    {selectedClaimId === claim.id && (
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
