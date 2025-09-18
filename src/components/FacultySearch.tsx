'use client'

import { useState, useEffect } from 'react'
import { Faculty } from '@/lib/supabase'
import FacultyCard from './FacultyCard'

interface SearchResult extends Faculty {
  similarity_score?: number
}

interface SearchResponse {
  results: SearchResult[]
  searchType: 'name' | 'similarity' | 'keyword' | 'keyword_fallback' | 'none' | 'failed'
  total: number
  error?: string
}

export default function FacultySearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searchType, setSearchType] = useState<string>('')

  const handleSearch = async () => {
    if (!query.trim()) return

    setLoading(true)
    try {
      const params = new URLSearchParams({
        q: query,
        limit: '20'
      })

      const response = await fetch(`/api/search?${params}`)
      const data: SearchResponse = await response.json()

      if (response.ok) {
        setResults(data.results)
        setSearchType(data.searchType)
      } else {
        console.error('Search error:', data.error)
        setResults([])
      }
    } catch (error) {
      console.error('Search failed:', error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <div className="space-y-6">
      {/* Search Interface */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="space-y-4">
          {/* Main Search Input */}
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Search Faculty
            </label>
            <div className="flex gap-2">
              <input
                id="search"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Search by name or research keywords..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
              />
              <button
                onClick={handleSearch}
                disabled={loading || !query.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Search Results */}
      {query && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Search Results
            </h2>
            {results.length > 0 && (
              <div className="text-sm text-gray-500">
                {results.length} result{results.length !== 1 ? 's' : ''}
                {searchType && (
                  <span className="ml-2 px-2 py-1 bg-gray-100 rounded text-xs">
                    {searchType === 'name' ? 'Name Match' :
                     searchType === 'semantic' ? 'AI Similarity' : 'Keyword Match'}
                  </span>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Searching faculty...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((faculty) => (
                <FacultyCard
                  key={faculty.faculty_id}
                  faculty={faculty}
                  showSimilarity={searchType === 'semantic'}
                />
              ))}
            </div>
          ) : query && !loading ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No faculty found matching your search criteria.</p>
              <p className="text-sm text-gray-500 mt-2">
                Try different keywords or check your filters.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}