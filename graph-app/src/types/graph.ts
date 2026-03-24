export interface GraphNode {
  id: string
  name: string
  type: EntityType
  value?: number // For node sizing based on value
  x?: number // Pre-computed position
  y?: number // Pre-computed position
  fx?: number // Fixed position (for pinned nodes)
  fy?: number // Fixed position
  cluster?: string // For clustering
  metadata?: Record<string, any>
}

export interface GraphLink {
  source: string
  target: string
  type?: LinkType
  value?: number // Link strength/weight
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
  timestamp?: string // For versioning/caching
  layout?: 'force' | 'hierarchical' | 'circular' | 'geographic' | 'temporal'
}

export type EntityType =
  | 'account'
  | 'contact'
  | 'opportunity'
  | 'activity'
  | 'lead'
  | 'task'
  | 'quote'
  | 'product'
  | 'campaign'
  | 'line-item'
  | 'quote-line'
  | 'event'
  | 'order'
  | 'contract'
  | 'asset'
  | 'case'
  | 'knowledge'
  | 'party'
  | 'individual'
  | 'organization'
  | 'researcher-profile'
  | 'contact-point-email'
  | 'contact-point-phone'
  | 'contact-point-address'
  | 'household'
  | 'party-source'
  | 'party-identification'
  | 'party-engagement'
  | 'organization-profile'
  | 'account-contact-relationship'
  | 'data-use-purpose'
  | 'contact-point-consent'

export type LinkType =
  | 'owns' // Account owns Opportunity
  | 'belongs_to' // Contact belongs to Account
  | 'references' // Generic reference
  | 'related_to' // Activity related to multiple entities
  | 'contains' // Quote contains line items
  | 'converted_to' // Lead converted to Contact/Account
  | 'part_of' // Part of campaign

export interface NodeDetail {
  id: string
  name: string
  type: EntityType
  frontmatter: Record<string, any>
  body?: string
  links: {
    incoming: GraphLink[]
    outgoing: GraphLink[]
  }
  stats: {
    totalConnections: number
    value?: number
    created?: string
    modified?: string
  }
}

export interface GraphFilters {
  entityTypes: Set<EntityType>
  searchQuery: string
  minConnections: number
  maxConnections: number
  timeRange?: {
    start: Date
    end: Date
  }
}

export interface GraphConfig {
  clustering: {
    enabled: boolean
    threshold: number // Number of nodes before clustering kicks in
    strategy: 'type' | 'community' | 'hierarchical'
  }
  physics: {
    enabled: boolean
    strength: number
    distance: number
    iterations: number
  }
  rendering: {
    nodeSize: 'uniform' | 'connections' | 'value'
    showLabels: boolean
    labelThreshold: number // Zoom level to show labels
    edgeOpacity: number
  }
}