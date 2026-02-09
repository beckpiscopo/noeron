"use client"

import { Bookmark, Copy } from "lucide-react"

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
  showYear?: boolean
}

const TYPE_STYLES: Record<EvidenceType, { label: string; borderColor: string; badgeClass: string }> = {
  foundational: {
    label: "FOUNDATIONAL",
    borderColor: "border-l-[var(--evidence-foundational)]",
    badgeClass: "bg-[var(--evidence-foundational)] text-white",
  },
  supporting: {
    label: "SUPPORTING",
    borderColor: "border-l-[var(--evidence-supporting)]",
    badgeClass: "bg-[var(--evidence-supporting)] text-white",
  },
  direct: {
    label: "DIRECT EVIDENCE",
    borderColor: "border-l-[var(--evidence-direct)]",
    badgeClass: "bg-[var(--evidence-direct)] text-black",
  },
  speculative: {
    label: "SPECULATIVE",
    borderColor: "border-l-[var(--evidence-speculative)]",
    badgeClass: "bg-[var(--evidence-speculative)] text-white",
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
  showYear = true,
}: EvidenceCardProps) {
  const typeStyle = TYPE_STYLES[type]

  return (
    <div
      className={`group relative bg-card border-l-4 ${typeStyle.borderColor} p-5 transition-all hover:bg-card/80`}
      onClick={() => paperId && onViewPaper?.(paperId)}
      style={{ cursor: paperId && onViewPaper ? 'pointer' : 'default' }}
    >
      {/* Actions */}
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onBookmark?.() }}
          className="p-1.5 text-foreground/40 hover:text-foreground/70 transition-colors"
          title="Bookmark"
        >
          <Bookmark className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onCopy?.() }}
          className="p-1.5 text-foreground/40 hover:text-foreground/70 transition-colors"
          title="Copy citation"
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>

      {/* Year and Journal */}
      {(showYear || journal) && (
        <div className="mb-2 text-xs text-foreground/50">
          {showYear && year}{showYear && journal && " • "}{journal?.toUpperCase()}
        </div>
      )}

      {/* Title */}
      <h4 className="font-semibold text-lg text-foreground leading-snug mb-2">
        {title}
      </h4>

      {/* Description */}
      <p className="text-sm text-foreground/60 leading-relaxed mb-4">
        {description}
      </p>

      {/* Footer */}
      <div className="flex items-center gap-4 text-xs text-foreground/40">
        {citationCount !== undefined && (
          <span className="flex items-center gap-1">
            <span className="text-[var(--golden-chestnut)]">◆</span>
            {citationCount} Citations
          </span>
        )}
        {topics.length > 0 && topics.map((topic, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="text-[var(--golden-chestnut)]">•</span>
            {topic}
          </span>
        ))}
      </div>
    </div>
  )
}
