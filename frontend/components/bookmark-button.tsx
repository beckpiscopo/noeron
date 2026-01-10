"use client"

import { useState } from 'react'
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useBookmarks } from '@/hooks/use-bookmarks'
import type { Claim, Paper, BookmarkType } from '@/lib/supabase'

interface BookmarkButtonProps {
  type: BookmarkType
  item: Claim | Paper
  episodeId?: string  // Episode ID for notebook grouping
  size?: 'sm' | 'default' | 'lg' | 'icon'
  variant?: 'default' | 'ghost' | 'outline'
  showLabel?: boolean
  className?: string
}

export function BookmarkButton({
  type,
  item,
  episodeId,
  size = 'sm',
  variant = 'ghost',
  showLabel = false,
  className = '',
}: BookmarkButtonProps) {
  const { isItemBookmarked, toggleBookmark } = useBookmarks()
  const [isLoading, setIsLoading] = useState(false)

  const itemId = type === 'claim' ? (item as Claim).id : (item as Paper).paper_id
  const isBookmarked = isItemBookmarked(type, itemId)

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setIsLoading(true)
    try {
      await toggleBookmark(type, item, episodeId)
    } finally {
      setIsLoading(false)
    }
  }

  const Icon = isLoading ? Loader2 : isBookmarked ? BookmarkCheck : Bookmark

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading}
      size={size}
      variant={variant}
      className={`
        !rounded-none transition-all
        ${
          isBookmarked
            ? '!text-[var(--golden-chestnut)] !bg-[var(--golden-chestnut)]/10 hover:!bg-[var(--golden-chestnut)]/20'
            : '!text-foreground/50 hover:!text-[var(--golden-chestnut)] hover:!bg-[var(--golden-chestnut)]/5'
        }
        ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      title={isBookmarked ? 'Remove from saved' : 'Save to library'}
    >
      <Icon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''} ${showLabel ? 'mr-1.5' : ''}`} />
      {showLabel && (isBookmarked ? 'Saved' : 'Save')}
    </Button>
  )
}

// Simplified bookmark button for claim cards (uses frontend Claim type)
interface ClaimBookmarkButtonProps {
  claim: {
    id: string | number
    claim_text?: string
    distilled_claim?: string
    podcast_id?: string  // Episode ID from claim data
  }
  episodeId?: string  // Explicit episode ID override
  size?: 'sm' | 'default' | 'lg' | 'icon'
  variant?: 'default' | 'ghost' | 'outline'
  showLabel?: boolean
  className?: string
}

export function ClaimBookmarkButton({
  claim,
  episodeId,
  size = 'sm',
  variant = 'ghost',
  showLabel = false,
  className = '',
}: ClaimBookmarkButtonProps) {
  const { isItemBookmarked, addClaimBookmark, removeBookmark, bookmarks } = useBookmarks()
  const [isLoading, setIsLoading] = useState(false)

  // Convert string ID to number if needed for comparison
  const claimId = typeof claim.id === 'string' ? parseInt(claim.id, 10) : claim.id
  const isBookmarked = isItemBookmarked('claim', claimId)

  // Use explicit episodeId prop, or fall back to claim's podcast_id
  const effectiveEpisodeId = episodeId || claim.podcast_id

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setIsLoading(true)
    try {
      if (isBookmarked) {
        // Find and remove the bookmark
        const bookmark = bookmarks.find((b) => b.claim_id === claimId)
        if (bookmark) {
          await removeBookmark(bookmark.id)
        }
      } else {
        // Create a minimal Claim object for the bookmark
        await addClaimBookmark({
          id: claimId,
          podcast_id: effectiveEpisodeId || '',
          claim_text: claim.claim_text || '',
          distilled_claim: claim.distilled_claim,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, effectiveEpisodeId)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const Icon = isLoading ? Loader2 : isBookmarked ? BookmarkCheck : Bookmark

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading}
      size={size}
      variant={variant}
      className={`
        !rounded-none transition-all
        ${
          isBookmarked
            ? '!text-[var(--golden-chestnut)] !bg-[var(--golden-chestnut)]/10 hover:!bg-[var(--golden-chestnut)]/20'
            : '!text-foreground/50 hover:!text-[var(--golden-chestnut)] hover:!bg-[var(--golden-chestnut)]/5'
        }
        ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      title={isBookmarked ? 'Remove from saved' : 'Save to library'}
    >
      <Icon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''} ${showLabel ? 'mr-1.5' : ''}`} />
      {showLabel && (isBookmarked ? 'Saved' : 'Save')}
    </Button>
  )
}
