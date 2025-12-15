/**
 * Advanced Similarity Service
 * Now powered by Transformers.js (JavaScript ML) instead of Python
 * Maintains API compatibility with the original Python version
 */

import { createServiceRoleClient } from './database'
import {
  generateEmbedding,
  generateEmbeddings as generateEmbeddingsJS,
  cosineSimilarity,
  findSimilar,
  padEmbeddingTo1536,
  extractEmbeddingFrom1536,
  testEmbeddingService,
  preloadModel,
  getStats
} from './transformers-embedding'

// Utility functions for handling padded embeddings (kept for compatibility)
function padEmbeddingTo1536Compat(embedding384: number[]): number[] {
  if (embedding384.length !== 384) {
    throw new Error(`Expected 384 dimensions, got ${embedding384.length}`)
  }
  return padEmbeddingTo1536(embedding384)
}

function extractReal384Embedding(embedding1536: number[]): number[] {
  if (embedding1536.length !== 1536) {
    throw new Error(`Expected 1536 dimensions, got ${embedding1536.length}`)
  }
  return extractEmbeddingFrom1536(embedding1536)
}

interface SimilarityResult {
  faculty_id: string
  name: string
  title: string
  school: string
  department: string
  similarity: number
}

class AdvancedSimilarityService {
  private modelLoaded: boolean = false

  constructor() {
    // Pre-warm the model on first use
    this.warmupModel()
  }

  private async warmupModel(): Promise<void> {
    try {
      console.log('[AdvancedSimilarity] Warming up embedding model...')
      await preloadModel()
      this.modelLoaded = true
      console.log('[AdvancedSimilarity] Model ready')
    } catch (error) {
      console.error('[AdvancedSimilarity] Model warmup failed:', error)
      this.modelLoaded = false
    }
  }

  /**
   * Test if the embedding environment is working
   */
  async testEmbeddingEnvironment(): Promise<boolean> {
    try {
      const result = await testEmbeddingService()
      this.modelLoaded = result
      return result
    } catch (error) {
      console.error('[AdvancedSimilarity] Environment test failed:', error)
      this.modelLoaded = false
      return false
    }
  }

  /**
   * Generate embeddings for multiple texts
   */
  async generateEmbeddings(texts: string[]): Promise<number[][] | null> {
    try {
      const embeddings = await generateEmbeddingsJS(texts)
      return embeddings
    } catch (error) {
      console.error('[AdvancedSimilarity] Error generating embeddings:', error)
      return null
    }
  }

  /**
   * Find similar faculty using cosine similarity on embeddings
   */
  async findSimilarFaculty(
    targetEmbedding: number[],
    allEmbeddings: number[][],
    facultyData: Array<{
      faculty_id: string
      name: string
      title: string
      school: string
      department: string
    }>,
    options: {
      topK?: number
      threshold?: number
    } = {}
  ): Promise<SimilarityResult[]> {
    try {
      const { topK = 10, threshold = 0.1 } = options

      // Combine embeddings with faculty data
      const candidates = allEmbeddings.map((embedding, index) => ({
        id: facultyData[index].faculty_id,
        embedding,
        ...facultyData[index]
      }))

      // Use the findSimilar function from transformers-embedding
      const results = findSimilar(targetEmbedding, candidates, topK, threshold)

      // Transform results to match expected format
      return results.map(result => ({
        faculty_id: result.id,
        name: result.name,
        title: result.title,
        school: result.school,
        department: result.department,
        similarity: result.similarity
      }))
    } catch (error) {
      console.error('[AdvancedSimilarity] Error finding similar faculty:', error)
      return []
    }
  }

  /**
   * Generate and store embeddings for all faculty in database
   */
  async generateAndStoreEmbeddings(): Promise<boolean> {
    try {
      console.log('[AdvancedSimilarity] Fetching faculty data...')
      const supabase = createServiceRoleClient()

      const { data: facultyData, error } = await supabase
        .from('faculty')
        .select('faculty_id, name, title, school, department, keywords')

      if (error || !facultyData) {
        console.error('[AdvancedSimilarity] Failed to fetch faculty data:', error)
        return false
      }

      console.log(`[AdvancedSimilarity] Processing ${facultyData.length} faculty members...`)

      // Generate embeddings for all faculty keywords
      const texts = facultyData.map(f => f.keywords || '')
      const embeddings = await this.generateEmbeddings(texts)

      if (!embeddings) {
        console.error('[AdvancedSimilarity] Failed to generate embeddings')
        return false
      }

      console.log('[AdvancedSimilarity] Storing embeddings in database...')

      // Pad embeddings to 1536 dimensions for database storage
      const paddedEmbeddings = embeddings.map(emb => padEmbeddingTo1536(emb))

      // Store embeddings back to database
      const batchSize = 10
      for (let i = 0; i < facultyData.length; i += batchSize) {
        const batch = facultyData.slice(i, i + batchSize)
        const batchEmbeddings = paddedEmbeddings.slice(i, i + batchSize)

        for (let j = 0; j < batch.length; j++) {
          const { error: updateError } = await supabase
            .from('faculty')
            .update({
              embedding: JSON.stringify(batchEmbeddings[j])
            })
            .eq('faculty_id', batch[j].faculty_id)

          if (updateError) {
            console.error(`[AdvancedSimilarity] Error updating embedding for ${batch[j].faculty_id}:`, updateError)
          }
        }

        console.log(`[AdvancedSimilarity] Processed ${Math.min(i + batchSize, facultyData.length)}/${facultyData.length} faculty members`)
      }

      console.log('[AdvancedSimilarity] ✅ Successfully generated and stored all embeddings!')
      return true

    } catch (error) {
      console.error('[AdvancedSimilarity] Error in generateAndStoreEmbeddings:', error)
      return false
    }
  }

