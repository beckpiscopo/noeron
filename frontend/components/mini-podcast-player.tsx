"use client"

import { useState, useRef, useEffect } from "react"
import { Play, Pause, Download, ChevronDown, ChevronUp, RefreshCw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import type { GeneratePodcastResponse } from "@/lib/chat-types"

interface MiniPodcastPlayerProps {
  podcast: GeneratePodcastResponse | null
  isLoading: boolean
  error?: string | null
  onGenerate: () => void
  onRegenerate: () => void
  style?: "casual" | "academic"
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function MiniPodcastPlayer({
  podcast,
  isLoading,
  error,
  onGenerate,
  onRegenerate,
  style = "casual",
}: MiniPodcastPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isScriptOpen, setIsScriptOpen] = useState(false)

  // Reset playback state when podcast changes
  useEffect(() => {
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [podcast?.podcast_url])

  // Handle audio time updates
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleDurationChange = () => setDuration(audio.duration || 0)
    const handleEnded = () => setIsPlaying(false)

    audio.addEventListener("timeupdate", handleTimeUpdate)
    audio.addEventListener("durationchange", handleDurationChange)
    audio.addEventListener("ended", handleEnded)

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate)
      audio.removeEventListener("durationchange", handleDurationChange)
      audio.removeEventListener("ended", handleEnded)
    }
  }, [podcast?.podcast_url])

  const togglePlayPause = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return

    const time = parseFloat(e.target.value)
    audio.currentTime = time
    setCurrentTime(time)
  }

  const handleDownload = () => {
    if (!podcast?.podcast_url) return

    const link = document.createElement("a")
    link.href = podcast.podcast_url
    link.download = `mini-podcast-${podcast.claim_id?.slice(0, 20) || "claim"}.wav`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Initial state - no podcast yet
  if (!podcast && !isLoading && !error) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Generate a 3-5 minute AI podcast where two hosts discuss this claim and its supporting research.
        </p>
        <button
          onClick={onGenerate}
          className="w-full py-3 font-medium transition-all duration-200 flex items-center justify-center gap-2 rounded-sm bg-foreground/8 text-foreground/60 hover:bg-foreground/15 hover:text-foreground/80"
        >
          <Sparkles className="w-4 h-4" />
          Generate Mini Podcast
        </button>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-center py-8">
          <div className="text-center space-y-3">
            <Spinner className="h-8 w-8 mx-auto text-[var(--golden-chestnut)]" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Generating podcast...</p>
              <p className="text-xs text-muted-foreground">
                Creating script and synthesizing audio
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-3">
        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
        {podcast?.script && (
          <div className="text-xs text-muted-foreground">
            Script was generated but audio synthesis failed. You can try regenerating.
          </div>
        )}
        <Button
          onClick={onRegenerate}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <RefreshCw className="mr-2 h-3 w-3" />
          Try Again
        </Button>
      </div>
    )
  }

  // No audio URL (script only - audio failed)
  if (podcast && !podcast.podcast_url && podcast.script) {
    return (
      <div className="space-y-3">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-3">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Audio synthesis failed, but the script was generated successfully.
          </p>
        </div>

        <Collapsible open={isScriptOpen} onOpenChange={setIsScriptOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between">
              <span>View Script</span>
              {isScriptOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 max-h-64 overflow-y-auto bg-muted/30 rounded-md p-3">
              <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">
                {podcast.script}
              </pre>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Button
          onClick={onRegenerate}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <RefreshCw className="mr-2 h-3 w-3" />
          Regenerate with Audio
        </Button>
      </div>
    )
  }

  // Success state - full player
  if (podcast?.podcast_url) {
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0

    return (
      <div className="space-y-3">
        {/* Hidden audio element */}
        <audio ref={audioRef} src={podcast.podcast_url} preload="metadata" />

        {/* Player controls */}
        <div className="flex items-center gap-3">
          {/* Play/Pause button */}
          <Button
            variant="outline"
            size="icon"
            onClick={togglePlayPause}
            className="h-10 w-10 rounded-full shrink-0"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4 ml-0.5" />
            )}
          </Button>

          {/* Progress section */}
          <div className="flex-1 space-y-1">
            {/* Progress bar */}
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className={cn(
                "w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer",
                "[&::-webkit-slider-thumb]:appearance-none",
                "[&::-webkit-slider-thumb]:h-3",
                "[&::-webkit-slider-thumb]:w-3",
                "[&::-webkit-slider-thumb]:rounded-full",
                "[&::-webkit-slider-thumb]:bg-[var(--golden-chestnut)]",
                "[&::-webkit-slider-thumb]:cursor-pointer",
                "[&::-moz-range-thumb]:h-3",
                "[&::-moz-range-thumb]:w-3",
                "[&::-moz-range-thumb]:rounded-full",
                "[&::-moz-range-thumb]:bg-[var(--golden-chestnut)]",
                "[&::-moz-range-thumb]:border-0",
                "[&::-moz-range-thumb]:cursor-pointer"
              )}
              style={{
                background: `linear-gradient(to right, var(--golden-chestnut) ${progress}%, hsl(var(--muted)) ${progress}%)`
              }}
            />

            {/* Time display */}
            <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration || podcast.duration_seconds || 0)}</span>
            </div>
          </div>

          {/* Download button */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleDownload}
            title="Download audio"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>

        {/* Cached indicator */}
        {podcast.cached && (
          <div className="text-[10px] text-muted-foreground">
            Cached podcast from {new Date(podcast.generated_at).toLocaleDateString()}
          </div>
        )}

        {/* Script section */}
        <Collapsible open={isScriptOpen} onOpenChange={setIsScriptOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
              <span>View Script</span>
              {isScriptOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 max-h-64 overflow-y-auto bg-muted/30 rounded-md p-3">
              <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">
                {podcast.script}
              </pre>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Regenerate button */}
        <Button
          onClick={onRegenerate}
          variant="ghost"
          size="sm"
          className="w-full text-xs"
        >
          <RefreshCw className="mr-2 h-3 w-3" />
          Regenerate Podcast
        </Button>
      </div>
    )
  }

  return null
}
