"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { Bookmark, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useBookmarks } from '@/hooks/use-bookmarks'

interface SnippetBookmarkOverlayProps {
  episodeId: string
  currentTimeMs: number
  containerRef?: React.RefObject<HTMLElement>
}

export function SnippetBookmarkOverlay({
  episodeId,
  currentTimeMs,
  containerRef,
}: SnippetBookmarkOverlayProps) {
  const { addSnippetBookmark } = useBookmarks()
  const [selection, setSelection] = useState<{
    text: string
    rect: DOMRect
  } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  const handleSelection = useCallback(() => {
    const sel = window.getSelection()
    if (sel && sel.toString().trim().length > 10) {
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()

      // Only show overlay if selection is within the container (if provided)
      if (containerRef?.current) {
        const containerRect = containerRef.current.getBoundingClientRect()
        const isWithinContainer =
          rect.top >= containerRect.top &&
          rect.bottom <= containerRect.bottom &&
          rect.left >= containerRect.left &&
          rect.right <= containerRect.right

        if (!isWithinContainer) {
          setSelection(null)
          return
        }
      }

      setSelection({
        text: sel.toString().trim(),
        rect,
      })
    } else {
      setSelection(null)
    }
  }, [containerRef])

  // Handle mouse up for text selection
  useEffect(() => {
    document.addEventListener('mouseup', handleSelection)
    return () => document.removeEventListener('mouseup', handleSelection)
  }, [handleSelection])

  // Handle click outside to dismiss
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        // Don't dismiss if clicking on a selection
        const sel = window.getSelection()
        if (sel && sel.toString().trim().length > 10) return
        setSelection(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSaveSnippet = async () => {
    if (!selection) return

    setIsSaving(true)
    try {
      // Estimate time range based on current playback position
      // In a more advanced version, you'd use word-level timing data
      const estimatedDurationMs = Math.max(5000, selection.text.split(' ').length * 300)
      const estimatedStartMs = Math.max(0, currentTimeMs - estimatedDurationMs / 2)
      const estimatedEndMs = currentTimeMs + estimatedDurationMs / 2

      await addSnippetBookmark(episodeId, selection.text, estimatedStartMs, estimatedEndMs)

      // Clear selection
      setSelection(null)
      window.getSelection()?.removeAllRanges()
    } finally {
      setIsSaving(false)
    }
  }

  const handleDismiss = () => {
    setSelection(null)
    window.getSelection()?.removeAllRanges()
  }

  if (!selection) return null

  // Calculate position for overlay
  const overlayLeft = Math.max(
    10,
    Math.min(
      selection.rect.left + selection.rect.width / 2 - 70,
      window.innerWidth - 160
    )
  )
  const overlayTop = selection.rect.bottom + 8

  return (
    <div
      ref={overlayRef}
      className="fixed z-[100] flex items-center gap-2 bg-card border border-border shadow-lg p-2"
      style={{
        left: overlayLeft,
        top: overlayTop,
      }}
    >
      <Button
        size="sm"
        onClick={handleSaveSnippet}
        disabled={isSaving}
        className="!rounded-none !bg-[var(--golden-chestnut)] !text-background hover:!bg-[var(--golden-chestnut)]/90 disabled:opacity-50"
      >
        {isSaving ? (
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        ) : (
          <Bookmark className="w-3 h-3 mr-1" />
        )}
        Save Snippet
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleDismiss}
        className="!rounded-none !p-1.5 !h-auto text-foreground/50 hover:text-foreground"
      >
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  )
}
