import { createServiceRoleClient } from '@/lib/supabase'
import { generateEmbeddings, prepareKeywordsForEmbedding } from '@/lib/openai'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    // Validate required fields
    if (!data.faculty || !Array.isArray(data.faculty)) {
      return NextResponse.json(
        { error: 'Invalid data format. Expected "faculty" array.' },
        { status: 400 }
      )
    }

    const supabase = createServiceRoleClient()

    // Validate each faculty record
    const validatedFaculty = []
    const requiredFields = ['faculty_id', 'name', 'keywords', 'title', 'school', 'department']

    for (const faculty of data.faculty) {
      const missingFields = requiredFields.filter(field => !faculty[field] || faculty[field].trim() === '')

      if (missingFields.length > 0) {
        return NextResponse.json(
          {
            error: `Missing required fields for faculty ${faculty.faculty_id || 'unknown'}: ${missingFields.join(', ')}`
          },
          { status: 400 }
        )
      }

      validatedFaculty.push({
        faculty_id: faculty.faculty_id.trim(),
        name: faculty.name.trim(),
        keywords: faculty.keywords.trim(),
        title: faculty.title.trim(),
        school: faculty.school.trim(),
        department: faculty.department.trim()
      })
    }

    // Generate embeddings for all faculty keywords
    console.log(`Generating embeddings for ${validatedFaculty.length} faculty members...`)

    try {
      const keywordsTexts = validatedFaculty.map(f => prepareKeywordsForEmbedding(f.keywords))
      const embeddings = await generateEmbeddings(keywordsTexts)

      // Combine faculty data with embeddings
      const facultyWithEmbeddings = validatedFaculty.map((faculty, index) => ({
        ...faculty,
        embedding: embeddings[index]
      }))

      // Insert into database using upsert to handle updates
      const { data: insertedData, error: insertError } = await supabase
        .from('faculty')
        .upsert(facultyWithEmbeddings, {
          onConflict: 'faculty_id',
          ignoreDuplicates: false
        })
        .select('faculty_id, name')

      if (insertError) {
        console.error('Database insert error:', insertError)
        return NextResponse.json(
          { error: 'Failed to insert faculty data into database' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        message: `Successfully processed ${validatedFaculty.length} faculty members`,
        inserted: insertedData?.length || validatedFaculty.length,
        faculty: insertedData
      })

    } catch (embeddingError) {
      console.error('Embedding generation error:', embeddingError)

      // Fallback: Insert without embeddings
      const { data: insertedData, error: insertError } = await supabase
        .from('faculty')
        .upsert(validatedFaculty, {
          onConflict: 'faculty_id',
          ignoreDuplicates: false
        })
        .select('faculty_id, name')

      if (insertError) {
        console.error('Database insert error:', insertError)
        return NextResponse.json(
          { error: 'Failed to insert faculty data into database' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        message: `Successfully processed ${validatedFaculty.length} faculty members (without embeddings)`,
        inserted: insertedData?.length || validatedFaculty.length,
        warning: 'Embeddings were not generated due to API error',
        faculty: insertedData
      })
    }

  } catch (error) {
    console.error('Ingest API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper endpoint to check the status of the ingest API
export async function GET() {
  return NextResponse.json({
    message: 'Faculty data ingest API is ready',
    endpoints: {
      POST: '/api/ingest - Upload faculty data in JSON format',
      expectedFormat: {
        faculty: [
          {
            faculty_id: 'string',
            name: 'string',
            keywords: 'string',
            title: 'string',
            school: 'string',
            department: 'string'
          }
        ]
      }
    }
  })
}