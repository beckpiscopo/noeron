"use client"

import { ExternalLink, Bookmark, Copy } from "lucide-react"

type EvidenceType = "foundational" | "supporting" | "direct" | "speculative"

interface EvidenceCardProps {
  type: EvidenceType
  year: number
  journal?: string
  title: string
  description: string
  citationCount?: number
  topics?: string[]
  paperId?: string
  onViewPaper?: (paperId: string) => void
  onBookmark?: () => void
  onCopy?: () => void
}

const TYPE_STYLES: Record<EvidenceType, { label: string; className: string }> = {
  foundational: {
    label: "FOUNDATIONAL",
    className: "bg-[var(--evidence-foundational-bg)] text-[var(--evidence-foundational)] border-[var(--evidence-foundational)]/30",
  },
  supporting: {
    label: "SUPPORTING",
    className: "bg-[var(--evidence-supporting-bg)] text-[var(--evidence-supporting)] border-[var(--evidence-supporting)]/30",
  },
  direct: {
    label: "DIRECT EVIDENCE",
    className: "bg-[var(--evidence-direct-bg)] text-[var(--evidence-direct)] border-[var(--evidence-direct)]/30",
  },
  speculative: {
    label: "SPECULATIVE",
    className: "bg-[var(--evidence-speculative-bg)] text-[var(--evidence-speculative)] border-[var(--evidence-speculative)]/30",
  },
}

export function EvidenceCard({
  type,
  year,
  journal,
  title,
  description,
  citationCount,
  topics = [],
  paperId,
  onViewPaper,
  onBookmark,
  onCopy,
}: EvidenceCardProps) {
  const typeStyle = TYPE_STYLES[type]

  return (
    <div className="group bg-card/50 hover:bg-card/80 border border-border/50 rounded-lg p-4 transition-all hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5">
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Evidence Type Badge */}
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${typeStyle.className}`}>
            {typeStyle.label}
          </span>
          {/* Year */}
          <span className="text-xs font-mono text-foreground/50">{year}</span>
          {/* Journal */}
          {journal && (
            <>
              <span className="text-foreground/30">•</span>
              <span className="text-xs text-foreground/50 uppercase tracking-wide">{journal}</span>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onBookmark && (
            <button
              onClick={onBookmark}
              className="p-1.5 text-foreground/40 hover:text-[var(--golden-chestnut)] transition-colors"
              title="Bookmark"
            >
              <Bookmark className="w-3.5 h-3.5" />
            </button>
          )}
          {onCopy && (
            <button
              onClick={onCopy}
              className="p-1.5 text-foreground/40 hover:text-[var(--golden-chestnut)] transition-colors"
              title="Copy citation"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Title */}
      <h4 className="font-medium text-sm text-foreground leading-snug mb-2">
        {title}
      </h4>

      {/* Description */}
      <p className="text-xs text-foreground/60 leading-relaxed mb-3">
        {description}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-foreground/40">
          {citationCount !== undefined && (
            <span>• {citationCount} Citations</span>
          )}
          {topics.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="text-[var(--golden-chestnut)]">◆</span>
              {topics.slice(0, 2).join(", ")}
            </span>
          )}
        </div>

        {paperId && onViewPaper && (
          <button
            onClick={() => onViewPaper(paperId)}
            className="text-xs text-[var(--golden-chestnut)] hover:underline flex items-center gap-1"
          >
            View Paper
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}
