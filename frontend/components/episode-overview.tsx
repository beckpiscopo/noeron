"use client"

import type React from "react"
import { useState, useMemo } from "react"
import {
  Play,
  Grid3X3,
  Star,
  ExternalLink,
  ChevronRight,
  Circle,
  Loader2,
  Search,
  Settings,
  HelpCircle
} from "lucide-react"
import { NoeronHeader } from "./noeron-header"
import { AIChatSidebar } from "./ai-chat"

// =============================================================================
// TYPES
// =============================================================================

interface EpisodeTheme {
  theme_name: string
  description: string
  timestamps: string
}

interface KeyMoment {
  timestamp: string
  description: string
  quote?: string
  significance?: string
}

interface GuestThesis {
  summary: string
  key_claims: string[]
}

interface ClaimDensityPoint {
  timestamp_ms: number
  density: number
  theme?: string
  label?: string // For peak labels like "PEAK: BIOELECTRICITY"
  keywords?: string[] // Top keywords from claims in this time bucket
}

interface ReferencePaper {
  title: string
  year: number
  type: "KEY PROTOCOL" | "Secondary Source" | "Foundational" | "Supporting"
  isPrimary?: boolean
  url?: string
}

export interface EpisodeOverviewData {
  id: string
  title: string
  podcast: string
  host: string
  guest: string
  duration: string
  durationSeconds: number
  date: string
  papersLinked: number
  totalClaims: number
  description?: string
  summary?: string
  major_themes?: EpisodeTheme[]
  key_moments?: KeyMoment[]
  guest_thesis?: GuestThesis
  claim_density?: ClaimDensityPoint[]
  reference_papers?: ReferencePaper[]
  isLoading?: boolean
}

interface EpisodeOverviewProps {
  episode: EpisodeOverviewData
  onStartListening: (timestamp?: number) => void
  onBack: () => void
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function parseTimestampToSeconds(timestamp: string): number {
  const parts = timestamp.split(":").map(Number)
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return 0
}

function formatTimecode(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

// =============================================================================
// CORNER BRACKET FRAME
// =============================================================================

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


// =============================================================================
// CONCEPT DENSITY ANALYSIS (Area Chart Style)
// =============================================================================

interface ConceptDensityProps {
  durationSeconds: number
  claimDensity: ClaimDensityPoint[]
  keyMoments: KeyMoment[]
  onSeek: (timestamp: number) => void
}

function ConceptDensityAnalysis({ durationSeconds, claimDensity, keyMoments, onSeek }: ConceptDensityProps) {
  const [hoveredTime, setHoveredTime] = useState<number | null>(null)

  // Find peaks in the density data
  const peaks = useMemo(() => {
    const sorted = [...claimDensity].sort((a, b) => b.density - a.density)
    return sorted.slice(0, 3).map(p => ({
      ...p,
      label: p.label || p.theme?.split(" ")[0]?.toUpperCase() || "DENSITY PEAK"
    }))
  }, [claimDensity])

  // Find the density point closest to the hovered time
  const hoveredPoint = useMemo(() => {
    if (hoveredTime === null || claimDensity.length === 0) return null
    const hoveredMs = hoveredTime * 1000
    let closest = claimDensity[0]
    let minDist = Math.abs(closest.timestamp_ms - hoveredMs)
    for (const point of claimDensity) {
      const dist = Math.abs(point.timestamp_ms - hoveredMs)
      if (dist < minDist) {
        minDist = dist
        closest = point
      }
    }
    return closest
  }, [hoveredTime, claimDensity])

  // Check if current hover is near a high-density region
  const isHighDensity = hoveredPoint !== null && hoveredPoint.density > 0.7

  // Generate SVG path for area chart
  const generatePath = () => {
    if (claimDensity.length === 0) return ""

    const width = 100
    const height = 100
    const points = claimDensity.map((p, i) => ({
      x: (p.timestamp_ms / (durationSeconds * 1000)) * width,
      y: height - (p.density * height * 0.8)
    }))

    // Create smooth curve
    let path = `M 0 ${height} L ${points[0]?.x || 0} ${points[0]?.y || height}`

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]
      const curr = points[i]
      const cpx = (prev.x + curr.x) / 2
      path += ` Q ${prev.x} ${prev.y} ${cpx} ${(prev.y + curr.y) / 2}`
    }

    if (points.length > 0) {
      const last = points[points.length - 1]
      path += ` L ${last.x} ${last.y} L ${width} ${height} Z`
    }

    return path
  }

