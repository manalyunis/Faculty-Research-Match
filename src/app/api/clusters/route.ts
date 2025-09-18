import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'
import { advancedSimilarityService } from '@/lib/advanced-similarity'

function extractReal384Embedding(embedding1536: number[]): number[] {
  if (embedding1536.length !== 1536) {
    throw new Error(`Expected 1536 dimensions, got ${embedding1536.length}`)
  }
  return embedding1536.slice(0, 384)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const minClusterSize = parseInt(searchParams.get('minClusterSize') || '3')
    const filterSchool = searchParams.get('filterSchool') || undefined
    const filterDepartment = searchParams.get('filterDepartment') || undefined

    console.log('🔍 Starting faculty clustering analysis...')

    const supabase = createServiceRoleClient()

    // Build query with optional filters
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

    if (faculty.length < minClusterSize) {
      return NextResponse.json({
        clusters: [],
        outliers: 0,
        total_clusters: 0,
        message: `Not enough faculty (${faculty.length}) for clustering with min size ${minClusterSize}`
      })
    }

    console.log(`Processing ${faculty.length} faculty for clustering...`)

    // Extract real 384-dimension embeddings
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

    // Prepare faculty data for clustering
    const facultyData = faculty.map(f => ({
      faculty_id: f.faculty_id,
      name: f.name,
      title: f.title,
      school: f.school,
      department: f.department,
      keywords: f.keywords
    }))

    // Perform clustering
    const clusteringResult = await advancedSimilarityService.clusterFaculty(
      embeddings,
      facultyData,
      minClusterSize
    )

    if (!clusteringResult) {
      return NextResponse.json(
        { error: 'Clustering analysis failed' },
        { status: 500 }
      )
    }

    console.log(`✅ Clustering complete: ${clusteringResult.total_clusters} clusters found`)

    return NextResponse.json({
      ...clusteringResult,
      metadata: {
        total_faculty: faculty.length,
        filters: {
          school: filterSchool,
          department: filterDepartment,
          minClusterSize
        },
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Clustering API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}