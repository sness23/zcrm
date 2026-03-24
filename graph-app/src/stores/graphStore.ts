import { create } from 'zustand'
import { GraphNode, GraphLink, GraphData, GraphFilters, GraphConfig, NodeDetail, EntityType } from '../types/graph'

interface GraphStore {
  // Graph data
  graphData: GraphData | null
  filteredData: GraphData | null
  selectedNode: NodeDetail | null
  highlightedNodes: Set<string>
  highlightedLinks: Set<string>

  // Filters
  filters: GraphFilters

  // Config
  config: GraphConfig

  // Loading states
  isLoading: boolean
  error: string | null

  // Actions
  setGraphData: (data: GraphData) => void
  selectNode: (nodeId: string | null) => void
  highlightPath: (fromId: string, toId: string) => void
  clearHighlight: () => void

  // Filter actions
  toggleEntityType: (type: EntityType) => void
  setSearchQuery: (query: string) => void
  setConnectionRange: (min: number, max: number) => void

  // Config actions
  toggleClustering: () => void
  setClusteringThreshold: (threshold: number) => void
  togglePhysics: () => void
  setNodeSizing: (sizing: 'uniform' | 'connections' | 'value') => void
  toggleLabels: () => void

  // Data actions
  loadGraphData: () => Promise<void>
  applyFilters: () => void

  // WebSocket actions
  handleRealtimeUpdate: (update: { type: 'add' | 'update' | 'delete', node?: GraphNode, link?: GraphLink }) => void
}

const DEFAULT_FILTERS: GraphFilters = {
  entityTypes: new Set([
    'account', 'contact', 'opportunity', 'lead', 'activity',
    'task', 'quote', 'product', 'campaign', 'event',
    'order', 'contract', 'asset', 'case', 'knowledge',
    'party', 'individual', 'organization', 'researcher-profile',
    'contact-point-email', 'contact-point-phone', 'contact-point-address',
    'household', 'party-source', 'party-identification', 'party-engagement',
    'organization-profile', 'account-contact-relationship', 'data-use-purpose',
    'contact-point-consent'
  ]),
  searchQuery: '',
  minConnections: 0,
  maxConnections: Infinity
}

