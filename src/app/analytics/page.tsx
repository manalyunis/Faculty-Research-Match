'use client'

import { useState, useEffect } from 'react'

interface Cluster {
  cluster_id: number
  size: number
  members: Array<{
    faculty_id: string
    name: string
    title: string
    school: string
    department: string
  }>
}

interface Topic {
  topic_id: number
  keyword: string
  frequency: number
  faculty_count: number
  associated_faculty: Array<{
    faculty_id: string
    name: string
    department: string
  }>
}

export default function AnalyticsPage() {
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'clusters' | 'topics'>('clusters')
  const [clusterMetadata, setClusterMetadata] = useState<any>(null)
  const [topicsMetadata, setTopicsMetadata] = useState<any>(null)

  const loadClusters = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/clusters?minClusterSize=5')
      const data = await response.json()

      if (data.clusters) {
        setClusters(data.clusters)
        setClusterMetadata(data)
      }
    } catch (error) {
      console.error('Failed to load clusters:', error)
    }
    setLoading(false)
  }

  const loadTopics = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/topics?numTopics=15')
      const data = await response.json()

      if (data.topics) {
        setTopics(data.topics)
        setTopicsMetadata(data)
      }
    } catch (error) {
      console.error('Failed to load topics:', error)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (activeTab === 'clusters') {
      loadClusters()
    } else {
      loadTopics()
    }
  }, [activeTab])

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Faculty Research Analytics
          </h1>
          <p className="text-gray-600">
            Advanced clustering and topic modeling powered by sentence transformers
          </p>
        </div>

        {/* Navigation */}
        <div className="mb-6">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 mb-4">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('clusters')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'clusters'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Research Clusters
              </button>
              <button
                onClick={() => setActiveTab('topics')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'topics'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Research Topics
              </button>
            </nav>
          </div>

          {/* Quick Action */}
          <div className="flex justify-end">
            <a
              href="/analytics/network"
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Interactive Network Map
            </a>
          </div>
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">
              {activeTab === 'clusters' ? 'Computing clusters...' : 'Analyzing topics...'}
            </p>
          </div>
        )}

        {/* Clusters Tab */}
        {activeTab === 'clusters' && !loading && (
          <div>
            {clusterMetadata && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Clustering Summary</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {clusterMetadata.total_clusters}
                    </div>
                    <div className="text-sm text-gray-600">Total Clusters</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {clusterMetadata.metadata?.total_faculty}
                    </div>
                    <div className="text-sm text-gray-600">Faculty Analyzed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {clusterMetadata.outliers}
                    </div>
                    <div className="text-sm text-gray-600">Outliers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {clusterMetadata.silhouette_score?.toFixed(3)}
                    </div>
                    <div className="text-sm text-gray-600">Quality Score</div>
                  </div>
                </div>
                <div className="mt-4 text-sm text-gray-600">
                  Algorithm: {clusterMetadata.algorithm_used} |
                  Generated: {new Date(clusterMetadata.metadata?.timestamp).toLocaleString()}
                </div>
              </div>
            )}

            <div className="grid gap-6">
              {clusters.map((cluster) => (
                <div key={cluster.cluster_id} className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="bg-blue-50 px-6 py-4 border-b">
                    <h3 className="text-lg font-semibold text-blue-900">
                      Cluster {cluster.cluster_id + 1}
                    </h3>
                    <p className="text-sm text-blue-700">
                      {cluster.size} faculty members
                    </p>
                  </div>
                  <div className="p-6">
                    <div className="grid gap-3">
                      {cluster.members.slice(0, 8).map((member) => (
                        <div key={member.faculty_id} className="flex items-center justify-between py-2 border-b border-gray-100">
                          <div>
                            <div className="font-medium text-gray-900">
                              {member.name}
                            </div>
                            <div className="text-sm text-gray-600">
                              {member.title} • {member.department}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">
                            {member.school}
                          </div>
                        </div>
                      ))}
                      {cluster.size > 8 && (
                        <div className="text-center py-2 text-sm text-gray-500">
                          ... and {cluster.size - 8} more faculty members
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Topics Tab */}
        {activeTab === 'topics' && !loading && (
          <div>
            {topicsMetadata && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Topic Analysis Summary</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {topicsMetadata.topics?.length}
                    </div>
                    <div className="text-sm text-gray-600">Top Topics</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {topicsMetadata.unique_keywords?.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Unique Keywords</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {topicsMetadata.total_keywords?.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Total Keywords</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {topicsMetadata.coverage}
                    </div>
                    <div className="text-sm text-gray-600">Faculty with Keywords</div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4">
              {topics.map((topic) => (
                <div key={topic.topic_id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 capitalize">
                      {topic.keyword}
                    </h3>
                    <div className="flex space-x-4 text-sm text-gray-600">
                      <span>{topic.frequency} mentions</span>
                      <span>{topic.faculty_count} faculty</span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${Math.min((topic.frequency / (topics[0]?.frequency || 1)) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {topic.associated_faculty.slice(0, 6).map((faculty) => (
                      <div key={faculty.faculty_id} className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-blue-700">
                            {faculty.name.split(' ')[0]?.[0]}{faculty.name.split(' ')[1]?.[0]}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {faculty.name}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {faculty.department}
                          </div>
                        </div>
                      </div>
                    ))}
                    {topic.faculty_count > 6 && (
                      <div className="text-center text-sm text-gray-500 md:col-span-2">
                        ... and {topic.faculty_count - 6} more faculty members
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}