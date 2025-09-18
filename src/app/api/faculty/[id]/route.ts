import { createServiceRoleClient } from '@/lib/supabase'
import { calculateAdvancedSimilarity } from '@/lib/advanced-similarity'
import { calculateSimilarFaculty } from '@/lib/similarity'
import { NextRequest, NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  try {
    const { searchParams } = new URL(request.url)
    const similarityCount = parseInt(searchParams.get('k') || '10')
    const school = searchParams.get('school')
    const department = searchParams.get('department')

    const supabase = createServiceRoleClient()

    // Get the faculty member
    const { data: faculty, error: facultyError } = await supabase
      .from('faculty')
      .select('*')
      .eq('faculty_id', id)
      .single()

    if (facultyError || !faculty) {
      return NextResponse.json(
        { error: 'Faculty member not found' },
        { status: 404 }
      )
    }

    // Find similar faculty using advanced similarity (with TF-IDF fallback)
    let similarFaculty: Array<{
      faculty_id: string
      name: string
      title: string
      school: string
      department: string
      similarity: number
    }> = []

    try {
      // Use advanced similarity with TF-IDF fallback
      const similarityResults = await calculateAdvancedSimilarity(id, {
        maxResults: Math.min(similarityCount, 8), // Limit to 8 for speed
        minSimilarity: 0.1,
        filterSchool: school || undefined,
        filterDepartment: department || undefined
      })

      similarFaculty = similarityResults
    } catch (error) {
      console.error('Error finding similar faculty:', error)
      // Continue without similar faculty if calculation fails
    }

    return NextResponse.json({
      faculty: {
        faculty_id: faculty.faculty_id,
        name: faculty.name,
        title: faculty.title,
        school: faculty.school,
        department: faculty.department,
        keywords: faculty.keywords,
        created_at: faculty.created_at,
        updated_at: faculty.updated_at
      },
      similar: similarFaculty.map((f) => ({
        faculty_id: f.faculty_id,
        name: f.name,
        title: f.title,
        school: f.school,
        department: f.department,
        score: Math.round(f.similarity * 100) / 100 // Round to 2 decimal places
      }))
    })
  } catch (error) {
    console.error('Faculty API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}