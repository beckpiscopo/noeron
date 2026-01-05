/**
 * Hook for managing graph expansion via the MCP backend
 */

import { useState, useCallback } from "react"
import { callMcpTool } from "@/lib/api"
import {
  GraphNode,
  GraphEdge,
  ExpansionResult,
  NodeType,
  RelationshipType,
  PaperReference,
} from "../types/graph-types"

interface UseGraphExpansionOptions {
  onExpansionStart?: (nodeId: string) => void
  onExpansionComplete?: (nodeId: string, result: ExpansionResult) => void
  onExpansionError?: (nodeId: string, error: string) => void
}

interface UseGraphExpansionReturn {
  expandNode: (
    nodeId: string,
    nodeName: string,
    context?: string
  ) => Promise<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>
  isExpanding: boolean
  expandingNodeId: string | null
  error: string | null
}

export function useGraphExpansion(
  options: UseGraphExpansionOptions = {}
): UseGraphExpansionReturn {
  const [isExpanding, setIsExpanding] = useState(false)
  const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const expandNode = useCallback(
    async (
      nodeId: string,
      nodeName: string,
      context?: string
    ): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] } | null> => {
      setIsExpanding(true)
      setExpandingNodeId(nodeId)
      setError(null)

      options.onExpansionStart?.(nodeId)

      try {
        const result = await callMcpTool<ExpansionResult>(
          "expand_concept_grounded",
          {
            concept_name: nodeName,
            concept_context: context,
            n_rag_results: 10,
            include_counter_arguments: true,
            include_cross_domain: true,
          }
        )

        if (!result) {
          throw new Error("No response from expansion tool")
        }

        // Convert expansion result to graph nodes and edges
        const newNodes: GraphNode[] = []
        const newEdges: GraphEdge[] = []

        // Process related concepts
        if (result.related_concepts) {
          for (const concept of result.related_concepts) {
            const newNodeId = generateNodeId(concept.name)

            newNodes.push({
              id: newNodeId,
              label: concept.name,
              type: concept.type as NodeType,
              description: concept.evidence_quote,
              papers: [
                {
                  paperId: concept.paper_id,
                  title: concept.paper_title,
                  excerpt: concept.evidence_quote,
                  section: concept.section,
                },
              ],
              isExpanded: false,
              isLoading: false,
              confidence: concept.confidence,
            })

            newEdges.push({
              id: `${nodeId}-${newNodeId}`,
              from: nodeId,
              to: newNodeId,
              relationship: concept.relationship as RelationshipType,
              label: concept.relationship.replace(/_/g, " "),
              evidence: concept.evidence_quote,
              confidence: concept.confidence,
              paperId: concept.paper_id,
            })
          }
        }

        // Process supporting evidence as nodes
        if (result.supporting_evidence) {
          for (const evidence of result.supporting_evidence) {
            const evidenceNodeId = generateNodeId(`evidence-${evidence.paper_id}`)

            newNodes.push({
              id: evidenceNodeId,
              label: truncateLabel(evidence.finding, 40),
              type: "evidence",
              description: evidence.finding,
              papers: [
                {
                  paperId: evidence.paper_id,
                  title: evidence.paper_title,
                  excerpt: evidence.quote,
                  section: evidence.section,
                },
              ],
              isExpanded: false,
              isLoading: false,
            })

            newEdges.push({
              id: `${nodeId}-${evidenceNodeId}`,
              from: evidenceNodeId,
              to: nodeId,
              relationship: "supports",
              label: "supports",
              evidence: evidence.quote,
              paperId: evidence.paper_id,
            })
          }
        }

        // Process counter-arguments as nodes
        if (result.counter_arguments) {
          for (const counter of result.counter_arguments) {
            const counterNodeId = generateNodeId(`counter-${counter.paper_id}`)

            newNodes.push({
              id: counterNodeId,
              label: truncateLabel(counter.argument, 40),
              type: "counter_argument",
              description: counter.argument,
              papers: [
                {
                  paperId: counter.paper_id,
                  title: counter.paper_title,
                  excerpt: counter.argument,
                },
              ],
              isExpanded: false,
              isLoading: false,
            })

            newEdges.push({
              id: `${counterNodeId}-${nodeId}`,
              from: counterNodeId,
              to: nodeId,
              relationship: "contradicts",
              label: counter.limitation_type,
              paperId: counter.paper_id,
            })
          }
        }

        // Process cross-domain connections
        if (result.cross_domain) {
          for (const crossDomain of result.cross_domain) {
            const crossNodeId = generateNodeId(crossDomain.concept)

            newNodes.push({
              id: crossNodeId,
              label: crossDomain.concept,
              type: "cross_domain",
              description: `${crossDomain.domain}: ${crossDomain.connection}`,
              papers: [
                {
                  paperId: crossDomain.paper_id,
                  title: crossDomain.domain,
                  excerpt: crossDomain.evidence_quote,
                },
              ],
              isExpanded: false,
              isLoading: false,
            })

            newEdges.push({
              id: `${nodeId}-${crossNodeId}`,
              from: nodeId,
              to: crossNodeId,
              relationship: "extends",
              label: `connects to ${crossDomain.domain}`,
              evidence: crossDomain.evidence_quote,
              paperId: crossDomain.paper_id,
            })
          }
        }

        options.onExpansionComplete?.(nodeId, result)

        return { nodes: newNodes, edges: newEdges }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to expand concept"
        setError(errorMessage)
        options.onExpansionError?.(nodeId, errorMessage)
        return null
      } finally {
        setIsExpanding(false)
        setExpandingNodeId(null)
      }
    },
    [options]
  )

  return {
    expandNode,
    isExpanding,
    expandingNodeId,
    error,
  }
}

// Generate a stable node ID from a concept name
function generateNodeId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

// Truncate label for display
function truncateLabel(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + "..."
}
