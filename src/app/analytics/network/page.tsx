'use client'

import { useState, useEffect } from 'react'
import NetworkVisualization from '@/components/NetworkVisualization'
import Link from 'next/link'

interface NetworkNode {
  id: string
  name: string
  title: string
  school: string
  department: string
  clusterId: number
  color: string
  keywords: string
}

interface NetworkLink {
  source: string
  target: string
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

export default function NetworkPage() {
  const [networkData, setNetworkData] = useState<NetworkData | null>(null)
  const [loading, setLoading] = useState(false)
  const [threshold, setThreshold] = useState(0.3)
  const [maxConnections, setMaxConnections] = useState(8)
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null)

  // Filter states
  const [filterSchool, setFilterSchool] = useState<string>('')
  const [filterDepartment, setFilterDepartment] = useState<string>('')

  // Display states
  const [showClusters, setShowClusters] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const loadNetworkData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        threshold: threshold.toString(),
        maxConnections: maxConnections.toString()
      })

      // Add filter parameters if they exist
      if (filterSchool) {
        params.set('filterSchool', filterSchool)
      }
      if (filterDepartment) {
        params.set('filterDepartment', filterDepartment)
      }

      const response = await fetch(`/api/network?${params}`)
      const data = await response.json()

      if (response.ok) {
        setNetworkData(data)
      } else {
        console.error('Failed to load network data:', data.error)
      }
    } catch (error) {
      console.error('Network loading error:', error)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadNetworkData()
  }, [threshold, maxConnections, filterSchool, filterDepartment])

  const handleNodeClick = (node: NetworkNode) => {
    setSelectedNode(node)
    // Navigate to faculty profile
    window.open(`/faculty/${node.id}`, '_blank')
  }

  const handleNodeHover = (node: NetworkNode | null) => {
    // Handle hover state if needed
  }

  // Helper functions to get unique values for filters
  const getUniqueSchools = (): string[] => {
    if (!networkData?.nodes) return []
    const schools = [...new Set(networkData.nodes.map(node => node.school))]
    return schools.filter(Boolean).sort()
  }

  const getUniqueDepartments = (): string[] => {
    if (!networkData?.nodes) return []
    const departments = [...new Set(networkData.nodes.map(node => node.department))]
    return departments.filter(Boolean).sort()
  }

  // Clear all filters
  const clearFilters = () => {
    setFilterSchool('')
    setFilterDepartment('')
    setSearchQuery('')
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Faculty Research Network
              </h1>
              <p className="text-gray-600">
                Interactive network visualization of faculty research similarities and clusters
              </p>
            </div>
            <Link
              href="/analytics"
              className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              ← Back to Analytics
            </Link>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Network Controls</h2>

          {/* First Row: Network Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Similarity Threshold: {threshold}
              </label>
              <input
                type="range"
                min="0.1"
                max="0.8"
                step="0.05"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0.1 (More connections)</span>
                <span>0.8 (Fewer connections)</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Connections per Faculty: {maxConnections}
              </label>
              <input
                type="range"
                min="3"
                max="15"
                step="1"
                value={maxConnections}
                onChange={(e) => setMaxConnections(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>3 (Sparse)</span>
                <span>15 (Dense)</span>
              </div>
            </div>

            <div className="flex items-end">
              <button
                onClick={loadNetworkData}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Refresh Network'}
              </button>
            </div>
          </div>

          {/* Second Row: Filters and Display Options */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by School
              </label>
              <select
                value={filterSchool}
                onChange={(e) => setFilterSchool(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-black"
              >
                <option value="">All Schools</option>
                {getUniqueSchools().map(school => (
                  <option key={school} value={school}>{school}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Department
              </label>
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-black"
              >
                <option value="">All Departments</option>
                {getUniqueDepartments().map(department => (
                  <option key={department} value={department}>{department}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Faculty
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or keywords..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-black"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Display Options
              </label>
              <div className="space-y-2">
                <button
                  onClick={() => setShowClusters(!showClusters)}
                  className={`w-full px-3 py-1 text-sm rounded-md border ${
                    showClusters
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                      : 'bg-gray-50 border-gray-300 text-gray-600'
                  }`}
                >
                  {showClusters ? '🎨 Hide Clusters' : '🎨 Show Clusters'}
                </button>
                <button
                  onClick={clearFilters}
                  className="w-full px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded-md border border-gray-300 hover:bg-gray-200"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Network Stats */}
        {networkData && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Network Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {networkData.metadata.totalFaculty}
                </div>
                <div className="text-sm text-gray-600">Faculty Members</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {networkData.metadata.totalConnections}
                </div>
                <div className="text-sm text-gray-600">Connections</div>
              </div>
              {networkData.metadata.clustering && (
                <>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {networkData.metadata.clustering.totalClusters}
                    </div>
                    <div className="text-sm text-gray-600">Research Clusters</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {networkData.metadata.clustering.silhouetteScore.toFixed(3)}
                    </div>
                    <div className="text-sm text-gray-600">Quality Score</div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Building faculty network...</p>
          </div>
        )}

        {/* Network Visualization */}
        {networkData && !loading && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Interactive Network Map</h2>
              <p className="text-sm text-gray-600">
                Click and drag nodes to explore • Hover for details • Click to view faculty profile
              </p>
            </div>

            <NetworkVisualization
              data={networkData}
              width={800}
              height={600}
              showClusters={showClusters}
              searchQuery={searchQuery}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
            />
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">How to Use</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
            <div>
              <h4 className="font-medium mb-1">Interaction:</h4>
              <ul className="space-y-1">
                <li>• <strong>Drag nodes</strong> to reposition</li>
                <li>• <strong>Hover</strong> to see details</li>
                <li>• <strong>Click</strong> to open faculty profile</li>
                <li>• <strong>Zoom/Pan</strong> with mouse wheel</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-1">Understanding:</h4>
              <ul className="space-y-1">
                <li>• <strong>Node colors</strong> = Research clusters</li>
                <li>• <strong>Line thickness</strong> = Similarity strength</li>
                <li>• <strong>Distance</strong> = Research similarity</li>
                <li>• <strong>Connections</strong> = Shared interests</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}