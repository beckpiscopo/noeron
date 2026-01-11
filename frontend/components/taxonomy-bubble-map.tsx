"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Loader2, Info } from "lucide-react"
import type {
  ClusterNode,
  ClusterBubbleMapData,
  EpisodeNotebookComparison
} from "@/lib/supabase"
import {
  getClusterBubbleMapData,
  compareEpisodeToNotebook
} from "@/lib/supabase"

interface TaxonomyBubbleMapProps {
  /**
   * Highlight mode:
   * - "none": No highlighting, show all clusters equally
   * - "episode": Highlight clusters covered by the episode
   * - "notebook": Highlight clusters with user's saved items
   * - "comparison": Show episode vs notebook comparison
   */
  highlightMode?: "none" | "episode" | "notebook" | "comparison"

  /** Episode ID for episode/comparison modes */
  episodeId?: string

  /** Callback when a cluster is clicked */
  onClusterClick?: (clusterId: number) => void

  /** Callback when hovering over a cluster */
  onClusterHover?: (clusterId: number | null) => void

  /** Width of the visualization */
  width?: number

  /** Height of the visualization */
  height?: number

  /** Additional CSS classes */
  className?: string

  /** Show legend */
  showLegend?: boolean
}

interface ClusterWithHighlight extends ClusterNode {
  isInEpisode?: boolean
  isInNotebook?: boolean
}

