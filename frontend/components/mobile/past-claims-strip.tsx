'use client'

import { cn } from '@/lib/utils'

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

interface PastClaimsListProps {
  claims: Claim[]
  onClaimClick: (claim: Claim) => void
  onViewAllClick: () => void
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

export function PastClaimsStrip({
  claims,
  onClaimClick,
  onViewAllClick,
}: PastClaimsListProps) {
  if (claims.length === 0) {
    return null
  }

  return (
    <div className="mt-2 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 py-2 border-b border-border">
        <span className="text-xs font-bold text-foreground/70 uppercase tracking-wide">
          Past Claims
        </span>
        <span className="text-xs text-foreground/40 mono">
          {claims.length} {claims.length === 1 ? 'claim' : 'claims'}
        </span>
      </div>

      {/* Vertical scrollable list */}
      <div className="space-y-2">
        {claims.map((claim) => (
          <button
            key={claim.id}
            onClick={() => onClaimClick(claim)}
            className={cn(
              "w-full p-3 text-left",
              "border border-border bg-card/30 rounded-lg",
              "hover:border-[var(--golden-chestnut)]/40 hover:bg-[var(--golden-chestnut)]/5",
              "transition-colors active:scale-[0.98]"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              {/* Claim text */}
              <p className="text-sm text-foreground leading-snug line-clamp-2 flex-1">
                {getClaimDisplayText(claim)}
              </p>

              {/* Timestamp */}
              <span className="text-[10px] mono text-foreground/40 shrink-0 mt-0.5">
                {formatTimestamp(claim)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
