import React, { useRef, useCallback, useEffect, useMemo } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { useGraphStore } from '../stores/graphStore'
import { GraphNode, GraphLink, EntityType } from '../types/graph'
import { getNodeColor, getNodeSize } from '../utils/graphUtils'

interface GraphViewerProps {
  width?: number
  height?: number
}

export const GraphViewer: React.FC<GraphViewerProps> = ({
  width = window.innerWidth,
  height = window.innerHeight
}) => {
  const graphRef = useRef<any>(null)

  const {
    filteredData,
    selectedNode,
    highlightedNodes,
    highlightedLinks,
    config,
    selectNode,
    clearHighlight
  } = useGraphStore()

  // Apply clustering if enabled and threshold is met
  const processedData = useMemo(() => {
    if (!filteredData) return null

    const { nodes, links } = filteredData

    // Check if clustering should be applied
    if (config.clustering.enabled && nodes.length > config.clustering.threshold) {
      // Group nodes by type for type-based clustering
      const clusters = new Map<EntityType, GraphNode[]>()

      nodes.forEach(node => {
        if (!clusters.has(node.type)) {
          clusters.set(node.type, [])
        }
        clusters.get(node.type)!.push(node)
      })

      // Create cluster nodes and internal links
      const clusterNodes: GraphNode[] = []
      const clusterLinks: GraphLink[] = []
      const nodeToCluster = new Map<string, string>()

      clusters.forEach((clusterMembers, type) => {
        if (clusterMembers.length > 10) {
          // Create a cluster node
          const clusterId = `cluster_${type}`
          const totalValue = clusterMembers.reduce((sum, node) => sum + (node.value || 0), 0)

          clusterNodes.push({
            id: clusterId,
            name: `${type} cluster (${clusterMembers.length})`,
            type: type,
            value: totalValue,
            cluster: clusterId,
            metadata: {
              isCluster: true,
              memberCount: clusterMembers.length,
              members: clusterMembers.map(n => n.id)
            }
          })

          // Map members to cluster
          clusterMembers.forEach(member => {
            nodeToCluster.set(member.id, clusterId)
          })
        } else {
          // Keep individual nodes
          clusterNodes.push(...clusterMembers)
        }
      })

      // Process links for clusters
      const linkMap = new Map<string, { source: string; target: string; count: number }>()

      links.forEach(link => {
        const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source
        const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target

        const actualSource = nodeToCluster.get(sourceId) || sourceId
        const actualTarget = nodeToCluster.get(targetId) || targetId

        // Skip self-loops for clusters
        if (actualSource === actualTarget && actualSource.startsWith('cluster_')) {
          return
        }

        const key = `${actualSource}-${actualTarget}`
        if (linkMap.has(key)) {
          linkMap.get(key)!.count++
        } else {
          linkMap.set(key, {
            source: actualSource,
            target: actualTarget,
            count: 1
          })
        }
      })

      linkMap.forEach(({ source, target, count }) => {
        clusterLinks.push({
          source,
          target,
          value: count
        })
      })

      return {
        nodes: clusterNodes,
        links: clusterLinks
      }
    }

    return filteredData
  }, [filteredData, config.clustering])

  // Handle node click
  const handleNodeClick = useCallback((node: any) => {
    // If it's a cluster, expand it (would need to implement expansion logic)
    if (node.metadata?.isCluster) {
      console.log('Expand cluster:', node)
      // TODO: Implement cluster expansion
      return
    }

    selectNode(node.id)
  }, [selectNode])

  // Handle background click
  const handleBackgroundClick = useCallback(() => {
    selectNode(null)
    clearHighlight()
  }, [selectNode, clearHighlight])

  // Node rendering
  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name
    const fontSize = 12 / globalScale
    ctx.font = `${fontSize}px Sans-Serif`

    // Node color based on type and highlight state
    const isHighlighted = highlightedNodes.has(node.id)
    const isSelected = selectedNode?.id === node.id

    // Draw node
    ctx.fillStyle = getNodeColor(node.type, isHighlighted, isSelected)
    ctx.beginPath()

    // Size based on config
    const size = getNodeSize(node, config.rendering.nodeSize)
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false)
    ctx.fill()

    // Draw border for selected/highlighted nodes
    if (isSelected || isHighlighted) {
      ctx.strokeStyle = isSelected ? '#fff' : '#ff0'
      ctx.lineWidth = isSelected ? 2 / globalScale : 1 / globalScale
      ctx.stroke()
    }

    // Draw label if enabled and zoom level is appropriate
    if (config.rendering.showLabels && globalScale >= config.rendering.labelThreshold) {
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#fff'
      ctx.fillText(label, node.x, node.y + size + fontSize)
    }

    // Draw cluster indicator
    if (node.metadata?.isCluster) {
      ctx.font = `${fontSize * 1.5}px Sans-Serif`
      ctx.fillStyle = '#fff'
      ctx.fillText(node.metadata.memberCount.toString(), node.x, node.y)
    }
  }, [highlightedNodes, selectedNode, config.rendering])

  // Link color function
  const getLinkColor = useCallback((link: any) => {
    const isHighlighted = highlightedLinks.has(`${link.source.id}-${link.target.id}`)
    return isHighlighted ? '#ff0' : `rgba(255, 255, 255, ${config.rendering.edgeOpacity})`
  }, [highlightedLinks, config.rendering])

  // Link width function
  const getLinkWidth = useCallback((link: any) => {
    const baseWidth = link.value || 1
    // Thicker lines for cluster connections
    if (link.source.metadata?.isCluster || link.target.metadata?.isCluster) {
      return baseWidth * 2
    }
    return baseWidth
  }, [])

  // Auto-zoom to fit on load
  useEffect(() => {
    if (graphRef.current && processedData) {
      // Zoom to fit with padding
      setTimeout(() => {
        graphRef.current.zoomToFit(400, 50)
      }, 500)
    }
  }, [processedData])

  // Physics engine config
  const _forceEngineConfig = useMemo(() => {
    if (!config.physics.enabled) {
      return {
        alpha: 0,
        alphaDecay: 1
      }
    }

    return {
      alpha: 1,
      alphaDecay: 0.02,
      alphaMin: 0.001,
      velocityDecay: 0.3,
      d3Force: {
        charge: {
          strength: config.physics.strength,
          distanceMax: 500
        },
        link: {
          distance: config.physics.distance,
          iterations: config.physics.iterations
        },
        center: {
          x: 0,
          y: 0
        }
      }
    }
  }, [config.physics])

  if (!processedData) {
    return (
      <div className="graph-loading">
        Loading graph data...
      </div>
    )
  }

  return (
    <ForceGraph2D
      ref={graphRef}
      width={width}
      height={height}
      graphData={processedData}

      // Node config
      nodeCanvasObject={nodeCanvasObject}
      nodePointerAreaPaint={(node, color, ctx) => {
        ctx.fillStyle = color
        ctx.beginPath()
        const size = getNodeSize(node as any, config.rendering.nodeSize)
        ctx.arc(node.x!, node.y!, size, 0, 2 * Math.PI, false)
        ctx.fill()
      }}

      // Link config
      linkColor={getLinkColor}
      linkWidth={getLinkWidth}
      linkDirectionalArrowLength={3}
      linkDirectionalArrowRelPos={1}

      // Interaction
      onNodeClick={handleNodeClick}
      onBackgroundClick={handleBackgroundClick}
      enableNodeDrag={true}
      enableZoomInteraction={true}
      enablePanInteraction={true}

      // Performance
      enablePointerInteraction={true}
      minZoom={0.1}
      maxZoom={10}

      // Physics
      d3AlphaDecay={_forceEngineConfig.alphaDecay}
      d3AlphaMin={_forceEngineConfig.alphaMin}
      d3VelocityDecay={_forceEngineConfig.velocityDecay}
      cooldownTime={5000}
      warmupTicks={100}
    />
  )
}