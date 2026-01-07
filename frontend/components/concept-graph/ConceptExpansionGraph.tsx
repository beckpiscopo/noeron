"use client"

/**
 * ConceptExpansionGraph - Interactive knowledge graph with Gemini-powered expansion
 *
 * Click any node to expand related concepts, evidence, counter-arguments,
 * and cross-domain connections - all grounded in the paper corpus.
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from "react"
import { Network, DataSet } from "vis-network/standalone"
import { Loader2, ZoomIn, ZoomOut, RotateCcw, Network as NetworkIcon, Maximize2, Layers, ChevronDown, ArrowRight, Quote, X } from "lucide-react"
import {
  ConceptExpansionGraphProps,
  GraphNode,
  GraphEdge,
  NodeType,
  KGNode,
  KGEdge,
  DepthLevel,
} from "./types/graph-types"
import {
  getGraphOptions,
  getHierarchicalOptions,
  toVisNode,
  toVisEdge,
  zoomLevels,
  nodeColors,
} from "./utils/vis-config"
import { useGraphExpansion } from "./hooks/useGraphExpansion"

/**
 * Compute hop distances from seed nodes using BFS.
 * Returns a Map of nodeId -> distance (0 for seeds, 1 for 1-hop neighbors, etc.)
 */
function computeHopDistances(
  nodes: Map<string, GraphNode>,
  edges: Map<string, GraphEdge>,
  seedNodeIds: string[]
): Map<string, number> {
  const distances = new Map<string, number>()

  // Build adjacency list from edges
  const adjacency = new Map<string, Set<string>>()
  for (const node of nodes.values()) {
    adjacency.set(node.id, new Set())
  }
  for (const edge of edges.values()) {
    adjacency.get(edge.from)?.add(edge.to)
    adjacency.get(edge.to)?.add(edge.from)
  }

  // BFS from all seed nodes simultaneously
  const queue: Array<{ nodeId: string; distance: number }> = []

  for (const seedId of seedNodeIds) {
    if (nodes.has(seedId)) {
      distances.set(seedId, 0)
      queue.push({ nodeId: seedId, distance: 0 })
    }
  }

  while (queue.length > 0) {
    const { nodeId, distance } = queue.shift()!
    const neighbors = adjacency.get(nodeId) || new Set()

    for (const neighborId of neighbors) {
      if (!distances.has(neighborId)) {
        distances.set(neighborId, distance + 1)
        queue.push({ nodeId: neighborId, distance: distance + 1 })
      }
    }
  }

  // Mark any disconnected nodes with Infinity
  for (const node of nodes.values()) {
    if (!distances.has(node.id)) {
      distances.set(node.id, Infinity)
    }
  }

  return distances
}

/**
 * Filter nodes and edges based on visible depth from seed nodes
 */
function filterByDepth(
  nodes: Map<string, GraphNode>,
  edges: Map<string, GraphEdge>,
  hopDistances: Map<string, number>,
  maxDepth: DepthLevel
): { visibleNodes: Set<string>; visibleEdges: Set<string>; hiddenCount: number } {
  const maxDistance = maxDepth === "all" ? Infinity : maxDepth

  const visibleNodes = new Set<string>()
  for (const [nodeId, distance] of hopDistances) {
    // Only include if node actually exists in the nodes map AND within depth
    if (distance <= maxDistance && nodes.has(nodeId)) {
      visibleNodes.add(nodeId)
    }
  }

  const visibleEdges = new Set<string>()
  for (const [edgeId, edge] of edges) {
    if (visibleNodes.has(edge.from) && visibleNodes.has(edge.to)) {
      visibleEdges.add(edgeId)
    }
  }

  const hiddenCount = nodes.size - visibleNodes.size

  return { visibleNodes, visibleEdges, hiddenCount }
}

