/**
 * Type definitions for the Live Concept Expansion Graph
 */

// Node types matching the bioelectricity domain knowledge graph
export type NodeType =
  | "concept"           // Core scientific concept
  | "evidence"          // Supporting evidence from papers
  | "counter_argument"  // Contradicting evidence
  | "cross_domain"      // Connection to other fields
  | "organism"          // Model organism (planaria, xenopus, etc.)
  | "technique"         // Experimental technique
  | "molecule"          // Specific molecule/protein
  | "gene"              // Gene
  | "process"           // Biological process
  | "phenomenon"        // Scientific phenomenon

// Claim role types for entity relevance
export type ClaimRole =
  | "claim_concept"          // Directly mentioned in the claim
  | "experimental_technique" // Methods/tools used to study this
  | "mechanism"              // Underlying molecular/cellular process
  | "supporting_context"     // Background context from papers

// Relationship types from the existing knowledge graph
export type RelationshipType =
  | "regulates"
  | "enables"
  | "disrupts"
  | "precedes"
  | "correlates_with"
  | "required_for"
  | "inhibits"
  | "activates"
  | "produces"
  | "expressed_in"
  | "interacts_with"
  | "part_of"
  | "measured_by"
  | "supports"       // For evidence nodes
  | "contradicts"    // For counter-argument nodes
  | "extends"        // Cross-domain connections

export interface PaperReference {
  paperId: string
  title: string
  year?: number
  excerpt: string
  section?: string
  url?: string
}

export interface GraphNode {
  id: string
  label: string
  type: NodeType
  description?: string
  papers: PaperReference[]
  isExpanded: boolean
  isLoading: boolean
  confidence?: number
  // Track where this node came from
  sourceClaimId?: string
  // Original data from KG if available
  aliases?: string[]
  mentions?: number
  // For collapsed graph feature
  isDirectMatch?: boolean  // True if this node directly matches the search/claim
  hopDistance?: number     // Distance from nearest seed node (0 = seed, 1 = 1-hop, etc.)
  // Claim-specific relevance (from pre-computed cache)
  relevanceToClaim?: string  // Why this entity is relevant to the specific claim
  claimRole?: ClaimRole      // Role category: claim_concept, experimental_technique, mechanism, supporting_context
}

export interface GraphEdge {
  id: string
  from: string
  to: string
  relationship: RelationshipType
  label: string
  evidence?: string
  confidence?: number
  paperId?: string
}

// Response from expand_concept_grounded MCP tool
export interface ExpansionResult {
  related_concepts: Array<{
    name: string
    type: NodeType
    relationship: RelationshipType
    evidence_quote: string
    paper_id: string
    paper_title: string
    section?: string
    confidence: number
  }>
  supporting_evidence: Array<{
    finding: string
    paper_id: string
    paper_title: string
    section?: string
    quote: string
  }>
  counter_arguments: Array<{
    argument: string
    paper_id: string
    paper_title: string
    limitation_type: "scope" | "methodology" | "replication" | "interpretation"
  }>
  cross_domain: Array<{
    domain: string
    concept: string
    connection: string
    paper_id: string
    evidence_quote: string
  }>
  analysis_notes?: string
}

// Depth visibility options for collapsed graph
// 0 = seeds only, 1 = 1-hop, 2 = 2-hop, "all" = everything
export type DepthLevel = 0 | 1 | 2 | "all"

// Props for the main graph component
export interface ConceptExpansionGraphProps {
  initialNodes?: GraphNode[]
  initialEdges?: GraphEdge[]
  sourceClaimId?: string
  sourceClaimText?: string
  /** IDs of nodes that are direct matches (seed nodes for hop calculation) */
  matchedEntityIds?: string[]
  /** Initial depth to show (default: 0 for seeds only) */
  initialDepth?: DepthLevel
  onNodeClick?: (nodeId: string, node: GraphNode) => void
  onExpansionComplete?: (nodeId: string, result: ExpansionResult) => void
  className?: string
}

// Props for the expansion panel
export interface ExpansionPanelProps {
  selectedNode: GraphNode | null
  onExpand: () => void
  onClose: () => void
  isExpanding: boolean
}

// Props for graph controls
export interface GraphControlsProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onResetView: () => void
  onToggleLayout: () => void
  nodeTypeFilter: NodeType[]
  onNodeTypeFilterChange: (types: NodeType[]) => void
  layoutMode: "force" | "hierarchical"
}

// State for the graph
export interface GraphState {
  nodes: Map<string, GraphNode>
  edges: Map<string, GraphEdge>
  selectedNodeId: string | null
  expandingNodeId: string | null
  layoutMode: "force" | "hierarchical"
  nodeTypeFilter: NodeType[]
}

// Conversion utilities for existing KG data
export interface KGNode {
  id: string
  name: string
  type: string
  description?: string
  aliases?: string[]
  mentions?: number
  papers?: string[]
  is_direct_match?: boolean
  // Claim-specific relevance (from pre-computed cache)
  relevance_to_claim?: string
  claim_role?: string
}

export interface KGEdge {
  source: string
  target: string
  relationship: string
  evidence?: string
  confidence?: number
  paper_id?: string
}

export interface KGSubgraph {
  nodes: KGNode[]
  edges: KGEdge[]
  matched_entity_names: string[]
  stats: {
    direct_matches: number
    total_edges: number
  }
}
