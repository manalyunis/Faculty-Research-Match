'use client'

import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

interface NetworkNode {
  id: string
  name: string
  title: string
  school: string
  department: string
  clusterId: number
  color: string
  keywords: string
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

interface NetworkLink {
  source: string | NetworkNode
  target: string | NetworkNode
  similarity: number
  weight: number
}

interface NetworkData {
  nodes: NetworkNode[]
  links: NetworkLink[]
  clusterInfo?: Record<number, { name: string; size: number; color: string }>
  metadata: {
    totalFaculty: number
    totalConnections: number
    similarityThreshold: number
    clustering?: {
      algorithm: string
      totalClusters: number
      silhouetteScore: number
    }
  }
}

interface NetworkVisualizationProps {
  data: NetworkData
  width?: number
  height?: number
  showClusters?: boolean
  searchQuery?: string
  onNodeClick?: (node: NetworkNode) => void
  onNodeHover?: (node: NetworkNode | null) => void
}

export default function NetworkVisualization({
  data,
  width = 800,
  height = 600,
  showClusters = true,
  searchQuery = '',
  onNodeClick,
  onNodeHover
}: NetworkVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoveredNode, setHoveredNode] = useState<NetworkNode | null>(null)

  // Helper function to check if a node matches the search query
  const nodeMatchesSearch = (node: NetworkNode): boolean => {
    if (!searchQuery.trim()) return false
    const query = searchQuery.toLowerCase()
    return (
      node.name.toLowerCase().includes(query) ||
      node.department.toLowerCase().includes(query) ||
      node.school.toLowerCase().includes(query) ||
      (node.keywords && node.keywords.toLowerCase().includes(query))
    )
  }

  // Get highlighted nodes based on search
  const highlightedNodes = new Set(
    searchQuery.trim() ? data.nodes.filter(nodeMatchesSearch).map(n => n.id) : []
  )

