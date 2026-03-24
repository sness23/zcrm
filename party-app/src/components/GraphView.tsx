import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import './GraphView.css'

export interface GraphNode {
  id: string
  name: string
  type: string
  email?: string
  title?: string
  organization?: string
  h_index?: number
  citation_count?: number
}

export interface GraphLink {
  source: string
  target: string
  relationship: string
  strength?: number
}

interface GraphViewProps {
  onSelectParty: (partyId: string) => void
}

export default function GraphView({ onSelectParty }: GraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [links, setLinks] = useState<GraphLink[]>([])

  // Fetch parties and their relationships
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch graph data from new endpoint
        const response = await fetch('http://localhost:9600/api/parties/graph')
        const data = await response.json()

        setNodes(data.nodes)
        setLinks(data.links)
      } catch (error) {
        console.error('Error fetching graph data:', error)
      }
    }

    fetchData()
  }, [])

  // Initialize D3 force simulation
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return

    const svg = d3.select(svgRef.current)
    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight

    // Clear previous content
    svg.selectAll('*').remove()

    // Create a container group for zooming/panning
    const g = svg.append('g')

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })

    svg.call(zoom)

    // Create force simulation
    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links)
        .id((d: any) => d.id)
        .distance(100)
        .strength(0.5))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30))

    // Create links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d: any) => Math.sqrt(d.strength || 1) * 2)

    // Create nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .call(d3.drag<any, any>()
        .on('start', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d: any) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null
          d.fy = null
        }))

    // Add circles to nodes
    node.append('circle')
      .attr('r', (d: any) => d.type === 'University' ? 15 : 8)
      .attr('fill', (d: any) => {
        switch (d.type) {
          case 'University': return '#9C27B0'  // Purple for universities
          case 'Organization': return '#4CAF50'
          case 'Household': return '#FF9800'
          default: return '#2196F3'  // Blue for individuals
        }
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', (d: any) => d.type === 'University' ? 3 : 2)

    // Add labels to nodes
    node.append('text')
      .text((d: any) => d.name)
      .attr('x', 12)
      .attr('y', 4)
      .attr('class', 'node-label')
      .attr('font-size', '12px')
      .attr('font-family', 'sans-serif')
      .attr('fill', '#333')

    // Add hover and click events
    node
      .on('mouseenter', (event, d: any) => {
        setHoveredNode(d)
        const isUniversity = d.type === 'University'
        d3.select(event.currentTarget).select('circle')
          .transition()
          .duration(200)
          .attr('r', isUniversity ? 18 : 12)
          .attr('stroke-width', isUniversity ? 4 : 3)
      })
      .on('mouseleave', (event, d: any) => {
        setHoveredNode(null)
        const isUniversity = d.type === 'University'
        d3.select(event.currentTarget).select('circle')
          .transition()
          .duration(200)
          .attr('r', isUniversity ? 15 : 8)
          .attr('stroke-width', isUniversity ? 3 : 2)
      })
      .on('click', (_event, d: any) => {
        // Only allow clicking on people, not universities
        if (d.type !== 'University') {
          onSelectParty(d.id)
        }
      })

    // Update positions on each tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })

    // Cleanup
    return () => {
      simulation.stop()
    }
  }, [nodes, links, onSelectParty])

  return (
    <div className="graph-view">
      <svg ref={svgRef} className="graph-svg" />
      {hoveredNode && (
        <div className="node-popup">
          <h3>{hoveredNode.name}</h3>
          <div className="popup-content">
            <div className="popup-field">
              <span className="popup-label">Type:</span>
              <span className="popup-value">{hoveredNode.type}</span>
            </div>
            {hoveredNode.title && (
              <div className="popup-field">
                <span className="popup-label">Title:</span>
                <span className="popup-value">{hoveredNode.title}</span>
              </div>
            )}
            {hoveredNode.organization && (
              <div className="popup-field">
                <span className="popup-label">Organization:</span>
                <span className="popup-value">{hoveredNode.organization}</span>
              </div>
            )}
            {hoveredNode.email && (
              <div className="popup-field">
                <span className="popup-label">Email:</span>
                <span className="popup-value">{hoveredNode.email}</span>
              </div>
            )}
            {hoveredNode.h_index !== undefined && hoveredNode.h_index !== null && (
              <div className="popup-field">
                <span className="popup-label">h-index:</span>
                <span className="popup-value">{hoveredNode.h_index}</span>
              </div>
            )}
            {hoveredNode.citation_count !== undefined && hoveredNode.citation_count !== null && (
              <div className="popup-field">
                <span className="popup-label">Citations:</span>
                <span className="popup-value">{hoveredNode.citation_count.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
