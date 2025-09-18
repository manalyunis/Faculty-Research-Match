'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import FacultyCard from '@/components/FacultyCard'

interface FacultyProfile {
  faculty_id: string
  name: string
  title: string
  school: string
  department: string
  keywords: string
  created_at: string
  updated_at: string
}

interface SimilarFaculty {
  faculty_id: string
  name: string
  title: string
  school: string
  department: string
  score: number
}

interface FacultyData {
  faculty: FacultyProfile
  similar: SimilarFaculty[]
}

export default function FacultyProfilePage() {
  const params = useParams()
  const id = params.id as string

  const [data, setData] = useState<FacultyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchFacultyData() {
      if (!id) return

      try {
        setLoading(true)
        const response = await fetch(`/api/faculty/${id}`)

        if (!response.ok) {
          throw new Error('Faculty member not found')
        }

        const facultyData = await response.json()
        setData(facultyData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchFacultyData()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <Link
              href="/"
              className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm"
            >
              ← Back to Search
            </Link>
          </div>
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading faculty profile...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <Link
              href="/"
              className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm"
            >
              ← Back to Search
            </Link>
          </div>
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Faculty Not Found</h1>
            <p className="text-gray-600 mb-4">
              {error || 'The requested faculty member could not be found.'}
            </p>
            <Link
              href="/"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Return to Search
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const { faculty, similar } = data

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Navigation */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm"
          >
            ← Back to Search
          </Link>
        </div>

        {/* Faculty Profile */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
          <div className="space-y-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{faculty.name}</h1>
              <p className="text-xl text-gray-600">{faculty.title}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Affiliation</h3>
                <p className="text-gray-700">{faculty.department}</p>
                <p className="text-gray-600">{faculty.school}</p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Faculty ID</h3>
                <p className="text-gray-700 font-mono text-sm">{faculty.faculty_id}</p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Research Keywords</h3>
              <div className="flex flex-wrap gap-2">
                {faculty.keywords.split(/[,;]/).map((keyword, index) => (
                  <span
                    key={index}
                    className="inline-block px-3 py-2 bg-blue-100 text-blue-800 text-sm rounded-lg"
                  >
                    {keyword.trim()}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Similar Faculty */}
        {similar.length > 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Similar Faculty</h2>
              <p className="text-gray-600 mt-1">
                Faculty members with related research interests
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {similar.map((similarFaculty) => (
                <div key={similarFaculty.faculty_id} className="relative">
                  <FacultyCard
                    faculty={{
                      faculty_id: similarFaculty.faculty_id,
                      name: similarFaculty.name,
                      title: similarFaculty.title,
                      school: similarFaculty.school,
                      department: similarFaculty.department,
                      keywords: '',
                      similarity_score: similarFaculty.score
                    }}
                    showSimilarity={true}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Similar Faculty Found</h2>
            <p className="text-gray-600">
              We couldn't find other faculty with similar research interests at this time.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}