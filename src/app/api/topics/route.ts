import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'
import { advancedSimilarityService } from '@/lib/advanced-similarity'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const numTopics = parseInt(searchParams.get('numTopics') || '15')
    const filterSchool = searchParams.get('filterSchool') || undefined
    const filterDepartment = searchParams.get('filterDepartment') || undefined

    console.log('🔍 Starting research topic analysis...')

    const supabase = createServiceRoleClient()

    // Build query with optional filters
    let query = supabase
      .from('faculty')
      .select('faculty_id, name, title, school, department, keywords')

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

    console.log(`Analyzing topics from ${faculty.length} faculty members...`)

    // Prepare faculty data for topic analysis
    const facultyData = faculty.map(f => ({
      faculty_id: f.faculty_id,
      name: f.name,
      title: f.title,
      school: f.school,
      department: f.department,
      keywords: f.keywords || ''
    }))

    // Perform topic analysis
    const topicsResult = await advancedSimilarityService.analyzeTopics(
      facultyData,
      numTopics
    )

    if (!topicsResult) {
      return NextResponse.json(
        { error: 'Topic analysis failed' },
        { status: 500 }
      )
    }

    console.log(`✅ Topic analysis complete: ${topicsResult.topics.length} topics identified`)

    return NextResponse.json({
      ...topicsResult,
      metadata: {
        total_faculty: faculty.length,
        filters: {
          school: filterSchool,
          department: filterDepartment,
          numTopics
        },
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Topic analysis API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}