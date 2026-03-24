import { EntityType, GraphNode } from '../types/graph'

// Color palette for entity types
const ENTITY_COLORS: Record<EntityType, string> = {
  account: '#000000',      // Black
  contact: '#000000',      // Black
  opportunity: '#000000',  // Black
  activity: '#000000',     // Black
  lead: '#000000',        // Black
  task: '#000000',        // Black
  quote: '#000000',       // Black
  product: '#000000',     // Black
  campaign: '#000000',    // Black
  'line-item': '#000000', // Black
  'quote-line': '#000000', // Black
  event: '#000000',       // Black
  order: '#000000',       // Black
  contract: '#000000',    // Black
  asset: '#000000',       // Black
  case: '#000000',        // Black
  knowledge: '#000000',   // Black
  party: '#000000',       // Black
  individual: '#000000',  // Black
  organization: '#000000', // Black
  'researcher-profile': '#000000', // Black
  'contact-point-email': '#000000', // Black
  'contact-point-phone': '#000000', // Black
  'contact-point-address': '#000000', // Black
  household: '#000000',   // Black
  'party-source': '#000000', // Black
  'party-identification': '#000000', // Black
  'party-engagement': '#000000', // Black
  'organization-profile': '#000000', // Black
  'account-contact-relationship': '#000000', // Black
  'data-use-purpose': '#000000', // Black
  'contact-point-consent': '#000000' // Black
}

export function getNodeColor(type: EntityType, isHighlighted: boolean = false, isSelected: boolean = false): string {
  if (isSelected) {
    return '#FFD700' // Gold for selected
  }
  if (isHighlighted) {
    return '#FF69B4' // Hot pink for highlighted
  }
  return ENTITY_COLORS[type] || '#999999'
}

export function getNodeSize(node: GraphNode, sizingMode: 'uniform' | 'connections' | 'value'): number {
  const baseSize = 4

  switch (sizingMode) {
    case 'uniform':
      return baseSize

    case 'value':
      // Size based on node value (e.g., opportunity amount, account size)
      if (node.value) {
        // Logarithmic scaling for better visual distribution
        return baseSize + Math.log(node.value + 1) * 0.5
      }
      return baseSize

    case 'connections':
      // This would need connection count passed in
      // For now, return base size
      return baseSize

    default:
      return baseSize
  }
}

export function formatNodeTooltip(node: GraphNode): string {
  return `
    <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px; border-radius: 4px;">
      <strong>${node.name}</strong><br/>
      Type: ${node.type}<br/>
      ${node.value ? `Value: $${node.value.toLocaleString()}` : ''}
    </div>
  `
}

export function calculateNodePositions(nodes: GraphNode[], _layout: 'force' | 'hierarchical' | 'circular'): GraphNode[] {
  // This would implement different layout algorithms
  // For now, we'll use the force layout from the library
  // Server-side pre-computation would go here
  return nodes
}

export function clusterNodes(nodes: GraphNode[], strategy: 'type' | 'community' | 'hierarchical'): Map<string, GraphNode[]> {
  const clusters = new Map<string, GraphNode[]>()

  switch (strategy) {
    case 'type':
      // Group by entity type
      nodes.forEach(node => {
        const key = node.type
        if (!clusters.has(key)) {
          clusters.set(key, [])
        }
        clusters.get(key)!.push(node)
      })
      break

    case 'community':
      // Would implement community detection algorithm
      // For now, just use type clustering
      return clusterNodes(nodes, 'type')

    case 'hierarchical':
      // Would implement hierarchical clustering
      // For now, just use type clustering
      return clusterNodes(nodes, 'type')
  }

  return clusters
}

export function findShortestPath(
  _nodes: GraphNode[],
  links: any[],
  startId: string,
  endId: string
): string[] {
  // Implement Dijkstra's or BFS for shortest path
  // This is a simplified placeholder
  const adjacencyList = new Map<string, Set<string>>()

  // Build adjacency list
  links.forEach(link => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source
    const targetId = typeof link.target === 'object' ? link.target.id : link.target

    if (!adjacencyList.has(sourceId)) {
      adjacencyList.set(sourceId, new Set())
    }
    if (!adjacencyList.has(targetId)) {
      adjacencyList.set(targetId, new Set())
    }

    adjacencyList.get(sourceId)!.add(targetId)
    adjacencyList.get(targetId)!.add(sourceId)
  })

  // BFS to find shortest path
  const queue: string[] = [startId]
  const visited = new Set<string>([startId])
  const parent = new Map<string, string>()

  while (queue.length > 0) {
    const current = queue.shift()!

    if (current === endId) {
      // Reconstruct path
      const path: string[] = []
      let node = endId
      while (node !== startId) {
        path.unshift(node)
        node = parent.get(node)!
      }
      path.unshift(startId)
      return path
    }

    const neighbors = adjacencyList.get(current) || new Set()
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        parent.set(neighbor, current)
        queue.push(neighbor)
      }
    }
  }

  return [] // No path found
}

export function fuzzySearch(query: string, items: string[]): string[] {
  const lowerQuery = query.toLowerCase()

  return items.filter(item => {
    const lowerItem = item.toLowerCase()

    // Check for substring match
    if (lowerItem.includes(lowerQuery)) return true

    // Check for fuzzy match (all query chars in order)
    let queryIndex = 0
    for (let i = 0; i < lowerItem.length && queryIndex < lowerQuery.length; i++) {
      if (lowerItem[i] === lowerQuery[queryIndex]) {
        queryIndex++
      }
    }

    return queryIndex === lowerQuery.length
  })
}