/**
 * Vis.js configuration for the Concept Expansion Graph
 * Integrates with the Noeron design system CSS variables
 */

import { Options, Node, Edge } from "vis-network"
import { NodeType, RelationshipType } from "../types/graph-types"

// Color scheme matching Noeron design system
// These colors work in both light and dark modes
export const nodeColors: Record<NodeType, { background: string; border: string; highlight: string }> = {
  concept: {
    background: "#BE7C4D",      // golden-chestnut
    border: "#8B5A2B",
    highlight: "#D4935F",
  },
  evidence: {
    background: "#4CAF50",      // green for supporting
    border: "#2E7D32",
    highlight: "#66BB6A",
  },
  counter_argument: {
    background: "#EF5350",      // red for contradicting
    border: "#C62828",
    highlight: "#E57373",
  },
  cross_domain: {
    background: "#AB47BC",      // purple for cross-domain
    border: "#7B1FA2",
    highlight: "#BA68C8",
  },
  organism: {
    background: "#42A5F5",      // blue for organisms
    border: "#1565C0",
    highlight: "#64B5F6",
  },
  technique: {
    background: "#FFA726",      // orange for techniques
    border: "#E65100",
    highlight: "#FFB74D",
  },
  molecule: {
    background: "#26C6DA",      // cyan for molecules
    border: "#00838F",
    highlight: "#4DD0E1",
  },
  gene: {
    background: "#EC407A",      // pink for genes
    border: "#AD1457",
    highlight: "#F06292",
  },
  process: {
    background: "#7E57C2",      // deep purple for processes
    border: "#4527A0",
    highlight: "#9575CD",
  },
  phenomenon: {
    background: "#78909C",      // blue-grey for phenomena
    border: "#455A64",
    highlight: "#90A4AE",
  },
}

// Relationship edge colors
export const edgeColors: Record<string, string> = {
  regulates: "#42A5F5",
  required_for: "#66BB6A",
  produces: "#AB47BC",
  inhibits: "#EF5350",
  disrupts: "#EF5350",
  activates: "#66BB6A",
  enables: "#66BB6A",
  supports: "#4CAF50",
  contradicts: "#F44336",
  extends: "#9C27B0",
  default: "rgba(242, 233, 228, 0.4)",
}

// Node shape by type
export const nodeShapes: Record<NodeType, string> = {
  concept: "dot",
  evidence: "diamond",
  counter_argument: "triangle",
  cross_domain: "square",
  organism: "ellipse",
  technique: "box",
  molecule: "hexagon",
  gene: "star",
  process: "dot",
  phenomenon: "dot",
}

// Base options for Vis.js network
export const getGraphOptions = (isDarkMode: boolean = true): Options => ({
  nodes: {
    shape: "dot",
    size: 25,
    font: {
      size: 14,
      color: isDarkMode ? "#F2E9E4" : "#3d2817",
      face: "Manrope, sans-serif",
      strokeWidth: 2,
      strokeColor: isDarkMode ? "#1D1E20" : "#f5e6d3",
    },
    borderWidth: 2,
    borderWidthSelected: 4,
    shadow: {
      enabled: true,
      size: 10,
      x: 2,
      y: 2,
      color: "rgba(0, 0, 0, 0.3)",
    },
    scaling: {
      min: 20,
      max: 40,
      label: {
        enabled: true,
        min: 12,
        max: 18,
      },
    },
  },
  edges: {
    arrows: {
      to: {
        enabled: true,
        scaleFactor: 0.6,
        type: "arrow",
      },
    },
    color: {
      color: isDarkMode ? "rgba(242, 233, 228, 0.3)" : "rgba(61, 40, 23, 0.3)",
      highlight: "#BE7C4D",
      hover: "#BE7C4D",
      inherit: false,
    },
    font: {
      size: 11,
      color: isDarkMode ? "rgba(242, 233, 228, 0.7)" : "rgba(61, 40, 23, 0.7)",
      face: "Manrope, sans-serif",
      strokeWidth: 0,
      align: "middle",
      background: isDarkMode ? "#1D1E20" : "#f5e6d3",
    },
    smooth: {
      enabled: true,
      type: "curvedCW",
      roundness: 0.2,
    },
    width: 1.5,
    hoverWidth: 2.5,
    selectionWidth: 3,
  },
  physics: {
    enabled: true,
    solver: "forceAtlas2Based",
    forceAtlas2Based: {
      gravitationalConstant: -80,
      centralGravity: 0.015,
      springLength: 180,
      springConstant: 0.06,
      damping: 0.5,
      avoidOverlap: 0.5,
    },
    stabilization: {
      enabled: true,
      iterations: 300,
      updateInterval: 25,
      fit: true,
    },
    maxVelocity: 50,
    minVelocity: 0.75,
    timestep: 0.5,
  },
  interaction: {
    hover: true,
    tooltipDelay: 150,
    hideEdgesOnDrag: false,
    hideEdgesOnZoom: false,
    multiselect: false,
    navigationButtons: false,
    keyboard: {
      enabled: true,
      bindToWindow: false,
      autoFocus: true,
    },
    zoomView: true,
    dragView: true,
  },
  layout: {
    improvedLayout: true,
    hierarchical: false,
  },
})

