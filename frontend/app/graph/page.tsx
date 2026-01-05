"use client"

/**
 * Dedicated Graph View page for exploring the knowledge graph
 *
 * Entry points:
 * - Direct navigation to /graph
 * - From listening view "Explore Connections" button
 * - From deep exploration view
 */

import { useState, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  Search,
  Network,
  Loader2,
  Sparkles,
  Info,
} from "lucide-react"
import { ConceptExpansionGraph, convertKGSubgraph, GraphNode } from "@/components/concept-graph"
import { callMcpTool } from "@/lib/api"

interface KGSubgraphResponse {
  claim_text: string
  matched_entity_ids: string[]
  matched_entity_names: string[]
  nodes: Array<{
    id: string
    name: string
    type: string
    description?: string
    aliases?: string[]
    mentions?: number
    papers?: string[]
    is_direct_match?: boolean
  }>
  edges: Array<{
    source: string
    target: string
    relationship: string
    evidence?: string
    confidence?: number
    paper_id?: string
  }>
  stats: {
    direct_matches: number
    total_nodes: number
    total_edges: number
  }
  error?: string
  message?: string
}

function GraphPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Get initial concept from URL params if provided
  const initialConcept = searchParams.get("concept") || ""
  const initialClaimId = searchParams.get("claimId") || ""

  const [searchQuery, setSearchQuery] = useState(initialConcept)
  const [kgData, setKgData] = useState<KGSubgraphResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)

  // Search for a concept in the knowledge graph
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await callMcpTool<KGSubgraphResponse>(
        "get_relevant_kg_subgraph",
        {
          claim_text: query,
          max_hops: 2,
          use_gemini_extraction: false,
        }
      )

      if (result?.error) {
        setError(result.error)
        setKgData(null)
      } else if (result) {
        setKgData(result)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search knowledge graph")
      setKgData(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSearch(searchQuery)
  }

  // Handle node selection
  const handleNodeClick = useCallback((nodeId: string, node: GraphNode) => {
    setSelectedNode(node)
  }, [])

  return (
    <div className="min-h-screen bg-[var(--carbon-black)] text-[var(--parchment)]">
      {/* Header */}
      <header className="border-b border-[var(--parchment)]/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-[var(--dark-gray)] rounded transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Network className="w-6 h-6 text-[var(--golden-chestnut)]" />
              <h1 className="text-xl font-bold">Knowledge Graph Explorer</h1>
            </div>
          </div>

          {/* Search form */}
          <form onSubmit={handleSubmit} className="flex-1 max-w-xl mx-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--parchment)]/50" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for a concept (e.g., bioelectricity, gap junctions, regeneration)"
                className="w-full pl-10 pr-4 py-2 bg-[var(--dark-gray)] border border-[var(--parchment)]/20 rounded-none text-sm focus:outline-none focus:border-[var(--golden-chestnut)] transition-colors"
              />
              {isLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--golden-chestnut)] animate-spin" />
              )}
            </div>
          </form>

          <div className="flex items-center gap-2 text-xs text-[var(--parchment)]/50">
            <Sparkles className="w-4 h-4 text-[var(--golden-chestnut)]" />
            Powered by Gemini
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex h-[calc(100vh-73px)]">
        {/* Graph area */}
        <div className="flex-1 relative">
          {/* Empty state */}
          {!kgData && !isLoading && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center max-w-md">
                <Network className="w-16 h-16 text-[var(--parchment)]/20 mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">Explore the Knowledge Graph</h2>
                <p className="text-[var(--parchment)]/60 mb-6">
                  Search for a scientific concept to visualize its connections in the research corpus.
                  Double-click any node to expand with AI-powered analysis.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {["bioelectricity", "gap junctions", "regeneration", "ion channels", "morphogenesis"].map((term) => (
                    <button
                      key={term}
                      onClick={() => {
                        setSearchQuery(term)
                        handleSearch(term)
                      }}
                      className="px-3 py-1.5 bg-[var(--dark-gray)] border border-[var(--parchment)]/20 hover:border-[var(--golden-chestnut)] text-sm transition-colors"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--carbon-black)]/80">
              <div className="flex items-center gap-3 px-6 py-4 bg-[var(--dark-gray)] border border-[var(--golden-chestnut)]/30">
                <Loader2 className="w-5 h-5 text-[var(--golden-chestnut)] animate-spin" />
                <span>Searching knowledge graph...</span>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center max-w-md px-6 py-8 bg-red-500/10 border border-red-500/30">
                <p className="text-red-400 mb-4">{error}</p>
                <button
                  onClick={() => handleSearch(searchQuery)}
                  className="px-4 py-2 bg-[var(--dark-gray)] border border-[var(--parchment)]/20 hover:border-[var(--golden-chestnut)] text-sm transition-colors"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Graph */}
          {kgData && !isLoading && (
            <div className="h-full">
              {kgData.nodes.length > 0 ? (
                <ConceptExpansionGraph
                  initialNodes={convertKGSubgraph(kgData).nodes}
                  initialEdges={convertKGSubgraph(kgData).edges}
                  matchedEntityIds={kgData.matched_entity_ids}
                  initialDepth={0}
                  sourceClaimText={searchQuery}
                  onNodeClick={handleNodeClick}
                  className="h-full"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center max-w-md">
                    <Network className="w-12 h-12 text-[var(--parchment)]/20 mx-auto mb-4" />
                    <h3 className="text-lg font-bold mb-2">No Matches Found</h3>
                    <p className="text-[var(--parchment)]/60 mb-4">
                      {kgData.message || `No entities matching "${searchQuery}" were found in the knowledge graph.`}
                    </p>
                    <p className="text-sm text-[var(--parchment)]/40">
                      Try a different search term or check the spelling.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar - Selected node details */}
        {selectedNode && kgData && (
          <aside className="w-80 border-l border-[var(--parchment)]/10 bg-[var(--dark-gray)] overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Info className="w-4 h-4 text-[var(--golden-chestnut)]" />
                <h3 className="font-bold">Node Details</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <span className="text-xs text-[var(--parchment)]/50 uppercase tracking-wide">
                    {selectedNode.type.replace(/_/g, " ")}
                  </span>
                  <h4 className="font-semibold text-lg">{selectedNode.label}</h4>
                </div>

                {selectedNode.description && (
                  <div>
                    <span className="text-xs text-[var(--parchment)]/50 uppercase tracking-wide">
                      Description
                    </span>
                    <p className="text-sm text-[var(--parchment)]/80 mt-1">
                      {selectedNode.description}
                    </p>
                  </div>
                )}

                {selectedNode.papers.length > 0 && (
                  <div>
                    <span className="text-xs text-[var(--parchment)]/50 uppercase tracking-wide">
                      Referenced Papers ({selectedNode.papers.length})
                    </span>
                    <div className="mt-2 space-y-2">
                      {selectedNode.papers.slice(0, 5).map((paper, idx) => (
                        <div
                          key={idx}
                          className="p-2 bg-[var(--carbon-black)] border border-[var(--parchment)]/10 text-sm"
                        >
                          {paper.title || paper.paperId}
                          {paper.excerpt && (
                            <p className="text-xs text-[var(--parchment)]/60 mt-1 line-clamp-2">
                              {paper.excerpt}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-[var(--parchment)]/10">
                  <div className="flex items-center gap-2 text-xs text-[var(--parchment)]/50">
                    <span>Status:</span>
                    {selectedNode.isExpanded ? (
                      <span className="text-green-400">Expanded</span>
                    ) : (
                      <span className="text-[var(--golden-chestnut)]">Double-click to expand</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        )}
      </main>
    </div>
  )
}

// Loading fallback for Suspense
function GraphPageLoading() {
  return (
    <div className="min-h-screen bg-[var(--carbon-black)] text-[var(--parchment)] flex items-center justify-center">
      <div className="flex items-center gap-3">
        <Loader2 className="w-6 h-6 text-[var(--golden-chestnut)] animate-spin" />
        <span>Loading Knowledge Graph Explorer...</span>
      </div>
    </div>
  )
}

// Default export wraps the content in Suspense for useSearchParams
export default function GraphPage() {
  return (
    <Suspense fallback={<GraphPageLoading />}>
      <GraphPageContent />
    </Suspense>
  )
}
