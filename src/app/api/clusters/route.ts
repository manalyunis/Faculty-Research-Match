import { NextRequest, NextResponse } from 'next/server'

/**
 * Clustering API - Feature Not Available
 *
 * Advanced clustering (HDBSCAN/UMAP) requires Python libraries
 * which have been replaced with Transformers.js for deployment simplicity.
 *
 * This endpoint returns a helpful message indicating the feature is not available.
 */
export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      available: false,
      message: 'Advanced clustering (HDBSCAN) is not available in this deployment',
      reason: 'This feature requires Python ML libraries (HDBSCAN, UMAP) which have been replaced with JavaScript-based Transformers.js for simplified deployment.',
      alternative: 'Consider grouping faculty by department or school, or use the similarity search to find related researchers.',
      features_available: [
        'Semantic similarity search (/api/search)',
        'Faculty matching (/api/faculty/[id])',
        'Basic keyword search'
      ]
    },
    { status: 501 } // 501 Not Implemented
  )
}
