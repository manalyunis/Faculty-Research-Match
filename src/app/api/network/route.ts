import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/database'
import { advancedSimilarityService } from '@/lib/advanced-similarity'

function extractReal384Embedding(embedding1536: number[]): number[] {
  if (embedding1536.length !== 1536) {
    throw new Error(`Expected 1536 dimensions, got ${embedding1536.length}`)
  }
  return embedding1536.slice(0, 384)
}

function calculateCosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))

  if (magnitudeA === 0 || magnitudeB === 0) return 0
  return dotProduct / (magnitudeA * magnitudeB)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const threshold = parseFloat(searchParams.get('threshold') || '0.2')
    const maxConnections = parseInt(searchParams.get('maxConnections') || '10')
    const filterSchool = searchParams.get('filterSchool') || undefined
    const filterDepartment = searchParams.get('filterDepartment') || undefined

    console.log('🌐 Building faculty network graph...')

    const supabase = createServiceRoleClient()

    // Get faculty with embeddings and cluster information
    let query = supabase
      .from('faculty')
      .select('faculty_id, name, title, school, department, keywords, embedding')
      .not('embedding', 'is', null)

    if (filterSchool) {
      query = query.eq('school', filterSchool)
    }
    if (filterDepartment) {
      query = query.eq('department', filterDepartment)
    }

    const { data: faculty, error } = await query

    if (error || !faculty) {
      console.error('Failed to fetch faculty data:', error)
      return NextResponse.json(
        { error: 'Failed to fetch faculty data' },
        { status: 500 }
      )
    }

    console.log(`Processing ${faculty.length} faculty for network...`)

    // Use department-based clustering (advanced clustering not available with Transformers.js)
    // Build nodes with department-based cluster information
    const departments = [...new Set(faculty.map(f => f.department))]
    const nodes = faculty.map((f, index) => {
      const clusterId = departments.indexOf(f.department)
      const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6b7280', '#14b8a6']
      const clusterColor = colors[clusterId % colors.length]

      return {
        id: f.faculty_id,
        name: f.name,
        title: f.title,
        school: f.school,
        department: f.department,
        clusterId,
        color: clusterColor,
        keywords: f.keywords || ''
      }
    })

    // Calculate similarity connections
    const links: Array<{
      source: string
      target: string
      similarity: number
      weight: number
    }> = []

    console.log('Calculating similarity matrix...')

    // Extract embeddings for similarity calculation
    const embeddings = faculty.map(f => {
      const storedEmbedding = JSON.parse(f.embedding)
      if (storedEmbedding.length === 1536) {
        return extractReal384Embedding(storedEmbedding)
      } else if (storedEmbedding.length === 384) {
        return storedEmbedding
      } else {
        throw new Error(`Unexpected embedding size: ${storedEmbedding.length}`)
      }
    })

    // Calculate pairwise similarities (optimized for performance)
    for (let i = 0; i < faculty.length; i++) {
      const connections = []

      for (let j = i + 1; j < faculty.length; j++) {
        const similarity = calculateCosineSimilarity(embeddings[i], embeddings[j])

        if (similarity >= threshold) {
          connections.push({
            target: faculty[j].faculty_id,
            similarity,
            weight: Math.min(similarity * 5, 3) // Scale for visual weight
          })
        }
      }

      // Limit connections per node for performance
      connections
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, maxConnections)
        .forEach(conn => {
          links.push({
            source: faculty[i].faculty_id,
            target: conn.target,
            similarity: conn.similarity,
            weight: conn.weight
          })
        })
    }

    // Generate cluster names based on research keywords only
    const generateClusterName = (clusterNodes: any[], clusterId: number): string => {
      // Common words to filter out
      const commonWords = new Set(['research', 'study', 'analysis', 'development', 'design', 'methods', 'applications', 'systems', 'technology', 'science', 'engineering'])

      // Get most common keywords
      const keywordCounts: Record<string, number> = {}
      clusterNodes.forEach(node => {
        if (node.keywords) {
          const keywords = node.keywords.toLowerCase()
            .split(/[,;]/)
            .map((kw: string) => kw.trim())
            .filter((kw: string) => kw.length > 2 && !commonWords.has(kw))

          keywords.forEach((keyword: string) => {
            keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1
          })
        }
      })

      // Sort keywords by frequency
      const sortedKeywords = Object.entries(keywordCounts)
        .sort(([,a], [,b]) => b - a)

      if (sortedKeywords.length === 0) {
        return `Research Cluster ${clusterId + 1}`
      }

      const topKeyword = sortedKeywords[0]
      const secondKeyword = sortedKeywords[1]

      // Threshold for using keywords (20% of cluster members)
      const threshold = Math.max(1, Math.ceil(clusterNodes.length * 0.2))

      // Strategy 1: Single strong keyword
      if (topKeyword[1] >= threshold) {
        const formattedKeyword = topKeyword[0]
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')

        // Strategy 2: Combine with second keyword if both are strong
        if (secondKeyword && secondKeyword[1] >= threshold && secondKeyword[1] >= topKeyword[1] * 0.7) {
          const formattedSecondKeyword = secondKeyword[0]
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
          return `${formattedKeyword} & ${formattedSecondKeyword}`
        }

        return formattedKeyword
      }

      // Strategy 3: Use most frequent keyword even if below threshold
      if (sortedKeywords.length > 0) {
        const formattedKeyword = topKeyword[0]
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
        return formattedKeyword
      }

      // Fallback
      return `Research Cluster ${clusterId + 1}`
    }

    // Create cluster information with names
    const clusterInfo = new Map<number, { name: string; size: number; color: string }>()

    // Group nodes by cluster
    const clusterGroups = nodes.reduce((acc, node) => {
      if (!acc[node.clusterId]) {
        acc[node.clusterId] = []
      }
      acc[node.clusterId].push(node)
      return acc
    }, {} as Record<number, any[]>)

    // Generate names for each cluster
    Object.entries(clusterGroups).forEach(([clusterIdStr, clusterNodes]) => {
      const clusterId = parseInt(clusterIdStr)
      const clusterName = generateClusterName(clusterNodes, clusterId)
      clusterInfo.set(clusterId, {
        name: clusterName,
        size: clusterNodes.length,
        color: clusterNodes[0]?.color || '#6b7280'
      })
    })

    console.log(`✅ Network built: ${nodes.length} nodes, ${links.length} connections`)

    return NextResponse.json({
      nodes,
      links,
      clusterInfo: Object.fromEntries(clusterInfo),
      metadata: {
        totalFaculty: faculty.length,
        totalConnections: links.length,
        similarityThreshold: threshold,
        maxConnectionsPerNode: maxConnections,
        clustering: {
          algorithm: 'department-based',
          totalClusters: departments.length,
          note: 'Using department-based grouping. Advanced clustering (HDBSCAN) not available in this deployment.'
        },
        filters: {
          school: filterSchool,
          department: filterDepartment
        },
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Network API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}