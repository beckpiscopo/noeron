'use client'

import { Drawer as DrawerPrimitive } from 'vaul'
import { Bookmark, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export interface Claim {
  id: string | number
  timestamp: number
  segment_claim_id?: string
  claim_text?: string
  distilled_claim?: string
  confidence_score?: number
  start_ms?: number
  end_ms?: number
  category?: string
}

interface ClaimPreviewSheetProps {
  claim: Claim | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onJumpTo: (claim: Claim) => void
  onDiveDeeper: (claimId: string | number) => void
  onBookmark?: (claim: Claim) => void
  isBookmarked?: boolean
}

function formatTimestamp(claim: Claim): string {
  if (claim.start_ms) {
    const seconds = claim.start_ms / 1000
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  if (claim.timestamp) {
    const mins = Math.floor(claim.timestamp / 60)
    const secs = Math.floor(claim.timestamp % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  return '0:00'
}

function getClaimDisplayText(claim: Claim): string {
  return claim.distilled_claim || claim.claim_text || 'Unknown claim'
}

function getClaimFullText(claim: Claim): string {
  return claim.claim_text || ''
}

export function ClaimPreviewSheet({
  claim,
  open,
  onOpenChange,
  onJumpTo,
  onDiveDeeper,
  onBookmark,
  isBookmarked = false,
}: ClaimPreviewSheetProps) {
  if (!claim) return null

  const timestamp = formatTimestamp(claim)
  const displayText = getClaimDisplayText(claim)
  const fullText = getClaimFullText(claim)
  const hasDistilledClaim = !!claim.distilled_claim

  const handleJumpTo = () => {
    onJumpTo(claim)
    onOpenChange(false)
  }

  const handleDiveDeeper = () => {
    onDiveDeeper(claim.id)
    onOpenChange(false)
  }

  return (
    <DrawerPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <DrawerPrimitive.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex flex-col bg-background rounded-t-xl border-t border-border",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            "max-h-[50vh]"
          )}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1.5 rounded-full bg-muted-foreground/20" />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {/* Top row: Category + Timestamp + Bookmark */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[var(--golden-chestnut)] uppercase tracking-wider">
                  {claim.category || 'Scientific Claim'}
                </span>
                <span className="text-xs text-foreground/40">•</span>
                <span className="text-xs text-foreground/50 mono">
                  {timestamp}
                </span>
              </div>
              {onBookmark && (
                <button
                  onClick={() => onBookmark(claim)}
                  className={cn(
                    "p-2 -mr-2 transition-colors",
                    isBookmarked
                      ? "text-[var(--golden-chestnut)]"
                      : "text-foreground/40 hover:text-[var(--golden-chestnut)]"
                  )}
                >
                  <Bookmark
                    className="w-5 h-5"
                    fill={isBookmarked ? "currentColor" : "none"}
                  />
                </button>
              )}
            </div>

            {/* Distilled claim - hero text */}
            <h3 className="text-lg font-medium text-foreground mb-3 leading-snug">
              {displayText}
            </h3>

            {/* Full transcript quote */}
            {hasDistilledClaim && fullText && fullText !== displayText && (
              <p className="text-sm text-foreground/60 leading-relaxed mb-4 italic">
                "{fullText}"
              </p>
            )}

            {/* Confidence score */}
            {claim.confidence_score !== undefined && (
              <div className="flex items-center gap-2 mb-6">
                <span className="text-xs text-foreground/50 uppercase tracking-wider">
                  Confidence:
                </span>
                <span className="text-xs font-bold text-[var(--golden-chestnut)] mono">
                  {Math.round(claim.confidence_score * 100)}%
                </span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleJumpTo}
                variant="outline"
                className="flex-1 gap-2 !rounded-none !border-border hover:!border-[var(--golden-chestnut)]/50 hover:!bg-[var(--golden-chestnut)]/5"
              >
                <Clock className="w-4 h-4" />
                Jump to {timestamp}
              </Button>
              <Button
                onClick={handleDiveDeeper}
                className="flex-1 !rounded-none !bg-transparent !border !border-[var(--golden-chestnut)] !text-[var(--golden-chestnut)] hover:!bg-[var(--golden-chestnut)]/10"
              >
                Dive Deeper
              </Button>
            </div>
          </div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  )
}
