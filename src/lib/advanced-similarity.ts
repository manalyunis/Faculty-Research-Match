import { spawn } from 'child_process'
import path from 'path'
import { createServiceRoleClient } from './supabase'

// Utility functions for handling padded embeddings
function padEmbeddingTo1536(embedding384: number[]): number[] {
  if (embedding384.length !== 384) {
    throw new Error(`Expected 384 dimensions, got ${embedding384.length}`)
  }
  // Add 1152 zeros to make it 1536 total
  const padding = new Array(1536 - 384).fill(0)
  return [...embedding384, ...padding]
}

function extractReal384Embedding(embedding1536: number[]): number[] {
  if (embedding1536.length !== 1536) {
    throw new Error(`Expected 1536 dimensions, got ${embedding1536.length}`)
  }
  // Extract the first 384 dimensions
  return embedding1536.slice(0, 384)
}

interface EmbeddingResult {
  success: boolean
  embeddings?: number[][]
  error?: string
}

interface SimilarityResult {
  success: boolean
  similar_faculty?: Array<{
    faculty_id: string
    name: string
    title: string
    school: string
    department: string
    similarity: number
  }>
  error?: string
}

interface ClusteringResult {
  success: boolean
  clustering?: {
    clusters: Array<{
      cluster_id: number
      size: number
      members: Array<{
        faculty_id: string
        name: string
        title: string
        school: string
        department: string
        cluster_id: number
        cluster_probability: number
      }>
    }>
    outliers: number
    total_clusters: number
    silhouette_score: number
    algorithm_used: string
  }
  error?: string
}

interface TopicsResult {
  success: boolean
  topics?: {
    topics: Array<{
      topic_id: number
      keyword: string
      frequency: number
      faculty_count: number
      associated_faculty: Array<{
        faculty_id: string
        name: string
        department: string
      }>
    }>
    total_keywords: number
    unique_keywords: number
    coverage: number
  }
  error?: string
}

class AdvancedSimilarityService {
  private pythonPath: string

  constructor() {
    this.pythonPath = path.join(process.cwd(), 'python', 'simple_embedding_service.py')
  }

  private async runPythonScript(command: string, inputData: any): Promise<any> {
    return new Promise((resolve, reject) => {
      // Use py command which we know works on this system
      const pythonCmd = 'py'

      const pythonProcess = spawn(pythonCmd, [`"${this.pythonPath}"`, command], {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python process failed with code ${code}: ${stderr}`))
          return
        }

        try {
          const result = JSON.parse(stdout)
          resolve(result)
        } catch (e) {
          reject(new Error(`Failed to parse Python output: ${stdout}\nError: ${stderr}`))
        }
      })

      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start Python process: ${error.message}`))
      })

      // Send input data
      if (inputData) {
        pythonProcess.stdin.write(JSON.stringify(inputData))
      }
      pythonProcess.stdin.end()
    })
  }

  async testPythonEnvironment(): Promise<boolean> {
    try {
      const result = await this.runPythonScript('test', null)
      return result.success
    } catch (error) {
      console.error('Python environment test failed:', error)
      return false
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][] | null> {
    try {
      const result: EmbeddingResult = await this.runPythonScript('generate_embeddings', { texts })

      if (result.success && result.embeddings) {
        return result.embeddings
      } else {
        console.error('Embedding generation failed:', result.error)
        return null
      }
    } catch (error) {
      console.error('Error generating embeddings:', error)
      return null
    }
  }

  async findSimilarFaculty(
    targetEmbedding: number[],
    allEmbeddings: number[][],
    facultyData: any[],
    options: {
      topK?: number
      threshold?: number
    } = {}
  ): Promise<any[]> {
    try {
      const { topK = 10, threshold = 0.1 } = options

      const result: SimilarityResult = await this.runPythonScript('find_similar', {
        target_embedding: targetEmbedding,
        all_embeddings: allEmbeddings,
        faculty_data: facultyData,
        top_k: topK,
        threshold
      })

      if (result.success && result.similar_faculty) {
        return result.similar_faculty
      } else {
        console.error('Similarity search failed:', result.error)
        return []
      }
    } catch (error) {
      console.error('Error finding similar faculty:', error)
      return []
    }
  }

  async clusterFaculty(
    embeddings: number[][],
    facultyData: any[],
    minClusterSize: number = 3
  ): Promise<any | null> {
    try {
      const result: ClusteringResult = await this.runPythonScript('cluster_faculty', {
        embeddings,
        faculty_data: facultyData,
        min_cluster_size: minClusterSize
      })

      if (result.success && result.clustering) {
        return result.clustering
      } else {
        console.error('Clustering failed:', result.error)
        return null
      }
    } catch (error) {
      console.error('Error clustering faculty:', error)
      return null
    }
  }

  async analyzeTopics(
    facultyData: any[],
    numTopics: number = 10
  ): Promise<any | null> {
    try {
      const result: TopicsResult = await this.runPythonScript('analyze_topics', {
        faculty_data: facultyData,
        num_topics: numTopics
      })

      if (result.success && result.topics) {
        return result.topics
      } else {
        console.error('Topic analysis failed:', result.error)
        return null
      }
    } catch (error) {
      console.error('Error analyzing topics:', error)
      return null
    }
  }

  async generateAndStoreEmbeddings(): Promise<boolean> {
    try {
      console.log('Fetching faculty data...')
      const supabase = createServiceRoleClient()

      const { data: facultyData, error } = await supabase
        .from('faculty')
        .select('faculty_id, name, title, school, department, keywords')

      if (error || !facultyData) {
        console.error('Failed to fetch faculty data:', error)
        return false
      }

      console.log(`Processing ${facultyData.length} faculty members...`)

      // Generate embeddings for all faculty keywords
      const texts = facultyData.map(f => f.keywords || '')
      const embeddings = await this.generateEmbeddings(texts)

      if (!embeddings) {
        console.error('Failed to generate embeddings')
        return false
      }

      console.log('Storing embeddings in database...')

      // Store embeddings back to database
      const batchSize = 10
      for (let i = 0; i < facultyData.length; i += batchSize) {
        const batch = facultyData.slice(i, i + batchSize)
        const batchEmbeddings = embeddings.slice(i, i + batchSize)

        for (let j = 0; j < batch.length; j++) {
          const { error: updateError } = await supabase
            .from('faculty')
            .update({
              embedding: JSON.stringify(batchEmbeddings[j])
            })
            .eq('faculty_id', batch[j].faculty_id)

          if (updateError) {
            console.error(`Error updating embedding for ${batch[j].faculty_id}:`, updateError)
          }
        }

        console.log(`Processed ${Math.min(i + batchSize, facultyData.length)}/${facultyData.length} faculty members`)
      }

      console.log('✅ Successfully generated and stored all embeddings!')
      return true

    } catch (error) {
      console.error('Error in generateAndStoreEmbeddings:', error)
      return false
    }
  }
}

