import { NextRequest, NextResponse } from 'next/server'

/**
 * Topics Analysis API - Feature Not Available
 *
 * Advanced topic analysis requires Python NLP libraries
 * which have been replaced with Transformers.js for deployment simplicity.
 *
 * This endpoint returns a helpful message indicating the feature is not available.
 */
export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      available: false,
      message: 'Advanced topic analysis is not available in this deployment',
      reason: 'This feature requires Python NLP libraries which have been replaced with JavaScript-based Transformers.js for simplified deployment.',
      alternative: 'Use the search functionality to find faculty by keywords, or explore faculty by department/school.',
      features_available: [
        'Semantic similarity search (/api/search)',
        'Faculty matching (/api/faculty/[id])',
        'Department/school browsing'
      ]
    },
    { status: 501 } // 501 Not Implemented
  )
}
