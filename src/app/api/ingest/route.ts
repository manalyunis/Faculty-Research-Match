import { createServiceRoleClient } from '@/lib/database'
import { generateEmbeddings, padEmbeddingTo1536 } from '@/lib/transformers-embedding'
import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering - don't prerender during build (Transformers.js needs runtime)
export const dynamic = 'force-dynamic'

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

    // Generate embeddings for all faculty keywords using Transformers.js
    console.log(`Generating embeddings for ${validatedFaculty.length} faculty members...`)

    try {
      const keywordsTexts = validatedFaculty.map(f => f.keywords)
      const embeddings = await generateEmbeddings(keywordsTexts)

      // Pad from 384-dim to 1536-dim for database compatibility
      const paddedEmbeddings = embeddings.map(emb => padEmbeddingTo1536(emb))

      // Combine faculty data with embeddings
      const facultyWithEmbeddings = validatedFaculty.map((faculty, index) => ({
        ...faculty,
        embedding: paddedEmbeddings[index]
      }))

      // Insert into database using raw SQL (PostgreSQL doesn't have Supabase's upsert method)
      const db = supabase as any
      const insertedCount = await db.transaction(async (client: any) => {
        let count = 0
        for (const faculty of facultyWithEmbeddings) {
          const result = await client.query(
            `INSERT INTO faculty (faculty_id, name, keywords, title, school, department, embedding)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (faculty_id) DO UPDATE SET
               name = EXCLUDED.name,
               keywords = EXCLUDED.keywords,
               title = EXCLUDED.title,
               school = EXCLUDED.school,
               department = EXCLUDED.department,
               embedding = EXCLUDED.embedding,
               updated_at = NOW()`,
            [faculty.faculty_id, faculty.name, faculty.keywords, faculty.title, faculty.school, faculty.department, JSON.stringify(faculty.embedding)]
          )
          count += result.rowCount || 0
        }
        return count
      })

      return NextResponse.json({
        message: `Successfully processed ${validatedFaculty.length} faculty members`,
        inserted: insertedCount,
        faculty: validatedFaculty.map(f => ({ faculty_id: f.faculty_id, name: f.name }))
      })

    } catch (embeddingError) {
      console.error('Embedding generation error:', embeddingError)

      // Fallback: Insert without embeddings using raw SQL
      const db = supabase as any
      const insertedCount = await db.transaction(async (client: any) => {
        let count = 0
        for (const faculty of validatedFaculty) {
          const result = await client.query(
            `INSERT INTO faculty (faculty_id, name, keywords, title, school, department)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (faculty_id) DO UPDATE SET
               name = EXCLUDED.name,
               keywords = EXCLUDED.keywords,
               title = EXCLUDED.title,
               school = EXCLUDED.school,
               department = EXCLUDED.department,
               updated_at = NOW()`,
            [faculty.faculty_id, faculty.name, faculty.keywords, faculty.title, faculty.school, faculty.department]
          )
          count += result.rowCount || 0
        }
        return count
      })

      return NextResponse.json({
        message: `Successfully processed ${validatedFaculty.length} faculty members (without embeddings)`,
        inserted: insertedCount,
        warning: 'Embeddings were not generated due to model error',
        faculty: validatedFaculty.map(f => ({ faculty_id: f.faculty_id, name: f.name }))
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
