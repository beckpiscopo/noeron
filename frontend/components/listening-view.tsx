"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Play, Pause, Paperclip, Mic, ArrowUp, Lock } from "lucide-react"
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

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
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

  return (
    <div className="flex min-h-screen flex-col bg-[#102216] text-white font-sans">
      <NoeronHeader />

      <header className="sticky top-14 z-40 flex-none border-b border-[#28392e] bg-[#102216]/95 backdrop-blur-sm">
        <audio ref={audioRef} preload="metadata" className="hidden" />
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="grid grid-cols-2 gap-8 items-center">
            {/* Left Half: Play Button + Episode Info */}
            <div className="flex items-center gap-4">
              {/* Play/Pause Button */}
              <Button
                size="icon"
                onClick={handlePlayPause}
                className="size-12 shrink-0 rounded-full bg-[#FDA92B] text-[#102216] shadow-[0_0_20px_rgba(88,61,50,0.3)] transition-all hover:scale-105 hover:bg-[#FDA92B]/90"
              >
                {isPlaying ? (
                  <Pause className="size-6" fill="currentColor" />
                ) : (
                  <Play className="size-6 translate-x-0.5" fill="currentColor" />
                )}
              </Button>

              {/* Episode Info */}
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold leading-tight mb-0.5 truncate">{episode.title}</h1>
                <p className="text-xs text-gray-400">
                  {episode.podcast} • Host: {episode.host} • Guest: {episode.guest}
                </p>
              </div>
            </div>

            {/* Right Half: Waveform + Progress Bar */}
            <div className="space-y-2">
              {/* Progress Bar with Timestamps */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-[#FDA92B] tabular-nums w-11 text-right shrink-0">
                  {formatTime(episode.currentTime)}
                </span>

                {/* Container for aligned soundwaves and progress bar */}
                <div className="flex-1 space-y-2">
                  {/* Animated Sound Wave Visualization - matches progress bar width */}
                  <div className="flex items-center justify-between gap-[2px] h-8">
                    {Array.from({ length: 60 }).map((_, i) => {
                      const height = 30 + Math.random() * 70
                      const isActive = i < (progressPercentage / 100) * 60
                      return (
                        <div
                          key={i}
                          className={`w-[2px] rounded-full transition-all duration-150 ${
                            isActive ? "bg-[#FDA92B]" : "bg-gray-600"
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
                    className="group relative h-1 cursor-pointer overflow-hidden rounded-full bg-[#1e2e24]"
                    onClick={handleProgressClick}
                  >
                    <div
                      className="absolute inset-y-0 left-0 bg-[#FDA92B] transition-all"
                      style={{ width: `${progressPercentage}%` }}
                    />
                    <div
                      className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-[#FDA92B] opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
                      style={{ left: `calc(${progressPercentage}% - 6px)` }}
                    />
                  </div>
                </div>

                <span className="text-xs font-mono text-gray-400 tabular-nums w-11 text-left shrink-0">
                  {formatTime(episode.durationSeconds)}
                </span>
              </div>
            </div>
          </div>
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
      </header>

      {/* Scrollable Main Content - Contextual Feed */}
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Contextual Timeline</h2>
          </div>

          <div className="relative space-y-8">
            {/* Timeline Line */}
            <div className="absolute left-12 top-0 bottom-0 w-px bg-[#28392e]" />

            {claims.map((claim) => {
              const isPast = claim.status === "past"
              const isCurrent = claim.status === "current"
              const isFuture = claim.status === "future"
              const isSelected = isPast && selectedClaimId === claim.id

              return (
                <div
                  key={claim.id}
                  className={`relative transition-all duration-300 ${
                    isPast && !isSelected ? "opacity-50" : ""
                  } ${isCurrent || isSelected ? "scale-[1.02]" : ""}`}
                >
                  {/* Timeline Timestamp */}
                  <div className="absolute left-0 w-10 text-right text-xs font-mono text-gray-500">
                    {formatTime(claim.timestamp)}
                  </div>

                  {/* Timeline Dot */}
                  <div
                    className={`absolute left-[45px] top-6 size-3 rounded-full border-2 ${
                      isCurrent || isSelected
                        ? "border-[#FDA92B] bg-[#FDA92B] shadow-[0_0_12px_rgba(88,61,50,0.6)]"
                        : "border-[#28392e] bg-[#1e2e24]"
                    }`}
                  />

                  {/* Claim Card */}
                  <div
                    onClick={() => isPast && setSelectedClaimId(claim.id === selectedClaimId ? null : claim.id)}
                    className={`ml-16 rounded-xl border p-5 transition-all ${
                      isCurrent || isSelected
                        ? "border-[#FDA92B]/30 bg-gradient-to-br from-[#1e2e24] to-[#182d21] shadow-[0_0_30px_rgba(88,61,50,0.1)]"
                        : "border-[#28392e] bg-[#1a261f]"
                    } ${isFuture ? "relative overflow-hidden" : ""} ${
                      isPast ? "cursor-pointer hover:border-[#FDA92B]/20" : ""
                    }`}
                  >
                    {/* Current Topic Badge */}
                    {isCurrent && (
                      <div className="mb-3 flex items-center gap-2">
                        <span className="rounded bg-[#FDA92B]/20 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-[#FDA92B]">
                          Current Topic
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <span className="relative flex size-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FDA92B] opacity-75"></span>
                            <span className="relative inline-flex size-2 rounded-full bg-[#FDA92B]"></span>
                          </span>
                          Live
                        </span>
                      </div>
                    )}

                    {/* Locked Overlay for Future Claims */}
                    {isFuture && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-[#102216]/80 backdrop-blur-sm">
                        <div className="text-center">
                          <Lock className="mx-auto mb-2 size-8 text-gray-600" />
                          <p className="text-sm font-medium text-gray-400">
                            Locked until {formatTime(claim.timestamp)}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className={isFuture ? "blur-sm" : ""}>
                      {/* Category Badge */}
                      <span className="mb-2 inline-block rounded-full bg-[#28392e] px-2.5 py-0.5 text-xs font-medium text-gray-400">
                        {claim.category}
                      </span>

                      {/* Claim Title */}
                      <h3 className="mb-2 text-lg font-bold leading-tight text-white">{claim.title}</h3>

                      {/* Claim Description */}
                      <p className="mb-4 text-sm leading-relaxed text-gray-300">{claim.description}</p>

                      {/* Source */}
                      <p className="mb-4 text-xs text-gray-500">Source: {claim.source}</p>

                      {/* Action Buttons - For Current Claim and Selected Past Claims */}
                      {(isCurrent || isSelected) && (
                        <div className="flex flex-wrap gap-3">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              onDiveDeeper(claim.id)
                            }}
                            className="flex-1 bg-[#FDA92B] font-bold text-[#102216] shadow-[0_4px_14px_rgba(88,61,50,0.2)] transition-all hover:scale-105 hover:bg-[#FDA92B]/90 sm:flex-none"
                          >
                            Dive Deeper
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              onViewSource(claim.id)
                            }}
                            variant="outline"
                            className="flex-1 border-[#28392e] bg-[#1e2e24] font-medium text-white hover:border-[#FDA92B]/30 hover:bg-[#28392e] hover:text-white sm:flex-none"
                          >
                            View Source
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>

      {/* Fixed Footer with Chat Input */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 flex-none border-t border-[#28392e] bg-[#102216]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {/* Clip Button */}
            <Button
              size="icon"
              variant="ghost"
              className="size-10 shrink-0 text-gray-400 hover:bg-[#1e2e24] hover:text-white"
            >
              <Paperclip className="size-5" />
            </Button>

            {/* Input Field */}
            <div className="relative flex-1">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask AI about this segment..."
                className="w-full rounded-lg border border-[#28392e] bg-[#1a261f] px-4 py-3 pr-12 text-sm text-white placeholder:text-gray-500 focus:border-[#FDA92B]/50 focus:outline-none focus:ring-2 focus:ring-[#FDA92B]/20"
              />

              {/* Microphone Button */}
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-1 top-1/2 size-8 -translate-y-1/2 text-gray-400 hover:bg-transparent hover:text-white"
              >
                <Mic className="size-4" />
              </Button>
            </div>

            {/* Send Button */}
            <Button
              size="icon"
              onClick={handleSendQuestion}
              disabled={!question.trim()}
              className="size-10 shrink-0 rounded-full bg-[#FDA92B] text-[#102216] shadow-[0_0_15px_rgba(88,61,50,0.3)] transition-all hover:scale-105 hover:bg-[#FDA92B]/90 disabled:opacity-50 disabled:hover:scale-100"
            >
              <ArrowUp className="size-5" />
            </Button>
          </div>
        </div>
      </footer>
    </div>
  )
}