export function ConceptExpansionGraph({
  initialNodes = [],
  initialEdges = [],
  sourceClaimId,
  sourceClaimText,
  matchedEntityIds = [],
  initialDepth = 0,
  onNodeClick,
  onExpansionComplete,
  className = "",
}: ConceptExpansionGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)
  const nodesDatasetRef = useRef<DataSet<any> | null>(null)
  const edgesDatasetRef = useRef<DataSet<any> | null>(null)

  // Graph state
  const [nodes, setNodes] = useState<Map<string, GraphNode>>(new Map())
  const [edges, setEdges] = useState<Map<string, GraphEdge>>(new Map())
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [layoutMode, setLayoutMode] = useState<"force" | "hierarchical">("force")
  const [isInitialized, setIsInitialized] = useState(false)

  // Collapsed graph state
  const [visibleDepth, setVisibleDepth] = useState<DepthLevel>(initialDepth)
  const [showDepthMenu, setShowDepthMenu] = useState(false)

  // Compute seed node IDs - use matchedEntityIds if they exist in nodes, otherwise use direct match flags
  const seedNodeIds = useMemo(() => {
    // First, filter matchedEntityIds to only those that exist in our nodes map
    const validMatchedIds = matchedEntityIds.filter(id => nodes.has(id))

    if (validMatchedIds.length > 0) {
      return validMatchedIds
    }

    // Fallback: look for nodes with isDirectMatch flag
    const directMatchNodes = Array.from(nodes.values())
      .filter(n => n.isDirectMatch)
      .map(n => n.id)

    if (directMatchNodes.length > 0) {
      return directMatchNodes
    }

    // Last fallback: if we have matchedEntityIds but they didn't match node IDs,
    // try to find nodes whose labels match (case-insensitive)
    if (matchedEntityIds.length > 0) {
      const nodesByLabel = new Map<string, string>()
      for (const node of nodes.values()) {
        nodesByLabel.set(node.label.toLowerCase(), node.id)
        // Also try ID as lowercase
        nodesByLabel.set(node.id.toLowerCase(), node.id)
      }

      const matchedByLabel = matchedEntityIds
        .map(id => nodesByLabel.get(id.toLowerCase()))
        .filter((id): id is string => id !== undefined)

      if (matchedByLabel.length > 0) {
        return matchedByLabel
      }
    }

    return []
  }, [matchedEntityIds, nodes])

  // Compute hop distances from seed nodes
  const hopDistances = useMemo(() => {
    if (nodes.size === 0 || seedNodeIds.length === 0) {
      // If no seeds, treat all nodes as visible at distance 0
      const distances = new Map<string, number>()
      for (const node of nodes.values()) {
        distances.set(node.id, 0)
      }
      return distances
    }
    return computeHopDistances(nodes, edges, seedNodeIds)
  }, [nodes, edges, seedNodeIds])

  // Filter visible nodes/edges based on current depth
  const { visibleNodes, visibleEdges, hiddenCount } = useMemo(() => {
    return filterByDepth(nodes, edges, hopDistances, visibleDepth)
  }, [nodes, edges, hopDistances, visibleDepth])

  // Expansion hook
  const { expandNode, isExpanding, expandingNodeId, error } = useGraphExpansion({
    onExpansionComplete: (nodeId, result) => {
      onExpansionComplete?.(nodeId, result)
    },
  })

  // Initialize graph with initial data
  useEffect(() => {
    if (!containerRef.current || isInitialized) return

    // Convert initial nodes to our format
    const nodeMap = new Map<string, GraphNode>()
    for (const node of initialNodes) {
      nodeMap.set(node.id, {
        ...node,
        isExpanded: false,
        isLoading: false,
      })
    }

    // Convert initial edges to our format
    const edgeMap = new Map<string, GraphEdge>()
    for (const edge of initialEdges) {
      edgeMap.set(edge.id, edge)
    }

    setNodes(nodeMap)
    setEdges(edgeMap)

    // Create Vis.js datasets
    const visNodes = Array.from(nodeMap.values()).map(toVisNode)
    const visEdges = Array.from(edgeMap.values()).map(toVisEdge)

    nodesDatasetRef.current = new DataSet(visNodes)
    edgesDatasetRef.current = new DataSet(visEdges)

    // Create network
    const options = layoutMode === "force" ? getGraphOptions(true) : getHierarchicalOptions(true)
    networkRef.current = new Network(
      containerRef.current,
      {
        nodes: nodesDatasetRef.current,
        edges: edgesDatasetRef.current,
      },
      options
    )

    // Event handlers
    networkRef.current.on("click", (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0] as string
        setSelectedNodeId(nodeId)
        setSelectedEdgeId(null) // Clear edge selection when node is selected
        const node = nodeMap.get(nodeId)
        if (node) {
          onNodeClick?.(nodeId, node)
        }
      } else if (params.edges.length > 0) {
        const edgeId = params.edges[0] as string
        setSelectedEdgeId(edgeId)
        setSelectedNodeId(null) // Clear node selection when edge is selected
      } else {
        setSelectedNodeId(null)
        setSelectedEdgeId(null)
      }
    })

    networkRef.current.on("doubleClick", async (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0] as string
        await handleExpand(nodeId)
      }
    })

    // Stabilization complete
    networkRef.current.on("stabilizationIterationsDone", () => {
      networkRef.current?.setOptions({ physics: { enabled: true } })
    })

    setIsInitialized(true)

    return () => {
      networkRef.current?.destroy()
      networkRef.current = null
    }
  }, [initialNodes, initialEdges])

  // Sync Vis.js visibility when depth changes
  useEffect(() => {
    if (!nodesDatasetRef.current || !edgesDatasetRef.current || !isInitialized) return

    // Update node visibility by adding/removing from dataset
    const currentVisNodeIds = new Set(nodesDatasetRef.current.getIds() as string[])
    const currentVisEdgeIds = new Set(edgesDatasetRef.current.getIds() as string[])

    // Add nodes that should be visible but aren't
    const nodesToAdd: any[] = []
    const nodesToRemove: string[] = []

    for (const node of nodes.values()) {
      const shouldBeVisible = visibleNodes.has(node.id)
      const isCurrentlyVisible = currentVisNodeIds.has(node.id)

      if (shouldBeVisible && !isCurrentlyVisible) {
        nodesToAdd.push(toVisNode(node))
      } else if (!shouldBeVisible && isCurrentlyVisible) {
        nodesToRemove.push(node.id)
      }
    }

    // Add edges that should be visible but aren't
    const edgesToAdd: any[] = []
    const edgesToRemove: string[] = []

    for (const [edgeId, edge] of edges) {
      const shouldBeVisible = visibleEdges.has(edgeId)
      const isCurrentlyVisible = currentVisEdgeIds.has(edgeId)

      if (shouldBeVisible && !isCurrentlyVisible) {
        edgesToAdd.push(toVisEdge(edge))
      } else if (!shouldBeVisible && isCurrentlyVisible) {
        edgesToRemove.push(edgeId)
      }
    }

    // Batch updates
    if (nodesToRemove.length > 0) {
      nodesDatasetRef.current.remove(nodesToRemove)
    }
    if (edgesToRemove.length > 0) {
      edgesDatasetRef.current.remove(edgesToRemove)
    }
    if (nodesToAdd.length > 0) {
      nodesDatasetRef.current.add(nodesToAdd)
    }
    if (edgesToAdd.length > 0) {
      edgesDatasetRef.current.add(edgesToAdd)
    }

    // Fit view after adding nodes
    if (nodesToAdd.length > 0 || nodesToRemove.length > 0) {
      setTimeout(() => {
        networkRef.current?.fit({
          animation: { duration: 300, easingFunction: "easeInOutQuad" },
        })
      }, 100)
    }
  }, [visibleNodes, visibleEdges, nodes, edges, isInitialized, visibleDepth, seedNodeIds])

  // Handle node expansion
  const handleExpand = useCallback(
    async (nodeId: string) => {
      const node = nodes.get(nodeId)
      if (!node || node.isExpanded || isExpanding) return

      // Mark node as loading
      setNodes((prev) => {
        const updated = new Map(prev)
        const n = updated.get(nodeId)
        if (n) {
          updated.set(nodeId, { ...n, isLoading: true })
        }
        return updated
      })

      // Update visual state
      nodesDatasetRef.current?.update({
        id: nodeId,
        opacity: 0.5,
      })

      // Call expansion
      const result = await expandNode(
        nodeId,
        node.label,
        sourceClaimText
      )

      if (result) {
        // Add new nodes and edges
        setNodes((prev) => {
          const updated = new Map(prev)

          // Mark original node as expanded
          const original = updated.get(nodeId)
          if (original) {
            updated.set(nodeId, { ...original, isExpanded: true, isLoading: false })
          }

          // Add new nodes
          for (const newNode of result.nodes) {
            if (!updated.has(newNode.id)) {
              updated.set(newNode.id, newNode)
            }
          }

          return updated
        })

        setEdges((prev) => {
          const updated = new Map(prev)
          for (const newEdge of result.edges) {
            if (!updated.has(newEdge.id)) {
              updated.set(newEdge.id, newEdge)
            }
          }
          return updated
        })

        // Update Vis.js datasets with animation
        const visNodes = result.nodes.map(toVisNode)
        const visEdges = result.edges.map(toVisEdge)

        nodesDatasetRef.current?.add(visNodes)
        edgesDatasetRef.current?.add(visEdges)

        // Update original node visual
        nodesDatasetRef.current?.update({
          id: nodeId,
          opacity: 1,
          borderWidth: 4,
        })

        // Focus on the expanded area
        networkRef.current?.focus(nodeId, {
          scale: 1.0,
          animation: {
            duration: 500,
            easingFunction: "easeInOutQuad",
          },
        })
      } else {
        // Expansion failed, reset node state
        setNodes((prev) => {
          const updated = new Map(prev)
          const n = updated.get(nodeId)
          if (n) {
            updated.set(nodeId, { ...n, isLoading: false })
          }
          return updated
        })

        nodesDatasetRef.current?.update({
          id: nodeId,
          opacity: 1,
        })
      }
    },
    [nodes, isExpanding, expandNode, sourceClaimText]
  )

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    const currentScale = networkRef.current?.getScale() || 1
    networkRef.current?.moveTo({
      scale: Math.min(currentScale + zoomLevels.step, zoomLevels.max),
      animation: { duration: 300, easingFunction: "easeInOutQuad" },
    })
  }, [])

  const handleZoomOut = useCallback(() => {
    const currentScale = networkRef.current?.getScale() || 1
    networkRef.current?.moveTo({
      scale: Math.max(currentScale - zoomLevels.step, zoomLevels.min),
      animation: { duration: 300, easingFunction: "easeInOutQuad" },
    })
  }, [])

  const handleResetView = useCallback(() => {
    networkRef.current?.fit({
      animation: { duration: 500, easingFunction: "easeInOutQuad" },
    })
  }, [])

  const handleToggleLayout = useCallback(() => {
    const newMode = layoutMode === "force" ? "hierarchical" : "force"
    setLayoutMode(newMode)

    const options = newMode === "force" ? getGraphOptions(true) : getHierarchicalOptions(true)
    networkRef.current?.setOptions(options)
  }, [layoutMode])

  // Get selected node details
  const selectedNode = selectedNodeId ? nodes.get(selectedNodeId) : null
  // Get selected edge details
  const selectedEdge = selectedEdgeId ? edges.get(selectedEdgeId) : null
  const selectedEdgeSourceNode = selectedEdge ? nodes.get(selectedEdge.from) : null
  const selectedEdgeTargetNode = selectedEdge ? nodes.get(selectedEdge.to) : null

  return (
    <div className={`relative ${className}`}>
      {/* Graph container */}
      <div
        ref={containerRef}
        className="w-full h-[500px] bg-[var(--dark-gray)] border border-[var(--parchment)]/10 rounded-none"
      />

      {/* Controls overlay */}
      <div className="absolute top-3 right-3 flex flex-col gap-1">
        <button
          onClick={handleZoomIn}
          className="p-2 bg-[var(--dark-gray)]/90 border border-[var(--parchment)]/20 hover:border-[var(--golden-chestnut)] text-[var(--parchment)]/70 hover:text-[var(--parchment)] transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 bg-[var(--dark-gray)]/90 border border-[var(--parchment)]/20 hover:border-[var(--golden-chestnut)] text-[var(--parchment)]/70 hover:text-[var(--parchment)] transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetView}
          className="p-2 bg-[var(--dark-gray)]/90 border border-[var(--parchment)]/20 hover:border-[var(--golden-chestnut)] text-[var(--parchment)]/70 hover:text-[var(--parchment)] transition-colors"
          title="Reset view"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={handleToggleLayout}
          className="p-2 bg-[var(--dark-gray)]/90 border border-[var(--parchment)]/20 hover:border-[var(--golden-chestnut)] text-[var(--parchment)]/70 hover:text-[var(--parchment)] transition-colors"
          title={`Switch to ${layoutMode === "force" ? "hierarchical" : "force"} layout`}
        >
          <NetworkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Depth control */}
      <div className="absolute top-3 right-16 flex items-center gap-2">
        {/* Quick toggle buttons */}
        <div className="flex border border-[var(--parchment)]/20 bg-[var(--dark-gray)]/90">
          <button
            onClick={() => setVisibleDepth(0)}
            className={`px-2.5 py-1.5 text-xs transition-colors ${
              visibleDepth === 0
                ? "bg-[var(--golden-chestnut)] text-white"
                : "text-[var(--parchment)]/70 hover:bg-[var(--parchment)]/5"
            }`}
            title="Show only matched concepts (seeds)"
          >
            Seeds Only
          </button>
          <button
            onClick={() => setVisibleDepth(1)}
            className={`px-2.5 py-1.5 text-xs border-l border-[var(--parchment)]/20 transition-colors ${
              visibleDepth === 1
                ? "bg-[var(--golden-chestnut)] text-white"
                : "text-[var(--parchment)]/70 hover:bg-[var(--parchment)]/5"
            }`}
            title="Show seeds + direct connections"
          >
            +Neighbors
          </button>
          <button
            onClick={() => setVisibleDepth("all")}
            className={`px-2.5 py-1.5 text-xs border-l border-[var(--parchment)]/20 transition-colors ${
              visibleDepth === "all"
                ? "bg-[var(--golden-chestnut)] text-white"
                : "text-[var(--parchment)]/70 hover:bg-[var(--parchment)]/5"
            }`}
            title="Show all nodes"
          >
            All
          </button>
        </div>

        {/* Depth dropdown for granular control */}
        <div className="relative">
          <button
            onClick={() => setShowDepthMenu(!showDepthMenu)}
            className="flex items-center gap-1.5 px-2 py-1.5 bg-[var(--dark-gray)]/90 border border-[var(--parchment)]/20 hover:border-[var(--golden-chestnut)] text-xs text-[var(--parchment)]/70 transition-colors"
            title="Depth control"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>
              {visibleDepth === "all" ? "All" : visibleDepth === 0 ? "Seeds" : `${visibleDepth}-hop`}
            </span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {showDepthMenu && (
            <div className="absolute top-full right-0 mt-1 bg-[var(--dark-gray)] border border-[var(--parchment)]/20 shadow-lg z-10 min-w-[120px]">
              {([0, 1, 2, "all"] as DepthLevel[]).map((level) => (
                <button
                  key={level}
                  onClick={() => {
                    setVisibleDepth(level)
                    setShowDepthMenu(false)
                  }}
                  className={`block w-full text-left px-3 py-2 text-sm transition-colors ${
                    visibleDepth === level
                      ? "bg-[var(--golden-chestnut)]/20 text-[var(--golden-chestnut)]"
                      : "text-[var(--parchment)]/70 hover:bg-[var(--parchment)]/5"
                  }`}
                >
                  {level === "all" ? "Show All" : level === 0 ? "Seeds Only" : `${level}-hop`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Hidden nodes indicator */}
        {hiddenCount > 0 && (
          <div className="px-2 py-1 bg-[var(--parchment)]/10 text-xs text-[var(--parchment)]/60">
            +{hiddenCount} hidden
          </div>
        )}
      </div>

      {/* Loading overlay */}
      {isExpanding && (
        <div className="absolute inset-0 bg-[var(--dark-gray)]/50 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 px-4 py-2 bg-[var(--dark-gray)] border border-[var(--golden-chestnut)]/30">
            <Loader2 className="w-4 h-4 text-[var(--golden-chestnut)] animate-spin" />
            <span className="text-sm text-[var(--parchment)]">
              Expanding with Gemini...
            </span>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="absolute bottom-3 left-3 right-3 px-3 py-2 bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Selected node panel */}
      {selectedNode && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-[var(--dark-gray)]/95 border-t border-[var(--parchment)]/10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Type and Role badges */}
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: nodeColors[selectedNode.type]?.background }}
                />
                <span className="text-xs text-[var(--parchment)]/50 uppercase tracking-wide">
                  {selectedNode.type.replace(/_/g, " ")}
                </span>
                {selectedNode.claimRole && (
                  <span className="px-2 py-0.5 bg-[var(--golden-chestnut)]/20 text-[var(--golden-chestnut)] text-xs font-medium rounded">
                    {selectedNode.claimRole === "claim_concept" ? "Claim Concept" :
                     selectedNode.claimRole === "experimental_technique" ? "Technique" :
                     selectedNode.claimRole === "mechanism" ? "Mechanism" : "Context"}
                  </span>
                )}
              </div>

              {/* Entity name */}
              <h4 className="font-semibold text-[var(--parchment)] truncate">
                {selectedNode.label}
              </h4>

              {/* WHY RELEVANT (primary - from claim relevance cache) */}
              {selectedNode.relevanceToClaim && (
                <div className="mt-2 p-2 bg-[var(--golden-chestnut)]/10 border-l-2 border-[var(--golden-chestnut)]">
                  <span className="text-xs text-[var(--golden-chestnut)] uppercase font-medium">Why relevant</span>
                  <p className="text-sm text-[var(--parchment)]/90 mt-1">
                    {selectedNode.relevanceToClaim}
                  </p>
                </div>
              )}

              {/* Original description (secondary - only show if no relevance) */}
              {!selectedNode.relevanceToClaim && selectedNode.description && (
                <p className="text-sm text-[var(--parchment)]/70 line-clamp-2 mt-1">
                  {selectedNode.description}
                </p>
              )}

              {selectedNode.papers.length > 0 && (
                <p className="text-xs text-[var(--golden-chestnut)] mt-2">
                  {selectedNode.papers.length} paper{selectedNode.papers.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <button
              onClick={() => handleExpand(selectedNode.id)}
              disabled={selectedNode.isExpanded || isExpanding}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--golden-chestnut)] hover:bg-[var(--golden-chestnut)]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              {selectedNode.isExpanded ? (
                "Expanded"
              ) : isExpanding && expandingNodeId === selectedNode.id ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Expanding...
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4" />
                  Expand
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Selected edge panel - shows evidence */}
      {selectedEdge && !selectedNode && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-[var(--dark-gray)]/95 border-t border-[var(--parchment)]/10">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              {/* Relationship header */}
              <div className="flex items-center gap-2 mb-3 text-sm">
                <span className="text-[var(--parchment)]/80">
                  {selectedEdgeSourceNode?.label || selectedEdge.from}
                </span>
                <ArrowRight className="w-4 h-4 text-[var(--golden-chestnut)]" />
                <span className="px-2 py-0.5 bg-[var(--golden-chestnut)]/20 text-[var(--golden-chestnut)] text-xs font-medium">
                  {selectedEdge.label || selectedEdge.relationship.replace(/_/g, " ")}
                </span>
                <ArrowRight className="w-4 h-4 text-[var(--golden-chestnut)]" />
                <span className="text-[var(--parchment)]/80">
                  {selectedEdgeTargetNode?.label || selectedEdge.to}
                </span>
              </div>

              {/* Evidence quote */}
              {selectedEdge.evidence ? (
                <div className="bg-[var(--carbon-black)] border-l-2 border-[var(--golden-chestnut)] p-3">
                  <div className="flex items-start gap-2">
                    <Quote className="w-4 h-4 text-[var(--golden-chestnut)] flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-[var(--parchment)]/80 italic">
                      "{selectedEdge.evidence}"
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--parchment)]/50 italic">
                  No evidence quote available for this relationship
                </p>
              )}

              {/* Confidence score */}
              {selectedEdge.confidence && (
                <div className="mt-2 text-xs text-[var(--parchment)]/50">
                  Confidence: {Math.round(selectedEdge.confidence * 100)}%
                </div>
              )}
            </div>

            {/* Close button */}
            <button
              onClick={() => setSelectedEdgeId(null)}
              className="p-1.5 text-[var(--parchment)]/50 hover:text-[var(--parchment)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-3 left-3 p-2 bg-[var(--dark-gray)]/90 border border-[var(--parchment)]/10">
        <div className="text-xs text-[var(--parchment)]/50 mb-2">Double-click to expand</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {(["concept", "evidence", "counter_argument", "cross_domain"] as NodeType[]).map((type) => (
            <div key={type} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: nodeColors[type]?.background }}
              />
              <span className="text-[var(--parchment)]/70">
                {type.replace(/_/g, " ")}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {nodes.size === 0 && !isExpanding && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <NetworkIcon className="w-12 h-12 text-[var(--parchment)]/20 mx-auto mb-3" />
            <p className="text-[var(--parchment)]/50">
              No graph data available
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper to convert KG subgraph data to our format
export function convertKGSubgraph(kgSubgraph: {
  nodes: KGNode[]
  edges: KGEdge[]
}): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = kgSubgraph.nodes.map((kgNode) => ({
    id: kgNode.id,
    label: kgNode.name,
    type: (kgNode.type || "concept") as NodeType,
    description: kgNode.description,
    papers: (kgNode.papers || []).map((p) => ({
      paperId: p,
      title: "",
      excerpt: "",
    })),
    isExpanded: false,
    isLoading: false,
    aliases: kgNode.aliases,
    mentions: kgNode.mentions,
    isDirectMatch: kgNode.is_direct_match ?? false,
    relevanceToClaim: kgNode.relevance_to_claim,
    claimRole: kgNode.claim_role as GraphNode["claimRole"],
  }))

  const edges: GraphEdge[] = kgSubgraph.edges.map((kgEdge, idx) => ({
    id: `${kgEdge.source}-${kgEdge.target}-${idx}`,
    from: kgEdge.source,
    to: kgEdge.target,
    relationship: (kgEdge.relationship || "related") as any,
    label: (kgEdge.relationship || "related").replace(/_/g, " "),
    evidence: kgEdge.evidence,
    confidence: kgEdge.confidence,
    paperId: kgEdge.paper_id,
  }))

  return { nodes, edges }
}

export default ConceptExpansionGraph
