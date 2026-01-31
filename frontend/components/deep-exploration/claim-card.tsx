"use client"

import { Quote } from "lucide-react"

interface ClaimCardProps {
  claim: {
    id: string
    title: string
    timestamp: number
    description: string
    source: string
  }
  synthesis?: {
    claim_text: string
    speaker_stance: string
    claim_type: string
  }
  guest: string
  formatTime: (seconds: number) => string
}

function CornerBrackets({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      {/* Top-left corner */}
      <div className="absolute -top-px -left-px w-4 h-4 border-l border-t border-[var(--golden-chestnut)]/40" />
      {/* Top-right corner */}
      <div className="absolute -top-px -right-px w-4 h-4 border-r border-t border-[var(--golden-chestnut)]/40" />
      {/* Bottom-left corner */}
      <div className="absolute -bottom-px -left-px w-4 h-4 border-l border-b border-[var(--golden-chestnut)]/40" />
      {/* Bottom-right corner */}
      <div className="absolute -bottom-px -right-px w-4 h-4 border-r border-b border-[var(--golden-chestnut)]/40" />
      {children}
    </div>
  )
}

export function ClaimCard({ claim, synthesis, guest, formatTime }: ClaimCardProps) {
  return (
    <CornerBrackets className="relative overflow-hidden bg-gradient-to-br from-card to-background">
      <div className="blueprint-pattern" />
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Quote className="w-36 h-36" />
      </div>
      <div className="p-6 md:p-8 relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <span className="px-2 py-1 rounded-none bg-[var(--golden-chestnut)]/20 text-[var(--golden-chestnut)] text-xs font-bold uppercase tracking-wider border border-[var(--golden-chestnut)]/30 mono">
            {synthesis?.claim_type || "Claim"}
          </span>
          <span className="text-xs text-foreground/50 mono">
            @ {formatTime(claim.timestamp)}
          </span>
        </div>

        {/* Distilled claim as header */}
        <h1 className="display text-2xl md:text-3xl font-normal leading-tight mb-4 text-foreground">
          {claim.title}
        </h1>

        {/* Full quote from transcript */}
        {synthesis?.claim_text && synthesis.claim_text !== claim.title && (
          <p className="text-base text-foreground/80 leading-relaxed mb-6">
            "{synthesis.claim_text}"
          </p>
        )}

        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-[var(--golden-chestnut)]/20 flex items-center justify-center text-[var(--golden-chestnut)] text-sm font-bold">
            {guest.split(' ').map(n => n[0]).join('')}
          </div>
          <p className="text-sm font-medium text-foreground/80">
            {guest} • <span className="text-foreground/50">{synthesis?.speaker_stance || "assertion"}</span>
          </p>
        </div>
      </div>
    </CornerBrackets>
  )
}
