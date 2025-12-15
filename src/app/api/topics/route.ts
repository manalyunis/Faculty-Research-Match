import { createServiceRoleClient } from '@/lib/database'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Topics Analysis API - JavaScript-based keyword analysis
 * Analyzes the most common research keywords across faculty
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const numTopics = parseInt(searchParams.get('numTopics') || '15')
    const minFaculty = parseInt(searchParams.get('minFaculty') || '2')

    const supabase = createServiceRoleClient()

    // Get all faculty with keywords
    const { data: faculty, error } = await supabase
      .from('faculty')
      .select('faculty_id, name, department, keywords')
      .not('keywords', 'is', null)
      .execute()

    if (error || !faculty) {
      throw new Error('Failed to fetch faculty data')
    }

    // Parse and count keywords
    const keywordMap = new Map<string, Set<string>>()

    faculty.forEach(f => {
      if (!f.keywords || f.keywords.trim().toLowerCase() === 'no keywords') return

      // Split by common delimiters and clean
      const keywords = f.keywords
        .split(/[,;\n\r]+/)
        .map(k => k.trim().toLowerCase())
        .filter(k =>
          k.length > 3 &&
          k.length < 50 &&
          k !== 'no keywords' &&
          !k.startsWith('http') && // Skip URLs
          !/^\d+$/.test(k) // Skip pure numbers
        )

      keywords.forEach(keyword => {
        if (!keywordMap.has(keyword)) {
          keywordMap.set(keyword, new Set())
        }
        keywordMap.get(keyword)!.add(f.faculty_id)
      })
    })

    // Convert to array and sort by frequency
    const topics = Array.from(keywordMap.entries())
      .map(([keyword, facultyIds]) => ({
        keyword,
        frequency: facultyIds.size,
        faculty_count: facultyIds.size,
        faculty_ids: Array.from(facultyIds)
      }))
      .filter(t => t.faculty_count >= minFaculty)
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, numTopics)

    // Add associated faculty details
    const topicsWithFaculty = topics.map(topic => {
      const associatedFaculty = faculty
        .filter(f => topic.faculty_ids.includes(f.faculty_id))
        .slice(0, 10)
        .map(f => ({
          faculty_id: f.faculty_id,
          name: f.name,
          department: f.department
        }))

      return {
        topic_id: topics.indexOf(topic),
        keyword: topic.keyword,
        frequency: topic.frequency,
        faculty_count: topic.faculty_count,
        associated_faculty: associatedFaculty
      }
    })

    return NextResponse.json({
      topics: topicsWithFaculty,
      unique_keywords: keywordMap.size,
      total_keywords: Array.from(keywordMap.values()).reduce((sum, set) => sum + set.size, 0),
      coverage: faculty.length
    })
  } catch (error) {
    console.error('Topics analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze topics' },
      { status: 500 }
    )
  }
}
