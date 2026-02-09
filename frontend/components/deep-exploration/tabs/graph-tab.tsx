"use client"

import { useEffect } from "react"
import { Network, Loader2 } from "lucide-react"
import { ConceptExpansionGraph, convertKGSubgraph } from "@/components/concept-graph"

function CornerBrackets({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute -top-px -left-px w-4 h-4 border-l border-t border-[var(--golden-chestnut)]/40" />
      <div className="absolute -top-px -right-px w-4 h-4 border-r border-t border-[var(--golden-chestnut)]/40" />
      <div className="absolute -bottom-px -left-px w-4 h-4 border-l border-b border-[var(--golden-chestnut)]/40" />
      <div className="absolute -bottom-px -right-px w-4 h-4 border-r border-b border-[var(--golden-chestnut)]/40" />
      {children}
    </div>
  )
}

interface KGNode {
  id: string
  name: string
  type: string
  description?: string
  aliases?: string[]
  is_direct_match?: boolean
  papers?: string[]
}

interface KGEdge {
  source: string
  target: string
  relationship: string
  evidence?: string
  confidence?: number
}

interface KGSubgraphResponse {
  claim_text: string
  matched_entity_ids: string[]
  matched_entity_names: string[]
  nodes: KGNode[]
  edges: KGEdge[]
  stats: {
    direct_matches: number
    total_nodes: number
    total_edges: number
  }
  error?: string
  message?: string
}

interface GraphTabProps {
  kgSubgraph: KGSubgraphResponse | null
  isLoadingKG: boolean
  kgError: string | null
  onFetchKG: () => void
  claimId: string
  claimText: string
}

export function GraphTab({
  kgSubgraph,
  isLoadingKG,
  kgError,
  onFetchKG,
  claimId,
  claimText,
}: GraphTabProps) {
  // Auto-load the knowledge graph when tab is viewed
  useEffect(() => {
    if (!kgSubgraph && !isLoadingKG && !kgError) {
      onFetchKG()
    }
  }, [kgSubgraph, isLoadingKG, kgError, onFetchKG])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Network className="w-6 h-6 text-[var(--golden-chestnut)]" />
        <h3 className="font-bold text-xl">Knowledge Graph</h3>
      </div>

      {/* Loading State */}
      {isLoadingKG && (
        <CornerBrackets className="bg-card/30 p-12">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-[var(--golden-chestnut)] animate-spin mb-4" />
            <p className="text-foreground/60">Loading knowledge graph...</p>
          </div>
        </CornerBrackets>
      )}

      {/* Error State */}
      {kgError && !isLoadingKG && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-none p-6">
          <p className="text-red-400">{kgError}</p>
          <button
            onClick={onFetchKG}
            className="mt-3 text-sm text-[var(--golden-chestnut)] hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* KG Content - Interactive Concept Expansion Graph */}
      {kgSubgraph && !isLoadingKG && !kgError && (
        <div>
          {/* Stats bar */}
          <div className="flex items-center gap-4 text-sm text-foreground/50 pb-4 mb-4 border-b border-border">
            <span>{kgSubgraph.stats.direct_matches} matched entities</span>
            <span>{kgSubgraph.stats.total_edges} relationships</span>
            <span className="text-[var(--golden-chestnut)]">Double-click nodes to expand with AI</span>
          </div>

          {kgSubgraph.edges.length > 0 ? (
            <>
              {/* Interactive Graph - full width */}
              <div className="min-h-[500px]">
                <ConceptExpansionGraph
                  initialNodes={convertKGSubgraph(kgSubgraph).nodes}
                  initialEdges={convertKGSubgraph(kgSubgraph).edges}
                  matchedEntityIds={kgSubgraph.matched_entity_ids}
                  initialDepth={0}
                  sourceClaimId={claimId}
                  sourceClaimText={claimText}
                />
              </div>
            </>
          ) : (
            <CornerBrackets className="bg-card/30 p-12 text-center">
              <Network className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
              <p className="text-foreground/50">
                {kgSubgraph.message || "No matching entities found in knowledge graph"}
              </p>
            </CornerBrackets>
          )}
        </div>
      )}

      {/* Initial state - auto-loading */}
      {!kgSubgraph && !isLoadingKG && !kgError && (
        <CornerBrackets className="bg-card/30 p-12">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-[var(--golden-chestnut)] animate-spin mb-4" />
            <p className="text-foreground/60">Loading knowledge graph...</p>
          </div>
        </CornerBrackets>
      )}
    </div>
  )
}
