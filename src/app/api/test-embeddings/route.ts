import { NextResponse } from 'next/server'
import { generateEmbedding, cosineSimilarity, testEmbeddingService } from '@/lib/transformers-embedding'

/**
 * Test endpoint to verify Transformers.js is working
 * No database connection required
 */
export async function GET() {
  try {
    console.log('[Test] Testing Transformers.js embedding service...')

    // Test 1: Service health check
    const isHealthy = await testEmbeddingService()
    if (!isHealthy) {
      return NextResponse.json(
        { error: 'Embedding service test failed' },
        { status: 500 }
      )
    }

    // Test 2: Generate embeddings for test phrases
    const phrase1 = 'machine learning and artificial intelligence'
    const phrase2 = 'deep learning and neural networks'
    const phrase3 = 'cooking and baking recipes'

    console.log('[Test] Generating embeddings...')
    const embedding1 = await generateEmbedding(phrase1)
    const embedding2 = await generateEmbedding(phrase2)
    const embedding3 = await generateEmbedding(phrase3)

    // Test 3: Calculate similarities
    const similarity_ml_dl = cosineSimilarity(embedding1, embedding2)
    const similarity_ml_cooking = cosineSimilarity(embedding1, embedding3)

    console.log('[Test] Similarities calculated')
    console.log(`  ML vs DL: ${similarity_ml_dl.toFixed(4)}`)
    console.log(`  ML vs Cooking: ${similarity_ml_cooking.toFixed(4)}`)

    // Test 4: Verify semantic understanding
    const semanticUnderstanding = similarity_ml_dl > similarity_ml_cooking

    return NextResponse.json({
      success: true,
      message: 'Transformers.js is working perfectly!',
      results: {
        embedding_dimensions: embedding1.length,
        test_phrases: {
          phrase1,
          phrase2,
          phrase3
        },
        similarities: {
          ml_vs_deep_learning: similarity_ml_dl.toFixed(4),
          ml_vs_cooking: similarity_ml_cooking.toFixed(4)
        },
        semantic_understanding: {
          passed: semanticUnderstanding,
          explanation: semanticUnderstanding
            ? 'ML is more similar to Deep Learning than Cooking (as expected ✓)'
            : 'Unexpected: ML should be more similar to Deep Learning'
        }
      },
      embeddings_sample: {
        ml_first_5_dims: embedding1.slice(0, 5).map(n => n.toFixed(4)),
        dl_first_5_dims: embedding2.slice(0, 5).map(n => n.toFixed(4))
      }
    })
  } catch (error) {
    console.error('[Test] Error:', error)
    return NextResponse.json(
      {
        error: 'Test failed',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