  return (
    <CornerBrackets className="p-6 bg-card/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-[var(--golden-chestnut)] text-xs">✧</span>
          <span className="text-foreground/60 mono text-xs tracking-[0.2em] uppercase">
            Concept Density Analysis
          </span>
        </div>
        {isHighDensity && (
          <span className="px-2 py-1 bg-[var(--golden-chestnut)]/20 text-[var(--golden-chestnut)] mono text-[10px] tracking-wider">
            HIGH DENSITY DETECTED
          </span>
        )}
      </div>

      {/* Chart Container */}
      <div className="relative h-40 mt-6">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-8 w-10 flex flex-col justify-between text-[10px] mono text-foreground/30">
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>

        {/* Chart area */}
        <div
          className="absolute left-12 right-0 top-0 bottom-8 cursor-crosshair"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const x = (e.clientX - rect.left) / rect.width
            setHoveredTime(x * durationSeconds)
          }}
          onMouseLeave={() => setHoveredTime(null)}
          onClick={() => hoveredTime !== null && onSeek(hoveredTime)}
        >
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-full h-px bg-foreground/5" />
            ))}
          </div>

          {/* SVG Chart */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="densityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--golden-chestnut)" stopOpacity="0.6" />
                <stop offset="100%" stopColor="var(--golden-chestnut)" stopOpacity="0.05" />
              </linearGradient>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--golden-chestnut)" stopOpacity="0.3" />
                <stop offset="50%" stopColor="var(--golden-chestnut)" stopOpacity="1" />
                <stop offset="100%" stopColor="var(--golden-chestnut)" stopOpacity="0.3" />
              </linearGradient>
            </defs>

            {/* Area fill */}
            <path d={generatePath()} fill="url(#densityGradient)" />

            {/* Top line */}
            <path
              d={generatePath().replace(/L \d+ 100 Z$/, "")}
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="0.5"
            />
          </svg>

          {/* Peak labels */}
          {peaks.slice(0, 2).map((peak, idx) => {
            const x = (peak.timestamp_ms / (durationSeconds * 1000)) * 100
            return (
              <div
                key={idx}
                className="absolute transform -translate-x-1/2 pointer-events-none"
                style={{ left: `${x}%`, top: `${(1 - peak.density) * 80}%` }}
              >
                {/* Marker dot */}
                <div className="w-2 h-2 rounded-full bg-[var(--golden-chestnut)] shadow-[0_0_10px_var(--golden-chestnut)]" />
                {/* Label */}
                <div className="absolute left-4 -top-1 whitespace-nowrap">
                  <span className="text-[10px] mono text-[var(--golden-chestnut)] tracking-wider">
                    {idx === 0 ? "PEAK: " : "CRITICAL: "}{peak.label}
                  </span>
                </div>
              </div>
            )
          })}

          {/* Hover indicator */}
          {hoveredTime !== null && (
            <div
              className="absolute top-0 bottom-0 w-px bg-[var(--golden-chestnut)]/50 pointer-events-none"
              style={{ left: `${(hoveredTime / durationSeconds) * 100}%` }}
            >
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-3 py-2 bg-card border border-[var(--golden-chestnut)]/30 min-w-[100px]">
                <span className="mono text-[10px] text-[var(--golden-chestnut)] block text-center">
                  {formatTimecode(hoveredTime)}
                </span>
                {hoveredPoint?.keywords && hoveredPoint.keywords.length > 0 && (
                  <div className="mt-1.5 pt-1.5 border-t border-border/50">
                    <div className="flex flex-wrap gap-1 justify-center">
                      {hoveredPoint.keywords.map((keyword, i) => (
                        <span
                          key={i}
                          className="text-[9px] px-1.5 py-0.5 bg-[var(--golden-chestnut)]/10 text-foreground/70 rounded"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* X-axis labels */}
        <div className="absolute left-12 right-0 bottom-0 flex justify-between text-[10px] mono text-foreground/30">
          <span>00:00</span>
          <span>{formatTimecode(durationSeconds / 4)}</span>
          <span>{formatTimecode(durationSeconds / 2)}</span>
          <span>{formatTimecode((durationSeconds * 3) / 4)}</span>
          <span>{formatTimecode(durationSeconds)}</span>
        </div>
      </div>
    </CornerBrackets>
  )
}

// =============================================================================
// KEY MOMENTS (Clickable Timestamps)
// =============================================================================

interface KeyMomentsListProps {
  moments: KeyMoment[]
  onSeek: (timestamp: number) => void
}

function KeyMomentsList({ moments, onSeek }: KeyMomentsListProps) {
  return (
    <CornerBrackets className="p-6 bg-card/30">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-[var(--golden-chestnut)] text-xs">▷</span>
        <span className="text-foreground/60 mono text-xs tracking-[0.2em] uppercase">
          Key Moments
        </span>
      </div>

      {/* Moments list */}
      <div className="space-y-4">
        {moments.slice(0, 5).map((moment, idx) => (
          <button
            key={idx}
            onClick={() => onSeek(parseTimestampToSeconds(moment.timestamp))}
            className="w-full text-left group"
          >
            <div className="flex items-start gap-4 p-3 -mx-3 transition-colors hover:bg-[var(--golden-chestnut)]/5">
              {/* Timestamp */}
              <div className="flex items-center gap-2 shrink-0">
                <Play className="w-3 h-3 text-[var(--golden-chestnut)] opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="mono text-sm text-[var(--golden-chestnut)] tabular-nums">
                  [{moment.timestamp}]
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground/80 leading-relaxed line-clamp-2">
                  {moment.description}
                </p>
                {moment.quote && (
                  <p className="mt-2 text-xs text-foreground/40 italic line-clamp-1">
                    "{moment.quote.substring(0, 60)}..."
                  </p>
                )}
              </div>

              {/* Arrow */}
              <ChevronRight className="w-4 h-4 text-foreground/20 group-hover:text-[var(--golden-chestnut)] transition-colors shrink-0 mt-0.5" />
            </div>
          </button>
        ))}
      </div>
    </CornerBrackets>
  )
}

// =============================================================================
// REFERENCE MANIFEST (Papers Sidebar)
// =============================================================================

interface ReferenceManifestProps {
  papers: ReferencePaper[]
}

function ReferenceManifest({ papers }: ReferenceManifestProps) {
  return (
    <div className="border border-border/50 bg-card/20">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <Grid3X3 className="w-3 h-3 text-foreground/40" />
        <span className="text-foreground/50 mono text-[10px] tracking-[0.2em] uppercase">
          Reference Manifest
        </span>
      </div>

      {/* Papers list */}
      <div className="divide-y divide-border/30">
        {papers.map((paper, idx) => (
          <div
            key={idx}
            className="px-4 py-3 hover:bg-[var(--golden-chestnut)]/5 transition-colors cursor-pointer group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm text-foreground/80 font-medium leading-tight mb-1">
                  {paper.title}
                </h4>
                <div className="flex items-center gap-2">
                  <span className="mono text-[10px] text-foreground/40">{paper.year}</span>
                  <span className="text-[10px] text-[var(--golden-chestnut)]/70 uppercase tracking-wider">
                    {paper.type}
                  </span>
                </div>
              </div>
              {paper.isPrimary && (
                <Star className="w-3 h-3 text-[var(--golden-chestnut)] fill-current shrink-0" />
              )}
            </div>
            <p className="mt-2 text-xs text-foreground/40 leading-relaxed line-clamp-2">
              {/* We could add paper descriptions here */}
            </p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border/30 text-center">
        <button className="text-[10px] mono text-foreground/30 hover:text-[var(--golden-chestnut)] transition-colors tracking-wider uppercase">
          Access Full Bibliography
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// GUEST THESIS (Core Argument)
// =============================================================================

interface GuestThesisProps {
  guest: string
  thesis: GuestThesis
}

function GuestThesisCard({ guest, thesis }: GuestThesisProps) {
  return (
    <div className="border border-[var(--golden-chestnut)]/20 bg-gradient-to-b from-[var(--golden-chestnut)]/5 to-transparent">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--golden-chestnut)]/10">
        <Circle className="w-2 h-2 text-[var(--golden-chestnut)] fill-current" />
        <span className="text-foreground/50 mono text-[10px] tracking-[0.2em] uppercase">
          {guest}'s Core Thesis
        </span>
      </div>

      <div className="p-4">
        {/* Main thesis */}
        <p className="text-sm text-foreground/70 leading-relaxed mb-4">
          {thesis.summary}
        </p>

        {/* Key claims */}
        <div className="space-y-2">
          {thesis.key_claims.slice(0, 3).map((claim, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <span className="mono text-[10px] text-[var(--golden-chestnut)]">[{String(idx + 1).padStart(2, "0")}]</span>
              <p className="text-xs text-foreground/50 leading-relaxed">
                {claim}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// MAIN CTA BUTTON
// =============================================================================

interface BeginListeningProps {
  onStart: () => void
}

function BeginListeningCTA({ onStart }: BeginListeningProps) {
  return (
    <button
      onClick={onStart}
      className="w-full border border-[var(--golden-chestnut)] bg-[var(--golden-chestnut)]/10 hover:bg-[var(--golden-chestnut)]/20 transition-all group"
    >
      <div className="px-6 py-4">
        <div className="text-[10px] mono text-[var(--golden-chestnut)]/60 tracking-[0.2em] mb-1">
          READY FOR INGESTION
        </div>
        <div className="text-xl font-bold text-[var(--golden-chestnut)] tracking-wide mb-2">
          BEGIN LISTENING
        </div>
        <div className="flex items-center justify-center gap-2 text-foreground/40">
          <Play className="w-3 h-3 group-hover:text-[var(--golden-chestnut)] transition-colors" />
          <span className="text-[10px] mono tracking-wider group-hover:text-[var(--golden-chestnut)] transition-colors">
            INITIATE AUDIO STREAM
          </span>
        </div>
      </div>
    </button>
  )
}

// =============================================================================
// LOADING INDICATOR
// =============================================================================

function SummaryLoadingIndicator() {
  return (
    <CornerBrackets className="p-8 bg-card/30">
      <div className="flex flex-col items-center justify-center py-12">
        <div className="relative mb-6">
          <Loader2 className="w-8 h-8 text-[var(--golden-chestnut)] animate-spin" />
          <div className="absolute inset-0 w-8 h-8 rounded-full bg-[var(--golden-chestnut)]/20 animate-ping" />
        </div>
        <div className="text-center">
          <p className="mono text-xs text-[var(--golden-chestnut)] tracking-[0.2em] mb-2">
            GENERATING ANALYSIS
          </p>
          <p className="text-sm text-foreground/50">
            Gemini is analyzing the episode transcript...
          </p>
          <p className="text-xs text-foreground/30 mt-2">
            This may take 10-30 seconds
          </p>
        </div>
      </div>
    </CornerBrackets>
  )
}

// =============================================================================
// FOOTER
// =============================================================================

function TerminalFooter() {
  return (
    <footer className="flex items-center justify-between px-6 py-3 border-t border-border/30 bg-background/50">
      <div className="flex items-center gap-6 mono text-[10px] text-foreground/30 tracking-wider">
        <span>CALIBRATION: 0.9943</span>
        <span>NOISE FL: -92dB</span>
        <span>RENDER: GPU-04</span>
      </div>
      <div className="mono text-[10px] text-foreground/30 tracking-wider">
        NOERON SYSTEMS INC. © 2025
      </div>
    </footer>
  )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function EpisodeOverview({ episode, onStartListening, onBack }: EpisodeOverviewProps) {
  const [chatOpen, setChatOpen] = useState(true)
  const [chatWidth, setChatWidth] = useState(440)

  // Header action buttons
  const iconButtonClasses =
    "flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition hover:text-foreground"
  const headerActions = (
    <>
      <button className={iconButtonClasses}>
        <Search className="h-4 w-4" />
      </button>
      <button className={iconButtonClasses}>
        <Settings className="h-4 w-4" />
      </button>
      <button className={iconButtonClasses}>
        <HelpCircle className="h-4 w-4" />
      </button>
    </>
  )

  // Use real claim density data or empty array (no fake data)
  const claimDensity = episode.claim_density || []
  const hasClaimData = claimDensity.length > 0

  // Default guest thesis
  const guestThesis: GuestThesis = episode.guest_thesis || {
    summary: "Biological systems exhibit remarkable intelligence and problem-solving ability not solely determined by genetic makeup. Bioelectricity plays a crucial role in coordinating cellular behavior and shaping anatomical structures.",
    key_claims: [
      "Intelligence is distributed throughout the body, found in cells, tissues, and organs.",
      "Bioelectricity is a privileged computational layer accessing basal cognition.",
      "Evolution produces problem-solving machines capable of navigating different spaces.",
    ]
  }

  // Default reference papers
  const referencePapers: ReferencePaper[] = episode.reference_papers || [
    { title: "Endogenous Bioelectric Signals", year: 2023, type: "KEY PROTOCOL", isPrimary: true },
    { title: "Synthetic Morphology", year: 2021, type: "Secondary Source" },
    { title: "The Computational Boundary", year: 2019, type: "Foundational" },
  ]

  const handleSeek = (timestamp: number) => {
    onStartListening(timestamp)
  }

  // Extract episode number from ID
  const episodeNumber = episode.id.match(/\d+/)?.[0] || "001"

  return (
    <div className="noeron-theme min-h-screen bg-background text-foreground flex flex-col">
      <NoeronHeader actions={headerActions} onLogoClick={() => window.location.assign("/")} />

      <main
        className="flex-1 px-6 py-8 max-w-[1400px] mx-auto w-full transition-all duration-300 ease-in-out"
        style={{ marginRight: `${chatWidth}px` }}
      >
        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
          {/* Left Column - Main Content */}
          <div className="space-y-8">
            {/* Episode Header Card */}
            <CornerBrackets className="p-8 bg-card/30">
              {/* Episode Badge & Ref */}
              <div className="flex items-center justify-between mb-6">
                <span className="mono text-[10px] text-foreground/40 tracking-[0.15em] px-2 py-1 border border-foreground/20">
                  EPISODE #{episodeNumber} // CLASSIFIED: PUBLIC
                </span>
                <span className="mono text-[10px] text-foreground/30 tracking-wider">
                  REF: {episode.id.toUpperCase().replace("_", "-")}
                </span>
              </div>

              {/* Title */}
              <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight leading-tight mb-8">
                {episode.title.split(" ").slice(0, 4).join(" ").toUpperCase()}
                <br />
                <span className="text-foreground/60">
                  & {episode.title.split(" ").slice(4).join(" ").toUpperCase() || "MORPHOGENESIS"}
                </span>
              </h1>

              {/* Metadata Row */}
              <div className="grid grid-cols-3 gap-8 pt-6 border-t border-border/30">
                <div>
                  <div className="mono text-[10px] text-foreground/40 tracking-[0.15em] mb-1">GUEST SUBJ.</div>
                  <div className="text-sm font-medium text-foreground">{episode.guest.toUpperCase()}</div>
                </div>
                <div>
                  <div className="mono text-[10px] text-foreground/40 tracking-[0.15em] mb-1">HOST INTERFACE</div>
                  <div className="text-sm font-medium text-foreground">{episode.host.toUpperCase()}</div>
                </div>
                <div>
                  <div className="mono text-[10px] text-foreground/40 tracking-[0.15em] mb-1">TEMPORAL LENGTH</div>
                  <div className="text-sm font-medium text-foreground mono">{episode.duration.replace("h", "h ").replace("m", "m 00s")}</div>
                </div>
              </div>

              {/* Description */}
              <p className="mt-6 text-sm text-foreground/50 leading-relaxed">
                {episode.description || `An investigation into the software of life. ${episode.guest} discusses morphogenesis, bioelectricity, and the collective intelligence of cells. This briefing dissects the underlying code that governs biological shape and the potential for regenerative medicine.`}
              </p>
            </CornerBrackets>

            {/* Show loading state or content */}
            {episode.isLoading ? (
              <SummaryLoadingIndicator />
            ) : (
              <>
                {/* Concept Density Analysis - only show if we have claim data */}
                {hasClaimData ? (
                  <ConceptDensityAnalysis
                    durationSeconds={episode.durationSeconds}
                    claimDensity={claimDensity}
                    keyMoments={episode.key_moments || []}
                    onSeek={handleSeek}
                  />
                ) : (
                  <CornerBrackets className="p-6 bg-card/30">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-[var(--golden-chestnut)] text-xs">✧</span>
                        <span className="text-foreground/60 mono text-xs tracking-[0.2em] uppercase">
                          Concept Density Analysis
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-center py-12 text-foreground/30">
                      <p className="mono text-xs">No claim data available for this episode</p>
                    </div>
                  </CornerBrackets>
                )}

                {/* Key Moments */}
                {episode.key_moments && episode.key_moments.length > 0 && (
                  <KeyMomentsList
                    moments={episode.key_moments}
                    onSeek={handleSeek}
                  />
                )}
              </>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Begin Listening CTA */}
            <BeginListeningCTA onStart={() => onStartListening()} />

            {/* Browse Research Stream button */}
            <button
              onClick={() => onStartListening()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-border hover:border-[var(--golden-chestnut)]/30 transition-colors"
            >
              <Grid3X3 className="w-4 h-4 text-foreground/40" />
              <span className="mono text-xs text-foreground/60 tracking-wider">
                BROWSE RESEARCH STREAM
              </span>
            </button>

            {/* Reference Manifest */}
            <ReferenceManifest papers={referencePapers} />

            {/* Guest Thesis */}
            <GuestThesisCard guest={episode.guest} thesis={guestThesis} />
          </div>
        </div>
      </main>

      <TerminalFooter />

      {/* AI Chat Sidebar */}
      <AIChatSidebar
        open={chatOpen}
        onOpenChange={setChatOpen}
        onWidthChange={setChatWidth}
        context={{
          episode_id: episode.id,
          episode_title: episode.title,
          guest: episode.guest,
        }}
      />
    </div>
  )
}
