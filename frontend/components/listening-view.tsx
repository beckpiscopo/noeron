"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Play, Pause, SkipBack, SkipForward } from "lucide-react"
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

export interface Claim {
  id: string
  timestamp: number
  category: string
  title: string
  description: string
  source: string
  status: "past" | "current" | "future"
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
  // Sort claims by timestamp
  const sortedClaims = [...claims].sort((a, b) => a.timestamp - b.timestamp)
  
  // Apply timing offset to current time for comparison
  const adjustedCurrentTime = episode.currentTime + TIMING_OFFSET
  
  // Find the current claim based on playback position
  // A claim is "current" when it's actively being discussed (tight window for precision)
  const CURRENT_THRESHOLD_BEFORE = 2 // seconds before claim timestamp (very tight)
  const CURRENT_THRESHOLD_AFTER = 30 // seconds after claim timestamp (when it's being discussed)
  
  let currentClaimIndex = -1
  let bestMatch = -1
  let bestMatchScore = Infinity
  
  // Find the claim that best matches the current time
  for (let i = 0; i < sortedClaims.length; i++) {
    const claim = sortedClaims[i]
    const timeDiff = adjustedCurrentTime - claim.timestamp
    
    // Check if we're in the active discussion window for this claim
    if (timeDiff >= -CURRENT_THRESHOLD_BEFORE && timeDiff <= CURRENT_THRESHOLD_AFTER) {
      // This claim is actively being discussed
      currentClaimIndex = i
      break
    }
    
    // Track the closest claim we've passed (for when between claims)
    if (timeDiff > 0 && timeDiff < bestMatchScore) {
      bestMatchScore = timeDiff
      bestMatch = i
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
  
  // Debug logging (can remove later)
  useEffect(() => {
    if (currentClaim) {
      console.log(`[Sync Debug] Raw time: ${episode.currentTime.toFixed(1)}s, Adjusted: ${adjustedCurrentTime.toFixed(1)}s, Claim timestamp: ${currentClaim.timestamp}s, Diff: ${(adjustedCurrentTime - currentClaim.timestamp).toFixed(1)}s`)
    }
  }, [currentClaim?.id, episode.currentTime, adjustedCurrentTime])

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
    <div className="flex min-h-screen flex-col bg-[#102216] text-white font-sans">
      <NoeronHeader />
      <audio ref={audioRef} preload="metadata" className="hidden" />

      {/* Two Column Layout */}
      <div className="flex flex-1 pt-14">
        {/* LEFT COLUMN - Sticky Podcast Player */}
        <aside className="w-[380px] shrink-0 border-r border-[#28392e] bg-[#0d1912] sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
          <div className="p-6">
            {/* Episode Artwork */}
            <div className="mb-6">
              <div className="aspect-square w-full rounded-lg bg-gradient-to-br from-[#1a4d3a] via-[#2a5d4a] to-[#1a3d2a] shadow-lg overflow-hidden border border-[#28392e]">
                <div className="h-full w-full flex items-center justify-center">
                  <div className="text-6xl">🧠</div>
                </div>
              </div>
            </div>

            {/* Episode Info */}
            <div className="mb-6">
              <h1 className="text-xl font-bold text-white mb-2">{episode.title}</h1>
              <p className="text-sm text-[#FDA92B] mb-1">EPISODE {episode.id.split('_')[1] || '325'}</p>
              <p className="text-sm text-gray-400 italic">Host: {episode.host}</p>
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
                        isActive ? "bg-[#FDA92B]" : "bg-[#28392e]"
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
                className="group relative h-1.5 cursor-pointer overflow-hidden rounded-full bg-[#1e2e24] mb-2"
                onClick={handleProgressClick}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-[#FDA92B] transition-all"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>

              {/* Time Display */}
              <div className="flex justify-between text-xs font-mono text-gray-400">
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
                className="size-10 text-gray-400 hover:bg-[#1e2e24] hover:text-white"
                title="Skip back 15 seconds"
              >
                <SkipBack className="size-5" />
              </Button>

              <Button
                size="icon"
                onClick={handlePlayPause}
                className="size-14 rounded-full bg-[#FDA92B] text-[#102216] shadow-lg hover:bg-[#FDA92B]/90 transition-all hover:scale-105"
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
                className="size-10 text-gray-400 hover:bg-[#1e2e24] hover:text-white"
                title="Skip forward 15 seconds"
              >
                <SkipForward className="size-5" />
              </Button>
            </div>
          </div>
        </aside>

        {/* RIGHT COLUMN - Live Research Stream */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-8 py-8">
            {/* Header */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 mb-2">
                <div className="h-px w-16 bg-[#28392e]" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Live Research Stream
                </h2>
                <div className="h-px w-16 bg-[#28392e]" />
              </div>
            </div>

            {/* Current Topic - Always at Top */}
            {currentClaim && (
              <div className="mb-8" ref={currentClaimRef}>
                <div className="mb-3 flex items-center gap-2 text-xs font-bold text-[#FDA92B] uppercase tracking-wider">
                  <span>JUST NOW</span>
                </div>

                <div className="bg-gradient-to-br from-[#1e2e24] to-[#182d21] border border-[#FDA92B]/30 rounded-xl p-6 shadow-[0_0_30px_rgba(253,169,43,0.1)]">
                  <div className="mb-3">
                    <span className="inline-block rounded-full bg-[#FDA92B]/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#FDA92B]">
                      {currentClaim.category}
                    </span>
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-4">{currentClaim.title}</h3>

                  <p className="text-base text-gray-300 leading-relaxed mb-4">{currentClaim.description}</p>

                  <p className="text-sm text-gray-500 mb-6 italic">"{currentClaim.source}"</p>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => onDiveDeeper(currentClaim.id)}
                      className="bg-[#FDA92B] text-[#102216] hover:bg-[#FDA92B]/90 font-semibold shadow-[0_4px_14px_rgba(253,169,43,0.2)]"
                    >
                      Dive Deeper
                    </Button>
                    <Button
                      onClick={() => onViewSource(currentClaim.id)}
                      variant="outline"
                      className="border-[#28392e] bg-[#1e2e24] text-white hover:border-[#FDA92B]/30 hover:bg-[#28392e]"
                    >
                      Read Source
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Past Claims */}
            <div className="space-y-8">
              {pastClaims.slice(0, 10).map((claim) => (
                <div key={claim.id}>
                  <div className="mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {getRelativeTime(claim.timestamp)}
                  </div>

                  <div
                    onClick={() => setSelectedClaimId(claim.id === selectedClaimId ? null : claim.id)}
                    className={`bg-[#1a261f] border rounded-xl p-5 cursor-pointer transition-all ${
                      selectedClaimId === claim.id
                        ? "border-[#FDA92B]/30 shadow-md"
                        : "border-[#28392e] hover:border-[#FDA92B]/20"
                    }`}
                  >
                    <div className="mb-2">
                      <span className="inline-block rounded-full bg-[#28392e] px-2.5 py-0.5 text-xs font-medium text-gray-400 uppercase tracking-wide">
                        {claim.category}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-2">{claim.title}</h3>

                    <p className="text-sm text-gray-300 leading-relaxed mb-3">{claim.description}</p>

                    <p className="text-xs text-gray-500 mb-4">Source: {claim.source}</p>

                    {selectedClaimId === claim.id && (
                      <div className="flex gap-3 pt-3 border-t border-[#28392e]">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            onDiveDeeper(claim.id)
                          }}
                          size="sm"
                          className="bg-[#FDA92B] text-[#102216] hover:bg-[#FDA92B]/90"
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
                          className="border-[#28392e] text-white hover:bg-[#28392e]"
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
                <p className="text-gray-400">Start playing to see research insights appear here</p>
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