// Enhanced similarity calculation with fallback to TF-IDF
export async function calculateAdvancedSimilarity(
  targetFacultyId: string,
  options: {
    maxResults?: number
    minSimilarity?: number
    filterSchool?: string
    filterDepartment?: string
    useAdvanced?: boolean
  } = {}
): Promise<any[]> {
  const {
    maxResults = 10,
    minSimilarity = 0.1,
    filterSchool,
    filterDepartment,
    useAdvanced = true
  } = options

  const service = new AdvancedSimilarityService()

  // Test if Python environment is available
  const isPythonAvailable = useAdvanced ? await service.testPythonEnvironment() : false

  if (!isPythonAvailable) {
    console.log('Python environment not available, falling back to TF-IDF...')
    // Import and use the existing TF-IDF similarity
    const { calculateSimilarFaculty } = await import('./similarity')
    return await calculateSimilarFaculty(targetFacultyId, {
      maxResults,
      minSimilarity,
      filterSchool,
      filterDepartment
    })
  }

  try {
    console.log('Using advanced similarity with sentence transformers...')
    const supabase = createServiceRoleClient()

    // Get target faculty
    const { data: targetFaculty, error: targetError } = await supabase
      .from('faculty')
      .select('*')
      .eq('faculty_id', targetFacultyId)
      .single()

    if (targetError || !targetFaculty) {
      console.error('Target faculty not found')
      return []
    }

    // Get all faculty data
    let query = supabase
      .from('faculty')
      .select('faculty_id, name, title, school, department, keywords, embedding')

    if (filterSchool) query = query.eq('school', filterSchool)
    if (filterDepartment) query = query.eq('department', filterDepartment)

    const { data: allFaculty, error } = await query

    if (error || !allFaculty) {
      console.error('Failed to fetch faculty data:', error)
      return []
    }

    // Filter out target faculty
    const otherFaculty = allFaculty.filter(f => f.faculty_id !== targetFacultyId)

    // Check if embeddings exist, if not fallback to TF-IDF
    const facultyWithEmbeddings = otherFaculty.filter(f => f.embedding)

    if (facultyWithEmbeddings.length === 0) {
      console.log('No embeddings found, falling back to TF-IDF...')
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
      const embeddings = await service.generateEmbeddings([targetFaculty.keywords || ''])
      if (!embeddings || embeddings.length === 0) {
        throw new Error('Failed to generate target embedding')
      }
      targetEmbedding = embeddings[0] // This is already 384 dimensions
    }

    // Prepare data for similarity calculation
    // Extract real 384-dimension embeddings from padded 1536-dimension embeddings
    const paddedEmbeddings = facultyWithEmbeddings.map(f => JSON.parse(f.embedding))
    const realEmbeddings = paddedEmbeddings.map(emb => {
      if (emb.length === 1536) {
        // Extract first 384 dimensions from padded embedding
        return extractReal384Embedding(emb)
      } else if (emb.length === 384) {
        // Already the correct size
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

    console.log(`Using ${realEmbeddings.length} real embeddings (384-dim each) for similarity`)

    // Find similar faculty using advanced method
    const results = await service.findSimilarFaculty(
      targetEmbedding,
      realEmbeddings,
      facultyData,
      { topK: maxResults, threshold: minSimilarity }
    )

    return results

  } catch (error) {
    console.error('Advanced similarity failed, falling back to TF-IDF:', error)
    // Fallback to TF-IDF
    const { calculateSimilarFaculty } = await import('./similarity')
    return await calculateSimilarFaculty(targetFacultyId, {
      maxResults,
      minSimilarity,
      filterSchool,
      filterDepartment
    })
  }
}

export const advancedSimilarityService = new AdvancedSimilarityService()

// Advanced search function with fallback to TF-IDF
export async function searchAdvancedSimilarity(
  query: string,
  options: {
    maxResults?: number
    minSimilarity?: number
    filterSchool?: string
    filterDepartment?: string
    useAdvanced?: boolean
  } = {}
): Promise<Array<{
  faculty_id: string
  name: string
  title: string
  school: string
  department: string
  similarity: number
}>> {
  const {
    maxResults = 20,
    minSimilarity = 0.1,
    filterSchool,
    filterDepartment,
    useAdvanced = true
  } = options

  const service = new AdvancedSimilarityService()

  // Test if Python environment is available
  const isPythonAvailable = useAdvanced ? await service.testPythonEnvironment() : false

  if (!isPythonAvailable) {
    console.log('Python environment not available, falling back to TF-IDF...')
    // Import and use the existing TF-IDF similarity
    const { searchSimilarFaculty } = await import('./similarity')
    return await searchSimilarFaculty(query, {
      maxResults,
      minSimilarity,
      filterSchool,
      filterDepartment
    })
  }

  try {
    console.log('Using advanced search with sentence transformers...')
    const supabase = createServiceRoleClient()

    // Get all faculty data
    let queryBuilder = supabase
      .from('faculty')
      .select('faculty_id, name, title, school, department, keywords, embedding')

    if (filterSchool) queryBuilder = queryBuilder.eq('school', filterSchool)
    if (filterDepartment) queryBuilder = queryBuilder.eq('department', filterDepartment)

    const { data: allFaculty, error } = await queryBuilder

    if (error || !allFaculty) {
      console.error('Failed to fetch faculty data:', error)
      throw new Error('Database query failed')
    }

    // Check if embeddings exist, if not fallback to TF-IDF
    const facultyWithEmbeddings = allFaculty.filter(f => f.embedding)

    if (facultyWithEmbeddings.length === 0) {
      console.log('No embeddings found, falling back to TF-IDF...')
      throw new Error('No embeddings available - fallback to TF-IDF')
    }

    // Generate embedding for the search query
    const queryEmbeddings = await service.generateEmbeddings([query])
    if (!queryEmbeddings || queryEmbeddings.length === 0) {
      throw new Error('Failed to generate query embedding')
    }
    const queryEmbedding = queryEmbeddings[0]

    // Prepare data for similarity calculation
    // Extract real 384-dimension embeddings from padded 1536-dimension embeddings
    const paddedEmbeddings = facultyWithEmbeddings.map(f => JSON.parse(f.embedding))
    const realEmbeddings = paddedEmbeddings.map(emb => {
      if (emb.length === 1536) {
        // Extract first 384 dimensions from padded embedding
        return extractReal384Embedding(emb)
      } else if (emb.length === 384) {
        // Already the correct size
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

    console.log(`Using ${realEmbeddings.length} real embeddings (384-dim each) for search`)

    // Find similar faculty using advanced method
    const results = await service.findSimilarFaculty(
      queryEmbedding,
      realEmbeddings,
      facultyData,
      { topK: maxResults, threshold: minSimilarity }
    )

    return results

  } catch (error) {
    console.error('Advanced search failed, falling back to TF-IDF:', error)
    // Fallback to TF-IDF
    const { searchSimilarFaculty } = await import('./similarity')
    return await searchSimilarFaculty(query, {
      maxResults,
      minSimilarity,
      filterSchool,
      filterDepartment
    })
  }
}