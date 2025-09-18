import { createServiceRoleClient } from '@/lib/supabase'
import { searchAdvancedSimilarity } from '@/lib/advanced-similarity'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const school = searchParams.get('school')
    const department = searchParams.get('department')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      )
    }

    const supabase = createServiceRoleClient()

    // Try exact name match first
    let queryBuilder = supabase
      .from('faculty')
      .select('*')
      .ilike('name', `%${query}%`)

    if (school) {
      queryBuilder = queryBuilder.eq('school', school)
    }
    if (department) {
      queryBuilder = queryBuilder.eq('department', department)
    }

    const { data: nameMatches, error: nameError } = await queryBuilder.limit(limit)

    if (nameError) {
      console.error('Name search error:', nameError)
      return NextResponse.json(
        { error: 'Search failed' },
        { status: 500 }
      )
    }

    // If we have exact name matches, return them
    if (nameMatches && nameMatches.length > 0) {
      return NextResponse.json({
        results: nameMatches,
        searchType: 'name',
        total: nameMatches.length
      })
    }

    // If no name matches, try advanced similarity search on keywords
    try {
      const similarityResults = await searchAdvancedSimilarity(query, {
        maxResults: limit,
        minSimilarity: 0.05, // Lower threshold for search
        filterSchool: school || undefined,
        filterDepartment: department || undefined
      })

      if (similarityResults.length > 0) {
        return NextResponse.json({
          results: similarityResults,
          searchType: 'similarity',
          total: similarityResults.length
        })
      }

      // Fallback to keyword search in the keywords field
      const { data: keywordResults, error: keywordError } = await supabase
        .from('faculty')
        .select('*')
        .textSearch('keywords', query)
        .limit(limit)

      if (keywordError) {
        console.error('Keyword search error:', keywordError)
        return NextResponse.json({
          results: [],
          searchType: 'none',
          total: 0
        })
      }

      return NextResponse.json({
        results: keywordResults || [],
        searchType: 'keyword',
        total: (keywordResults || []).length
      })
    } catch (searchError) {
      console.error('Similarity search error:', searchError)

      // Final fallback to keyword search in the keywords field
      try {
        const { data: keywordResults, error: keywordError } = await supabase
          .from('faculty')
          .select('*')
          .textSearch('keywords', query)
          .limit(limit)

        if (keywordError) {
          throw keywordError
        }

        return NextResponse.json({
          results: keywordResults || [],
          searchType: 'keyword_fallback',
          total: (keywordResults || []).length
        })
      } catch (finalError) {
        console.error('All search methods failed:', finalError)
        return NextResponse.json({
          results: [],
          searchType: 'failed',
          total: 0
        })
      }
    }
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}