const DEFAULT_CONFIG: GraphConfig = {
  clustering: {
    enabled: true,
    threshold: 1000, // As requested, cluster at 1k nodes
    strategy: 'type'
  },
  physics: {
    enabled: true,
    strength: -50,
    distance: 100,
    iterations: 100
  },
  rendering: {
    nodeSize: 'value', // As requested, size by value
    showLabels: true,
    labelThreshold: 2, // Zoom level to show labels
    edgeOpacity: 0.5
  }
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  // Initial state
  graphData: null,
  filteredData: null,
  selectedNode: null,
  highlightedNodes: new Set(),
  highlightedLinks: new Set(),
  filters: DEFAULT_FILTERS,
  config: DEFAULT_CONFIG,
  isLoading: false,
  error: null,

  // Actions
  setGraphData: (data) => {
    set({ graphData: data })
    get().applyFilters()
  },

  selectNode: async (nodeId) => {
    if (!nodeId) {
      set({ selectedNode: null })
      return
    }

    // Fetch node details from API
    try {
      const response = await fetch(`/api/graph/node/${nodeId}`)
      const detail: NodeDetail = await response.json()
      set({ selectedNode: detail })
    } catch (error) {
      console.error('Failed to fetch node details:', error)
    }
  },

  highlightPath: (fromId, toId) => {
    // This would implement shortest path algorithm
    // For now, just highlight the two nodes
    set({
      highlightedNodes: new Set([fromId, toId]),
      highlightedLinks: new Set()
    })
  },

  clearHighlight: () => {
    set({
      highlightedNodes: new Set(),
      highlightedLinks: new Set()
    })
  },

  // Filter actions
  toggleEntityType: (type) => {
    set((state) => {
      const newTypes = new Set(state.filters.entityTypes)
      if (newTypes.has(type)) {
        newTypes.delete(type)
      } else {
        newTypes.add(type)
      }
      return {
        filters: { ...state.filters, entityTypes: newTypes }
      }
    })
    get().applyFilters()
  },

  setSearchQuery: (query) => {
    set((state) => ({
      filters: { ...state.filters, searchQuery: query }
    }))
    get().applyFilters()
  },

  setConnectionRange: (min, max) => {
    set((state) => ({
      filters: {
        ...state.filters,
        minConnections: min,
        maxConnections: max
      }
    }))
    get().applyFilters()
  },

  // Config actions
  toggleClustering: () => {
    set((state) => ({
      config: {
        ...state.config,
        clustering: {
          ...state.config.clustering,
          enabled: !state.config.clustering.enabled
        }
      }
    }))
  },

  setClusteringThreshold: (threshold) => {
    set((state) => ({
      config: {
        ...state.config,
        clustering: {
          ...state.config.clustering,
          threshold
        }
      }
    }))
  },

  togglePhysics: () => {
    set((state) => ({
      config: {
        ...state.config,
        physics: {
          ...state.config.physics,
          enabled: !state.config.physics.enabled
        }
      }
    }))
  },

  setNodeSizing: (sizing) => {
    set((state) => ({
      config: {
        ...state.config,
        rendering: {
          ...state.config.rendering,
          nodeSize: sizing
        }
      }
    }))
  },

  toggleLabels: () => {
    set((state) => ({
      config: {
        ...state.config,
        rendering: {
          ...state.config.rendering,
          showLabels: !state.config.rendering.showLabels
        }
      }
    }))
  },

  // Data actions
  loadGraphData: async () => {
    set({ isLoading: true, error: null })

    try {
      const response = await fetch('/api/graph/data')
      if (!response.ok) throw new Error('Failed to load graph data')

      const data: GraphData = await response.json()
      set({
        graphData: data,
        isLoading: false
      })
      get().applyFilters()
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false
      })
    }
  },

  applyFilters: () => {
    const { graphData, filters } = get()
    if (!graphData) return

    const { entityTypes, searchQuery, minConnections, maxConnections } = filters

    // Calculate node connections
    const connectionCounts = new Map<string, number>()
    graphData.links.forEach(link => {
      const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source
      const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target

      connectionCounts.set(sourceId, (connectionCounts.get(sourceId) || 0) + 1)
      connectionCounts.set(targetId, (connectionCounts.get(targetId) || 0) + 1)
    })

    // Filter nodes
    const filteredNodes = graphData.nodes.filter(node => {
      // Entity type filter
      if (!entityTypes.has(node.type)) return false

      // Search filter (fuzzy matching)
      if (searchQuery && !node.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }

      // Connection count filter
      const connections = connectionCounts.get(node.id) || 0
      if (connections < minConnections || connections > maxConnections) {
        return false
      }

      return true
    })

    const nodeIds = new Set(filteredNodes.map(n => n.id))

    // Filter links to only include those between filtered nodes
    const filteredLinks = graphData.links.filter(link => {
      const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source
      const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target
      return nodeIds.has(sourceId) && nodeIds.has(targetId)
    })

    set({
      filteredData: {
        nodes: filteredNodes,
        links: filteredLinks,
        timestamp: graphData.timestamp,
        layout: graphData.layout
      }
    })
  },

  // WebSocket actions
  handleRealtimeUpdate: (update) => {
    const { graphData } = get()
    if (!graphData) return

    let updatedData = { ...graphData }

    switch (update.type) {
      case 'add':
        if (update.node) {
          updatedData.nodes = [...updatedData.nodes, update.node]
        }
        if (update.link) {
          updatedData.links = [...updatedData.links, update.link]
        }
        break

      case 'update':
        if (update.node) {
          updatedData.nodes = updatedData.nodes.map(n =>
            n.id === update.node!.id ? update.node! : n
          )
        }
        break

      case 'delete':
        if (update.node) {
          updatedData.nodes = updatedData.nodes.filter(n => n.id !== update.node!.id)
          // Also remove associated links
          updatedData.links = updatedData.links.filter(l => {
            const sourceId = typeof l.source === 'object' ? (l.source as any).id : l.source
            const targetId = typeof l.target === 'object' ? (l.target as any).id : l.target
            return sourceId !== update.node!.id && targetId !== update.node!.id
          })
        }
        break
    }

    set({ graphData: updatedData })
    get().applyFilters()
  }
}))