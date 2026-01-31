"use client"

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
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Network className="w-6 h-6 text-[var(--golden-chestnut)]" />
          <h3 className="font-bold text-xl">Knowledge Graph</h3>
        </div>
        {!kgSubgraph && !isLoadingKG && (
          <button
            onClick={onFetchKG}
            className="text-sm text-[var(--golden-chestnut)] hover:underline flex items-center gap-1"
          >
            <Network className="w-4 h-4" />
            Load Graph
          </button>
        )}
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
              {/* Matched entities pills */}
              <div className="flex flex-wrap gap-2 mb-6">
                {kgSubgraph.matched_entity_names.map((name, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 bg-[var(--golden-chestnut)]/20 text-[var(--golden-chestnut)] text-sm font-medium rounded-full border border-[var(--golden-chestnut)]/30"
                  >
                    {name}
                  </span>
                ))}
              </div>

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

      {/* Initial state - prompt to load */}
      {!kgSubgraph && !isLoadingKG && !kgError && (
        <CornerBrackets className="bg-card/30 p-12 text-center">
          <Network className="w-16 h-16 text-foreground/20 mx-auto mb-6" />
          <p className="text-foreground/60 mb-6">
            Explore how concepts in this claim connect to the broader research
          </p>
          <button
            onClick={onFetchKG}
            className="px-6 py-3 border border-[var(--golden-chestnut)] bg-[var(--golden-chestnut)]/10 hover:bg-[var(--golden-chestnut)]/20 text-[var(--golden-chestnut)] font-bold tracking-wide transition-all inline-flex items-center gap-2"
          >
            <Network className="w-5 h-5" />
            Load Knowledge Graph
          </button>
        </CornerBrackets>
      )}
    </div>
  )
}
