'use client'

import Link from 'next/link'
import { Faculty } from '@/lib/supabase'

interface FacultyCardProps {
  faculty: Faculty & { similarity_score?: number }
  showSimilarity?: boolean
}

export default function FacultyCard({ faculty, showSimilarity = false }: FacultyCardProps) {
  return (
    <Link
      href={`/faculty/${faculty.faculty_id}`}
      className="block bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200"
    >
      <div className="space-y-2">
        {/* Name and Title */}
        <div>
          <h3 className="font-semibold text-gray-900 text-lg leading-tight">
            {faculty.name}
          </h3>
          <p className="text-sm text-gray-600">{faculty.title}</p>
        </div>

        {/* Department and School */}
        <div className="text-sm text-gray-500">
          <p>{faculty.department}</p>
          <p>{faculty.school}</p>
        </div>

        {/* Keywords */}
        <div>
          <p className="text-xs text-gray-400 mb-1">Research Keywords</p>
          <div className="flex flex-wrap gap-1">
            {faculty.keywords.split(/[,;]/).slice(0, 4).map((keyword, index) => (
              <span
                key={index}
                className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
              >
                {keyword.trim()}
              </span>
            ))}
            {faculty.keywords.split(/[,;]/).length > 4 && (
              <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                +{faculty.keywords.split(/[,;]/).length - 4} more
              </span>
            )}
          </div>
        </div>

        {/* Similarity Score */}
        {showSimilarity && faculty.similarity_score !== undefined && (
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Similarity</span>
              <span className="text-sm font-medium text-blue-600">
                {Math.round(faculty.similarity_score * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}