// Hierarchical layout options (alternative mode)
export const getHierarchicalOptions = (isDarkMode: boolean = true): Options => {
  const baseOptions = getGraphOptions(isDarkMode)
  return {
    ...baseOptions,
    layout: {
      hierarchical: {
        enabled: true,
        direction: "UD",
        sortMethod: "directed",
        levelSeparation: 150,
        nodeSpacing: 150,
        treeSpacing: 200,
        blockShifting: true,
        edgeMinimization: true,
        parentCentralization: true,
      },
    },
    physics: {
      enabled: false,
    },
  }
}

// Convert our GraphNode to Vis.js Node format
export function toVisNode(node: {
  id: string
  label: string
  type: NodeType
  description?: string
  isLoading?: boolean
  isExpanded?: boolean
  isDirectMatch?: boolean
}): Node {
  const colors = nodeColors[node.type] || nodeColors.concept
  const shape = nodeShapes[node.type] || "dot"

  // Build informative tooltip
  let tooltip = node.label
  const typeLabel = node.type.replace(/_/g, " ")
  tooltip = `${node.label}\n[${typeLabel}]`
  if (node.isDirectMatch) {
    tooltip += "\n★ Direct match"
  }
  if (node.description) {
    const truncatedDesc = node.description.length > 200
      ? node.description.substring(0, 200) + "..."
      : node.description
    tooltip += `\n\n${truncatedDesc}`
  }

  return {
    id: node.id,
    label: node.label,
    shape,
    color: {
      background: colors.background,
      border: colors.border,
      highlight: {
        background: colors.highlight,
        border: colors.border,
      },
      hover: {
        background: colors.highlight,
        border: colors.border,
      },
    },
    // Show loading state with opacity
    opacity: node.isLoading ? 0.5 : 1,
    // Visual indicator for expanded nodes or direct matches
    borderWidth: node.isExpanded ? 4 : node.isDirectMatch ? 3 : 2,
    // Store custom data
    title: tooltip,
  }
}

// Convert our GraphEdge to Vis.js Edge format
export function toVisEdge(edge: {
  id: string
  from: string
  to: string
  relationship: RelationshipType | string
  label?: string
  evidence?: string
  confidence?: number
  paperId?: string
}): Edge {
  const color = edgeColors[edge.relationship] || edgeColors.default

  // Build tooltip with evidence if available
  let tooltip = formatRelationship(edge.relationship)
  if (edge.evidence) {
    // Truncate evidence for tooltip, show full on click
    const truncatedEvidence = edge.evidence.length > 150
      ? edge.evidence.substring(0, 150) + "..."
      : edge.evidence
    tooltip = `${formatRelationship(edge.relationship)}\n\n"${truncatedEvidence}"`
  }
  if (edge.confidence) {
    tooltip += `\n\nConfidence: ${Math.round(edge.confidence * 100)}%`
  }

  return {
    id: edge.id,
    from: edge.from,
    to: edge.to,
    label: edge.label || formatRelationship(edge.relationship),
    color: {
      color,
      highlight: "#BE7C4D",
      hover: "#BE7C4D",
    },
    title: tooltip,
  }
}

// Format relationship type for display
export function formatRelationship(relationship: string): string {
  return relationship.replace(/_/g, " ")
}

// Animation configuration for new nodes
export const newNodeAnimation = {
  duration: 500,
  easingFunction: "easeInOutQuad" as const,
}

// Zoom levels
export const zoomLevels = {
  min: 0.3,
  max: 2.5,
  default: 1.0,
  step: 0.2,
}