  useEffect(() => {
    if (!data || !data.nodes || !data.links || !svgRef.current) return

    // Clear previous visualization
    d3.select(svgRef.current).selectAll('*').remove()

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)

    // Create container for zoom/pan
    const container = svg.append('g')

    // Set up zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on('zoom', (event) => {
        container.attr('transform', event.transform)
      })

    svg.call(zoom)

    // Create force simulation
    const simulation = d3.forceSimulation<NetworkNode>(data.nodes)
      .force('link', d3.forceLink<NetworkNode, NetworkLink>(data.links)
        .id(d => d.id)
        .distance(d => 50 + (1 - d.similarity) * 100) // Shorter distance for higher similarity
        .strength(d => d.similarity * 0.5)
      )
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(15))

    // Create links
    const links = container.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(data.links)
      .enter()
      .append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => Math.sqrt(d.weight))

    // Create nodes
    const nodes = container.append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(data.nodes)
      .enter()
      .append('circle')
      .attr('r', d => {
        if (highlightedNodes.has(d.id)) return 12 // Larger for search matches
        return 8
      })
      .attr('fill', d => {
        if (!showClusters) return '#6b7280' // Gray when clusters are hidden
        return d.color
      })
      .attr('stroke', d => {
        if (highlightedNodes.has(d.id)) return '#f59e0b' // Golden border for search matches
        return '#fff'
      })
      .attr('stroke-width', d => {
        if (highlightedNodes.has(d.id)) return 3 // Thicker border for search matches
        return 2
      })
      .style('cursor', 'pointer')
      .style('opacity', d => {
        if (!searchQuery.trim()) return 1 // Full opacity when no search
        return highlightedNodes.has(d.id) ? 1 : 0.3 // Dim non-matching nodes
      })
      .call(d3.drag<SVGCircleElement, NetworkNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null
          d.fy = null
        })
      )

    // Add node labels
    const labels = container.append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(data.nodes)
      .enter()
      .append('text')
      .text(d => d.name.split(',')[0].replace('Dr. ', '').replace('Mr. ', '').replace('Ms. ', ''))
      .attr('font-size', '10px')
      .attr('font-family', 'Arial, sans-serif')
      .attr('text-anchor', 'middle')
      .attr('dy', 25)
      .attr('fill', '#333')
      .style('pointer-events', 'none')
      .style('opacity', 0.7)

    // Add hover and click interactions
    nodes
      .on('mouseenter', (event, d) => {
        setHoveredNode(d)
        onNodeHover?.(d)

        // Highlight connected nodes
        const connectedNodes = new Set<string>()
        data.links.forEach(link => {
          if (typeof link.source === 'object' && typeof link.target === 'object') {
            if (link.source.id === d.id) connectedNodes.add(link.target.id)
            if (link.target.id === d.id) connectedNodes.add(link.source.id)
          }
        })

        nodes
          .style('opacity', node => node.id === d.id || connectedNodes.has(node.id) ? 1 : 0.3)
          .attr('r', node => node.id === d.id ? 12 : 8)

        links
          .style('opacity', link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source
            const targetId = typeof link.target === 'object' ? link.target.id : link.target
            return sourceId === d.id || targetId === d.id ? 0.8 : 0.1
          })
          .attr('stroke-width', link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source
            const targetId = typeof link.target === 'object' ? link.target.id : link.target
            return sourceId === d.id || targetId === d.id ? Math.sqrt(link.weight) * 2 : Math.sqrt(link.weight)
          })
      })
      .on('mouseleave', () => {
        setHoveredNode(null)
        onNodeHover?.(null)

        // Reset all nodes and links
        nodes
          .style('opacity', 1)
          .attr('r', 8)

        links
          .style('opacity', 0.6)
          .attr('stroke-width', d => Math.sqrt(d.weight))
      })
      .on('click', (event, d) => {
        onNodeClick?.(d)
      })

    // Update positions on each tick
    simulation.on('tick', () => {
      links
        .attr('x1', d => (d.source as NetworkNode).x!)
        .attr('y1', d => (d.source as NetworkNode).y!)
        .attr('x2', d => (d.target as NetworkNode).x!)
        .attr('y2', d => (d.target as NetworkNode).y!)

      nodes
        .attr('cx', d => d.x!)
        .attr('cy', d => d.y!)

      labels
        .attr('x', d => d.x!)
        .attr('y', d => d.y!)
    })

    // Cleanup function
    return () => {
      simulation.stop()
    }
  }, [data, width, height, showClusters, searchQuery, onNodeClick, onNodeHover])

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        className="border border-gray-200 rounded-lg bg-white"
        style={{ width: '100%', height: `${height}px` }}
      />

      {/* Tooltip */}
      {hoveredNode && (
        <div className="absolute top-4 left-4 bg-white p-3 rounded-lg shadow-lg border max-w-xs z-10">
          <h4 className="font-semibold text-sm text-gray-900">{hoveredNode.name}</h4>
          <p className="text-xs text-gray-600 mt-1">{hoveredNode.title}</p>
          <p className="text-xs text-gray-600">{hoveredNode.department}</p>
          <p className="text-xs text-gray-500 mt-1">{hoveredNode.school}</p>
          {hoveredNode.keywords && (
            <p className="text-xs text-gray-500 mt-2 truncate">
              Keywords: {hoveredNode.keywords.substring(0, 100)}...
            </p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white p-3 rounded-lg shadow-lg border max-w-xs">
        <h5 className="font-semibold text-sm text-gray-900 mb-2">
          {showClusters ? 'Research Clusters' : 'Network View'}
        </h5>

        {/* Search Results */}
        {searchQuery.trim() && (
          <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
            <div className="flex items-center space-x-2 mb-1">
              <div className="w-3 h-3 rounded-full bg-amber-500 border border-amber-600"></div>
              <span className="text-xs font-medium text-amber-800">Search Results</span>
            </div>
            <p className="text-xs text-amber-700">
              {highlightedNodes.size} faculty match "{searchQuery}"
            </p>
          </div>
        )}

        {/* Cluster Colors */}
        {showClusters ? (
          <div className="space-y-1 mb-3">
            {(() => {
              // Get unique clusters from nodes
              const clusters = Array.from(new Set(data.nodes.map(node => node.clusterId)))
                .sort((a, b) => a - b)
                .slice(0, 8) // Limit to first 8 clusters for space

              return clusters.map(clusterId => {
                const clusterInfo = data.clusterInfo?.[clusterId]
                const clusterNodes = data.nodes.filter(node => node.clusterId === clusterId)
                const clusterColor = clusterInfo?.color || clusterNodes[0]?.color || '#6b7280'
                const clusterSize = clusterInfo?.size || clusterNodes.length
                const clusterName = clusterInfo?.name || `Cluster ${clusterId + 1}`

                return (
                  <div key={clusterId} className="flex items-center space-x-2">
                    <div
                      className="w-3 h-3 rounded-full border border-gray-300"
                      style={{ backgroundColor: clusterColor }}
                    ></div>
                    <span className="text-xs text-gray-700 truncate" title={`${clusterName} (${clusterSize} faculty)`}>
                      {clusterName} ({clusterSize})
                    </span>
                  </div>
                )
              })
            })()}
            {data.nodes.some(node => node.clusterId >= 8) && (
              <div className="text-xs text-gray-500 italic">
                ... and more clusters
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1 mb-3">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full border border-gray-300 bg-gray-500"></div>
              <span className="text-xs text-gray-700">All Faculty (no clusters)</span>
            </div>
          </div>
        )}

        {/* Network Stats */}
        <div className="space-y-1 pt-2 border-t border-gray-200">
          {data.metadata.clustering && (
            <p className="text-xs text-gray-600">
              {data.metadata.clustering.totalClusters} total clusters
            </p>
          )}
          <p className="text-xs text-gray-600">
            {data.metadata.totalConnections} connections
          </p>
          <p className="text-xs text-gray-600">
            Similarity ≥ {data.metadata.similarityThreshold}
          </p>
        </div>
      </div>
    </div>
  )
}