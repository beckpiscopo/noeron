'use client'

import { useState, useEffect, useRef } from 'react'
import { Play, Pause, RotateCcw, RotateCw, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CompactPlayerProps {
  isPlaying: boolean
  currentTime: number
  duration: number
  episodeTitle: string
  onPlayPause: () => void
  onSeek: (time: number) => void
  onSkipBack: () => void
  onSkipForward: () => void
}

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function CompactPlayer({
  isPlaying,
  currentTime,
  duration,
  episodeTitle,
  onPlayPause,
  onSeek,
  onSkipBack,
  onSkipForward,
}: CompactPlayerProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSeeking, setIsSeeking] = useState(false)
  const progressRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLDivElement>(null)
  const [shouldScroll, setShouldScroll] = useState(false)

  const safeDuration = Math.max(duration, 1)
  const progressPercentage = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100))

  // Check if title needs marquee scrolling
  useEffect(() => {
    if (titleRef.current && isExpanded) {
      const isOverflowing = titleRef.current.scrollWidth > titleRef.current.clientWidth
      setShouldScroll(isOverflowing)
    }
  }, [isExpanded, episodeTitle])

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return
    const rect = progressRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    const newTime = percentage * safeDuration
    onSeek(Math.max(0, Math.min(safeDuration, newTime)))
  }

  const handleProgressTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!progressRef.current) return
    const rect = progressRef.current.getBoundingClientRect()
    const touch = e.touches[0]
    const x = touch.clientX - rect.left
    const percentage = x / rect.width
    const newTime = percentage * safeDuration
    onSeek(Math.max(0, Math.min(safeDuration, newTime)))
  }

  const handleCollapsedAreaClick = (e: React.MouseEvent) => {
    // Don't expand if clicking play button or progress bar
    const target = e.target as HTMLElement
    if (target.closest('[data-play-button]') || target.closest('[data-progress-bar]')) {
      return
    }
    setIsExpanded(true)
  }

  return (
    <div
      className={cn(
        "sticky top-[48px] z-40 bg-background border-b border-border transition-all duration-200 ease-out",
        isExpanded ? "py-4" : "py-2"
      )}
    >
      {/* Collapsed state */}
      {!isExpanded && (
        <div
          className="px-4 cursor-pointer"
          onClick={handleCollapsedAreaClick}
        >
          {/* Episode title - always visible */}
          <p className="text-xs font-medium text-foreground truncate mb-2 pr-6">
            {episodeTitle}
          </p>

          {/* Player controls row */}
          <div className="flex items-center gap-3">
            {/* Play/Pause button */}
            <button
              data-play-button
              onClick={(e) => {
                e.stopPropagation()
                onPlayPause()
              }}
              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-[var(--golden-chestnut)] text-background"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" fill="currentColor" />
              ) : (
                <Play className="w-4 h-4 translate-x-0.5" fill="currentColor" />
              )}
            </button>

            {/* Progress bar */}
            <div
              ref={progressRef}
              data-progress-bar
              className="flex-1 h-1.5 bg-foreground/10 rounded-full cursor-pointer relative"
              onClick={(e) => {
                e.stopPropagation()
                handleProgressClick(e)
              }}
              onTouchMove={handleProgressTouch}
            >
              <div
                className="absolute inset-y-0 left-0 bg-[var(--golden-chestnut)] rounded-full"
                style={{ width: `${progressPercentage}%` }}
              />
              {/* Scrubber handle */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-[var(--golden-chestnut)] rounded-full shadow-md"
                style={{ left: `calc(${progressPercentage}% - 5px)` }}
              />
            </div>

            {/* Timestamp */}
            <span className="shrink-0 text-[10px] mono text-foreground/60 w-10 text-right">
              {formatTime(currentTime)}
            </span>

            {/* Expand indicator */}
            <ChevronUp className="w-4 h-4 text-foreground/40 shrink-0" />
          </div>
        </div>
      )}

      {/* Expanded state */}
      {isExpanded && (
        <div className="px-4">
          {/* Collapse button / handle */}
          <button
            onClick={() => setIsExpanded(false)}
            className="w-full flex justify-center pb-2 text-foreground/40 hover:text-foreground/60 transition-colors"
          >
            <ChevronDown className="w-5 h-5" />
          </button>

          {/* Episode title with marquee */}
          <div className="overflow-hidden mb-4">
            <div
              ref={titleRef}
              className={cn(
                "text-sm font-medium text-foreground text-center whitespace-nowrap",
                shouldScroll && "animate-marquee"
              )}
            >
              {episodeTitle}
            </div>
          </div>

          {/* Centered playback controls */}
          <div className="flex items-center justify-center gap-6 mb-4">
            {/* Skip back 15s */}
            <button
              onClick={onSkipBack}
              className="relative w-12 h-12 flex items-center justify-center text-foreground/60 hover:text-foreground transition-colors"
            >
              <RotateCcw className="w-7 h-7" />
              <span className="absolute text-[10px] font-bold">15</span>
            </button>

            {/* Play/Pause */}
            <button
              onClick={onPlayPause}
              className="w-14 h-14 flex items-center justify-center rounded-full bg-[var(--golden-chestnut)] text-background shadow-lg hover:scale-105 transition-transform"
            >
              {isPlaying ? (
                <Pause className="w-7 h-7" fill="currentColor" />
              ) : (
                <Play className="w-7 h-7 translate-x-0.5" fill="currentColor" />
              )}
            </button>

            {/* Skip forward 15s */}
            <button
              onClick={onSkipForward}
              className="relative w-12 h-12 flex items-center justify-center text-foreground/60 hover:text-foreground transition-colors"
            >
              <RotateCw className="w-7 h-7" />
              <span className="absolute text-[10px] font-bold">15</span>
            </button>
          </div>

          {/* Full progress bar */}
          <div
            ref={!isExpanded ? undefined : progressRef}
            className="h-2 bg-foreground/10 rounded-full cursor-pointer relative mb-2"
            onClick={handleProgressClick}
            onTouchMove={handleProgressTouch}
          >
            <div
              className="absolute inset-y-0 left-0 bg-[var(--golden-chestnut)] rounded-full"
              style={{ width: `${progressPercentage}%` }}
            />
            {/* Scrubber handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[var(--golden-chestnut)] rounded-full shadow-md border-2 border-background"
              style={{ left: `calc(${progressPercentage}% - 8px)` }}
            />
          </div>

          {/* Time display */}
          <div className="flex justify-between text-xs mono text-foreground/50">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      )}

      {/* Marquee animation styles */}
      <style jsx>{`
        @keyframes marquee {
          0%, 20% {
            transform: translateX(0);
          }
          80%, 100% {
            transform: translateX(calc(-100% + 100vw - 32px));
          }
        }
        .animate-marquee {
          animation: marquee 8s linear infinite alternate;
        }
      `}</style>
    </div>
  )
}