  /**
   * Get service statistics
   */
  getServiceStats() {
    return {
      ...getStats(),
      modelLoaded: this.modelLoaded,
      implementation: 'Transformers.js (JavaScript)'
    }
  }
}

/**
 * Calculate similarity between a target faculty and all others
 * With automatic fallback to TF-IDF if embeddings are not available
 */
export async function calculateAdvancedSimilarity(
  targetFacultyId: string,
  options: {
    maxResults?: number
    minSimilarity?: number
    filterSchool?: string
    filterDepartment?: string
    useAdvanced?: boolean
  } = {}
): Promise<SimilarityResult[]> {
  const {
    maxResults = 10,
    minSimilarity = 0.1,
    filterSchool,
    filterDepartment,
    useAdvanced = true
  } = options

  const service = new AdvancedSimilarityService()

  // Test if embedding service is available
  const isEmbeddingAvailable = useAdvanced ? await service.testEmbeddingEnvironment() : false

  if (!isEmbeddingAvailable) {
    console.log('[AdvancedSimilarity] Embedding service not available, falling back to TF-IDF...')
    const { calculateSimilarFaculty } = await import('./similarity')
    return await calculateSimilarFaculty(targetFacultyId, {
      maxResults,
      minSimilarity,
      filterSchool,
      filterDepartment
    })
  }

  try {
    console.log('[AdvancedSimilarity] Using advanced similarity with Transformers.js...')
    const supabase = createServiceRoleClient()

    // Get target faculty
    const { data: targetFaculty, error: targetError } = await supabase
      .from('faculty')
      .select('*')
      .eq('faculty_id', targetFacultyId)
      .single()

    if (targetError || !targetFaculty) {
      console.error('[AdvancedSimilarity] Target faculty not found')
      return []
    }

    // Get all faculty data
    let query = supabase
      .from('faculty')
      .select('faculty_id, name, title, school, department, keywords, embedding')

    if (filterSchool) query = query.eq('school', filterSchool)
    if (filterDepartment) query = query.eq('department', filterDepartment)

    const { data: allFaculty, error } = await query.execute()

    if (error || !allFaculty) {
      console.error('[AdvancedSimilarity] Failed to fetch faculty data:', error)
      return []
    }

    // Filter out target faculty
    const otherFaculty = allFaculty.filter(f => f.faculty_id !== targetFacultyId)

    // Check if embeddings exist, if not fallback to TF-IDF
    const facultyWithEmbeddings = otherFaculty.filter(f => f.embedding)

    if (facultyWithEmbeddings.length === 0) {
      console.log('[AdvancedSimilarity] No embeddings found, falling back to TF-IDF...')
      throw new Error('No embeddings available - fallback to TF-IDF')
    }

    // Get target embedding
    let targetEmbedding: number[]

    if (targetFaculty.embedding) {
      const storedEmbedding = JSON.parse(targetFaculty.embedding)
      if (storedEmbedding.length === 1536) {
        // Extract real 384 dimensions from padded embedding
        targetEmbedding = extractReal384Embedding(storedEmbedding)
      } else if (storedEmbedding.length === 384) {
        targetEmbedding = storedEmbedding
      } else {
        throw new Error(`Unexpected target embedding size: ${storedEmbedding.length}`)
      }
    } else {
      // Generate embedding for target faculty
      const embedding = await generateEmbedding(targetFaculty.keywords || '')
      targetEmbedding = embedding
    }

    // Prepare data for similarity calculation
    // Extract real 384-dimension embeddings from padded 1536-dimension embeddings
    const paddedEmbeddings = facultyWithEmbeddings.map(f => JSON.parse(f.embedding))
    const realEmbeddings = paddedEmbeddings.map(emb => {
      if (emb.length === 1536) {
        return extractReal384Embedding(emb)
      } else if (emb.length === 384) {
        return emb
      } else {
        throw new Error(`Unexpected embedding size: ${emb.length}`)
      }
    })

    const facultyData = facultyWithEmbeddings.map(f => ({
      faculty_id: f.faculty_id,
      name: f.name,
      title: f.title,
      school: f.school,
      department: f.department
    }))

    console.log(`[AdvancedSimilarity] Using ${realEmbeddings.length} embeddings (384-dim) for similarity`)

    // Find similar faculty using advanced method
    const results = await service.findSimilarFaculty(
      targetEmbedding,
      realEmbeddings,
      facultyData,
      { topK: maxResults, threshold: minSimilarity }
    )

    return results

  } catch (error) {
    console.error('[AdvancedSimilarity] Advanced similarity failed, falling back to TF-IDF:', error)
    const { calculateSimilarFaculty } = await import('./similarity')
    return await calculateSimilarFaculty(targetFacultyId, {
      maxResults,
      minSimilarity,
      filterSchool,
      filterDepartment
    })
  }
}