export function TaxonomyBubbleMap({
  highlightMode = "none",
  episodeId,
  onClusterClick,
  onClusterHover,
  width = 600,
  height = 400,
  className = "",
  showLegend = true
}: TaxonomyBubbleMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [clusters, setClusters] = useState<ClusterWithHighlight[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredCluster, setHoveredCluster] = useState<ClusterWithHighlight | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  // Load cluster data
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const mapData = await getClusterBubbleMapData()
        let nodes: ClusterWithHighlight[] = mapData.nodes

        // If comparison mode, fetch additional highlighting data
        if (highlightMode === "comparison" && episodeId) {
          const comparison = await compareEpisodeToNotebook(episodeId)

          const episodeClusters = new Set(
            comparison.all
              .filter(c => c.in_episode)
              .map(c => c.cluster_id)
          )
          const notebookClusters = new Set(
            comparison.all
              .filter(c => c.in_notebook)
              .map(c => c.cluster_id)
          )

          nodes = nodes.map(n => ({
            ...n,
            isInEpisode: episodeClusters.has(n.cluster_id),
            isInNotebook: notebookClusters.has(n.cluster_id)
          }))
        }

        setClusters(nodes)
      } catch (err) {
        console.error("Failed to load cluster map:", err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [highlightMode, episodeId])

  // Calculate bubble positions and sizes
  const getClusterVisuals = useCallback((cluster: ClusterWithHighlight) => {
    const padding = 50
    const maxSize = Math.max(...clusters.map(c => c.size), 1)

    // Scale position from 0-1 to canvas coordinates
    const x = padding + cluster.x * (width - padding * 2)
    const y = padding + cluster.y * (height - padding * 2)

    // Scale size based on paper count (min 15, max 60)
    const radius = 15 + (cluster.size / maxSize) * 45

    // Determine color based on highlight mode
    let fillColor = "rgba(180, 119, 86, 0.3)" // Default: golden-chestnut with low opacity
    let strokeColor = "rgba(180, 119, 86, 0.5)"
    let textColor = "rgba(255, 255, 255, 0.8)"

    if (highlightMode === "comparison") {
      if (cluster.isInEpisode && cluster.isInNotebook) {
        // Overlapping - bright
        fillColor = "rgba(180, 119, 86, 0.7)"
        strokeColor = "rgba(180, 119, 86, 1)"
        textColor = "rgba(255, 255, 255, 1)"
      } else if (cluster.isInEpisode) {
        // In episode only - new territory
        fillColor = "rgba(180, 119, 86, 0.4)"
        strokeColor = "rgba(180, 119, 86, 0.8)"
        textColor = "rgba(255, 255, 255, 0.9)"
      } else {
        // Not in episode - dim
        fillColor = "rgba(100, 100, 100, 0.15)"
        strokeColor = "rgba(150, 150, 150, 0.3)"
        textColor = "rgba(200, 200, 200, 0.5)"
      }
    }

    // Hover effect
    if (hoveredCluster?.cluster_id === cluster.cluster_id) {
      strokeColor = "rgba(255, 255, 255, 0.9)"
    }

    return { x, y, radius, fillColor, strokeColor, textColor }
  }, [clusters, width, height, highlightMode, hoveredCluster])

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || clusters.length === 0) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set up for high DPI displays
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw clusters
    for (const cluster of clusters) {
      const { x, y, radius, fillColor, strokeColor, textColor } = getClusterVisuals(cluster)

      // Draw bubble
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fillStyle = fillColor
      ctx.fill()
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = hoveredCluster?.cluster_id === cluster.cluster_id ? 2 : 1
      ctx.stroke()

      // Draw label (if radius is big enough)
      if (radius > 20) {
        ctx.fillStyle = textColor
        ctx.font = `${Math.min(11, radius / 3)}px "IBM Plex Mono", monospace`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"

        // Truncate label if too long
        const maxChars = Math.floor(radius / 4)
        let label = cluster.label
        if (label.length > maxChars) {
          label = label.substring(0, maxChars - 1) + "..."
        }

        ctx.fillText(label, x, y)
      }

      // Draw paper count below
      ctx.fillStyle = textColor
      ctx.font = '9px "IBM Plex Mono", monospace'
      ctx.fillText(`${cluster.size}`, x, y + radius + 10)
    }
  }, [clusters, width, height, getClusterVisuals, hoveredCluster])

  // Mouse interaction
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setMousePos({ x, y })

    // Find hovered cluster
    let found: ClusterWithHighlight | null = null
    for (const cluster of clusters) {
      const visuals = getClusterVisuals(cluster)
      const dist = Math.sqrt(
        Math.pow(x - visuals.x, 2) + Math.pow(y - visuals.y, 2)
      )
      if (dist <= visuals.radius) {
        found = cluster
        break
      }
    }

    setHoveredCluster(found)
    onClusterHover?.(found?.cluster_id ?? null)
  }, [clusters, getClusterVisuals, onClusterHover])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hoveredCluster) {
      onClusterClick?.(hoveredCluster.cluster_id)
    }
  }, [hoveredCluster, onClusterClick])

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center bg-card/30 border border-border/30 ${className}`}
        style={{ width, height }}
      >
        <Loader2 className="h-6 w-6 animate-spin text-foreground/50" />
        <span className="ml-2 text-sm text-foreground/50">Loading taxonomy map...</span>
      </div>
    )
  }

  if (clusters.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-card/30 border border-border/30 ${className}`}
        style={{ width, height }}
      >
        <span className="text-sm text-foreground/50">No taxonomy data available</span>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width, height, cursor: hoveredCluster ? "pointer" : "default" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          setHoveredCluster(null)
          onClusterHover?.(null)
        }}
        onClick={handleClick}
        className="bg-card/20 border border-border/30"
      />

      {/* Tooltip */}
      {hoveredCluster && (
        <div
          className="absolute z-10 bg-card border border-border p-3 max-w-[250px] pointer-events-none shadow-lg"
          style={{
            left: Math.min(mousePos.x + 15, width - 260),
            top: Math.min(mousePos.y + 15, height - 150)
          }}
        >
          <h4 className="font-semibold text-foreground text-sm mb-1">
            {hoveredCluster.label}
          </h4>
          <p className="text-xs text-foreground/70 mb-2">
            {hoveredCluster.description}
          </p>
          <div className="flex flex-wrap gap-1 mb-2">
            {hoveredCluster.keywords.slice(0, 4).map((kw, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 bg-foreground/10 text-[10px] text-foreground/60"
              >
                {kw}
              </span>
            ))}
          </div>
          <div className="text-[10px] text-foreground/50 mono">
            {hoveredCluster.size} papers | {hoveredCluster.primaryCount} primary
          </div>
          {highlightMode === "comparison" && (
            <div className="mt-1 text-[10px]">
              {hoveredCluster.isInEpisode && hoveredCluster.isInNotebook && (
                <span className="text-[var(--golden-chestnut)]">In episode & notebook</span>
              )}
              {hoveredCluster.isInEpisode && !hoveredCluster.isInNotebook && (
                <span className="text-[var(--golden-chestnut)]/70">New territory in episode</span>
              )}
              {!hoveredCluster.isInEpisode && hoveredCluster.isInNotebook && (
                <span className="text-foreground/50">In notebook only</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      {showLegend && highlightMode === "comparison" && (
        <div className="absolute bottom-2 right-2 bg-card/90 border border-border/50 p-2 text-[10px] mono">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "rgba(180, 119, 86, 0.7)" }} />
            <span className="text-foreground/70">In episode & notebook</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "rgba(180, 119, 86, 0.4)" }} />
            <span className="text-foreground/70">New territory</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "rgba(100, 100, 100, 0.15)", border: "1px solid rgba(150, 150, 150, 0.3)" }} />
            <span className="text-foreground/50">Not in episode</span>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Compact cluster distribution bar chart for notebook overview
 */
interface ClusterDistributionBarsProps {
  distribution: Array<{
    cluster_id: number
    label: string
    bookmark_count: number
  }>
  totalBookmarks: number
  maxClusters?: number
  className?: string
}

export function ClusterDistributionBars({
  distribution,
  totalBookmarks,
  maxClusters = 6,
  className = ""
}: ClusterDistributionBarsProps) {
  // Sort by bookmark count and take top N
  const sortedClusters = [...distribution]
    .sort((a, b) => b.bookmark_count - a.bookmark_count)
    .slice(0, maxClusters)

  if (sortedClusters.length === 0) {
    return (
      <div className={`text-sm text-foreground/50 ${className}`}>
        No cluster data available
      </div>
    )
  }

  const maxCount = Math.max(...sortedClusters.map(c => c.bookmark_count), 1)

  return (
    <div className={`space-y-2 ${className}`}>
      {sortedClusters.map(cluster => (
        <div key={cluster.cluster_id} className="flex items-center gap-3">
          <div className="w-28 text-[10px] mono text-foreground/50 truncate" title={cluster.label}>
            {cluster.label}
          </div>
          <div className="flex-1 h-2 bg-foreground/5">
            <div
              className="h-full bg-[var(--golden-chestnut)]"
              style={{ width: `${(cluster.bookmark_count / maxCount) * 100}%` }}
            />
          </div>
          <div className="w-6 text-right text-[10px] mono text-foreground/60">
            {cluster.bookmark_count}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Episode cluster coverage summary component
 */
interface EpisodeClusterSummaryProps {
  episodeId: string
  className?: string
  onViewMap?: () => void
}

export function EpisodeClusterSummary({
  episodeId,
  className = "",
  onViewMap
}: EpisodeClusterSummaryProps) {
  const [comparison, setComparison] = useState<{
    new_clusters: EpisodeNotebookComparison[]
    overlapping: EpisodeNotebookComparison[]
    summary: { new_territory_count: number; overlap_count: number; episode_cluster_count: number }
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const data = await compareEpisodeToNotebook(episodeId)
        setComparison(data)
      } catch (err) {
        console.error("Failed to load cluster comparison:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [episodeId])

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin text-foreground/50" />
        <span className="text-sm text-foreground/50">Loading territories...</span>
      </div>
    )
  }

  if (!comparison || comparison.summary.episode_cluster_count === 0) {
    return null
  }

  return (
    <div className={`border border-border/30 bg-card/30 p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Info className="h-4 w-4 text-[var(--golden-chestnut)]" />
        <span className="text-xs mono uppercase tracking-wider text-foreground/60">
          Research Territory Coverage
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center mb-4">
        <div>
          <div className="text-2xl font-light text-[var(--golden-chestnut)]">
            {comparison.summary.new_territory_count}
          </div>
          <div className="text-[10px] mono text-foreground/50">NEW TERRITORIES</div>
        </div>
        <div>
          <div className="text-2xl font-light text-foreground">
            {comparison.summary.overlap_count}
          </div>
          <div className="text-[10px] mono text-foreground/50">OVERLAPPING</div>
        </div>
        <div>
          <div className="text-2xl font-light text-foreground/50">
            {comparison.summary.episode_cluster_count}
          </div>
          <div className="text-[10px] mono text-foreground/50">TOTAL</div>
        </div>
      </div>

      {comparison.new_clusters.length > 0 && (
        <div className="border-t border-border/30 pt-3">
          <div className="text-[10px] text-foreground/50 mb-2">New territories to explore:</div>
          <div className="flex flex-wrap gap-1">
            {comparison.new_clusters.slice(0, 5).map(c => (
              <span
                key={c.cluster_id}
                className="px-2 py-0.5 bg-[var(--golden-chestnut)]/20 text-[var(--golden-chestnut)] text-[10px]"
              >
                {c.label}
              </span>
            ))}
            {comparison.new_clusters.length > 5 && (
              <span className="px-2 py-0.5 text-foreground/50 text-[10px]">
                +{comparison.new_clusters.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {onViewMap && (
        <button
          onClick={onViewMap}
          className="mt-3 text-[10px] mono text-[var(--golden-chestnut)] hover:underline"
        >
          View territory map &rarr;
        </button>
      )}
    </div>
  )
}