/**
 * Search for faculty similar to a query string
 * With automatic fallback to TF-IDF if embeddings are not available
 */
export async function searchAdvancedSimilarity(
  query: string,
  options: {
    maxResults?: number
    minSimilarity?: number
    filterSchool?: string
    filterDepartment?: string
    useAdvanced?: boolean
  } = {}
): Promise<SimilarityResult[]> {
  const {
    maxResults = 20,
    minSimilarity = 0.1,
    filterSchool,
    filterDepartment,
    useAdvanced = true
  } = options

  const service = new AdvancedSimilarityService()

  // Test if embedding service is available
  const isEmbeddingAvailable = useAdvanced ? await service.testEmbeddingEnvironment() : false

  if (!isEmbeddingAvailable) {
    console.log('[AdvancedSimilarity] Embedding service not available, falling back to TF-IDF...')
    const { searchSimilarFaculty } = await import('./similarity')
    return await searchSimilarFaculty(query, {
      maxResults,
      minSimilarity,
      filterSchool,
      filterDepartment
    })
  }

  try {
    console.log('[AdvancedSimilarity] Using advanced search with Transformers.js...')
    const supabase = createServiceRoleClient()

    // Get all faculty data
    let queryBuilder = supabase
      .from('faculty')
      .select('faculty_id, name, title, school, department, keywords, embedding')

    if (filterSchool) queryBuilder = queryBuilder.eq('school', filterSchool)
    if (filterDepartment) queryBuilder = queryBuilder.eq('department', filterDepartment)

    const { data: allFaculty, error } = await queryBuilder.execute()

    if (error || !allFaculty) {
      console.error('[AdvancedSimilarity] Failed to fetch faculty data:', error)
      throw new Error('Database query failed')
    }

    // Check if embeddings exist, if not fallback to TF-IDF
    const facultyWithEmbeddings = allFaculty.filter(f => f.embedding)

    if (facultyWithEmbeddings.length === 0) {
      console.log('[AdvancedSimilarity] No embeddings found, falling back to TF-IDF...')
      throw new Error('No embeddings available - fallback to TF-IDF')
    }

    // Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(query)

    // Prepare data for similarity calculation
    // Extract real 384-dimension embeddings from padded 1536-dimension embeddings
    const paddedEmbeddings = facultyWithEmbeddings.map(f => JSON.parse(f.embedding))
    const realEmbeddings = paddedEmbeddings.map(emb => {
      if (emb.length === 1536) {
        return extractReal384Embedding(emb)
      } else if (emb.length === 384) {
        return emb
      } else {
        throw new Error(`Unexpected embedding size: ${emb.length}`)
      }
    })

    const facultyData = facultyWithEmbeddings.map(f => ({
      faculty_id: f.faculty_id,
      name: f.name,
      title: f.title,
      school: f.school,
      department: f.department
    }))

    console.log(`[AdvancedSimilarity] Using ${realEmbeddings.length} embeddings (384-dim) for search`)

    // Find similar faculty using advanced method
    const results = await service.findSimilarFaculty(
      queryEmbedding,
      realEmbeddings,
      facultyData,
      { topK: maxResults, threshold: minSimilarity }
    )

    return results

  } catch (error) {
    console.error('[AdvancedSimilarity] Advanced search failed, falling back to TF-IDF:', error)
    const { searchSimilarFaculty } = await import('./similarity')
    return await searchSimilarFaculty(query, {
      maxResults,
      minSimilarity,
      filterSchool,
      filterDepartment
    })
  }
}

// Export singleton instance for backward compatibility
export const advancedSimilarityService = new AdvancedSimilarityService()
