import { createServiceRoleClient } from '@/lib/database'

interface FacultyRecord {
  faculty_id: string
  name: string
  title: string
  school: string
  department: string
  keywords: string
}

interface SimilarityResult {
  faculty_id: string
  name: string
  title: string
  school: string
  department: string
  similarity: number
}

// Simple tokenization and preprocessing
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2)
    .filter(word => !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'had', 'but', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'man', 'end', 'few', 'got', 'let', 'put', 'say', 'she', 'too', 'use'].includes(word))
}

// Calculate TF (Term Frequency)
function calculateTF(tokens: string[]): Map<string, number> {
  const termFreq = new Map<string, number>()
  const totalTerms = tokens.length

  for (const token of tokens) {
    termFreq.set(token, (termFreq.get(token) || 0) + 1)
  }

  // Normalize by total terms
  for (const [term, count] of termFreq.entries()) {
    termFreq.set(term, count / totalTerms)
  }

  return termFreq
}

// Calculate IDF (Inverse Document Frequency)
function calculateIDF(documents: string[][]): Map<string, number> {
  const idf = new Map<string, number>()
  const totalDocs = documents.length
  const termDocCount = new Map<string, number>()

  // Count how many documents each term appears in
  for (const doc of documents) {
    const uniqueTerms = new Set(doc)
    for (const term of uniqueTerms) {
      termDocCount.set(term, (termDocCount.get(term) || 0) + 1)
    }
  }

  // Calculate IDF for each term
  for (const [term, docCount] of termDocCount.entries()) {
    idf.set(term, Math.log(totalDocs / docCount))
  }

  return idf
}

// Calculate TF-IDF vector
function calculateTFIDF(tf: Map<string, number>, idf: Map<string, number>, allTerms: Set<string>): number[] {
  const vector: number[] = []

  for (const term of Array.from(allTerms).sort()) {
    const tfValue = tf.get(term) || 0
    const idfValue = idf.get(term) || 0
    vector.push(tfValue * idfValue)
  }

  return vector
}

// Calculate cosine similarity between two vectors
function cosineSimilarity(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i]
    normA += vectorA[i] * vectorA[i]
    normB += vectorB[i] * vectorB[i]
  }

  normA = Math.sqrt(normA)
  normB = Math.sqrt(normB)

  if (normA === 0 || normB === 0) return 0

  return dotProduct / (normA * normB)
}

// Main similarity calculation function
export async function calculateSimilarFaculty(
  targetFacultyId: string,
  options: {
    maxResults?: number
    minSimilarity?: number
    filterSchool?: string
    filterDepartment?: string
  } = {}
): Promise<SimilarityResult[]> {
  const {
    maxResults = 10,
    minSimilarity = 0.1,
    filterSchool,
    filterDepartment
  } = options

  const supabase = createServiceRoleClient()

  // Get all faculty data
  let query = supabase
    .from('faculty')
    .select('faculty_id, name, title, school, department, keywords')

  if (filterSchool) {
    query = query.eq('school', filterSchool)
  }
  if (filterDepartment) {
    query = query.eq('department', filterDepartment)
  }

  const { data: allFaculty, error } = await query.execute()

  if (error || !allFaculty) {
    console.error('Error fetching faculty:', error)
    return []
  }

  // Find target faculty
  const targetFaculty = allFaculty.find(f => f.faculty_id === targetFacultyId)
  if (!targetFaculty) {
    console.error('Target faculty not found')
    return []
  }

  // Filter out target faculty from comparison set
  const otherFaculty = allFaculty.filter(f => f.faculty_id !== targetFacultyId)

  // Tokenize all documents
  const allDocuments = allFaculty.map(f => tokenize(f.keywords || ''))
  const targetTokens = tokenize(targetFaculty.keywords || '')

  // Build vocabulary
  const allTerms = new Set<string>()
  for (const doc of allDocuments) {
    for (const term of doc) {
      allTerms.add(term)
    }
  }

  if (allTerms.size === 0) {
    return []
  }

  // Calculate IDF for all terms
  const idf = calculateIDF(allDocuments)

  // Calculate TF-IDF for target faculty
  const targetTF = calculateTF(targetTokens)
  const targetVector = calculateTFIDF(targetTF, idf, allTerms)

  // Calculate similarities
  const similarities: SimilarityResult[] = []

  for (const faculty of otherFaculty) {
    const facultyTokens = tokenize(faculty.keywords || '')
    const facultyTF = calculateTF(facultyTokens)
    const facultyVector = calculateTFIDF(facultyTF, idf, allTerms)

    const similarity = cosineSimilarity(targetVector, facultyVector)

    if (similarity >= minSimilarity) {
      similarities.push({
        faculty_id: faculty.faculty_id,
        name: faculty.name,
        title: faculty.title,
        school: faculty.school,
        department: faculty.department,
        similarity
      })
    }
  }

  // Sort by similarity (descending) and limit results
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults)
}

// Batch similarity calculation for search functionality
export async function searchSimilarFaculty(
  query: string,
  options: {
    maxResults?: number
    minSimilarity?: number
    filterSchool?: string
    filterDepartment?: string
  } = {}
): Promise<SimilarityResult[]> {
  const {
    maxResults = 20,
    minSimilarity = 0.1,
    filterSchool,
    filterDepartment
  } = options

  const supabase = createServiceRoleClient()

  // Get all faculty data
  let dbQuery = supabase
    .from('faculty')
    .select('faculty_id, name, title, school, department, keywords')

  if (filterSchool) {
    dbQuery = dbQuery.eq('school', filterSchool)
  }
  if (filterDepartment) {
    dbQuery = dbQuery.eq('department', filterDepartment)
  }

  const { data: allFaculty, error } = await dbQuery.execute()

  if (error || !allFaculty) {
    console.error('Error fetching faculty:', error)
    return []
  }

  // Tokenize query and all documents
  const queryTokens = tokenize(query)
  const allDocuments = allFaculty.map(f => tokenize(f.keywords || ''))

  // Add query as a document for IDF calculation
  const documentsWithQuery = [queryTokens, ...allDocuments]

  // Build vocabulary
  const allTerms = new Set<string>()
  for (const doc of documentsWithQuery) {
    for (const term of doc) {
      allTerms.add(term)
    }
  }

  if (allTerms.size === 0) {
    return []
  }

  // Calculate IDF
  const idf = calculateIDF(documentsWithQuery)

  // Calculate query TF-IDF vector
  const queryTF = calculateTF(queryTokens)
  const queryVector = calculateTFIDF(queryTF, idf, allTerms)

  // Calculate similarities
  const similarities: SimilarityResult[] = []

  for (const faculty of allFaculty) {
    const facultyTokens = tokenize(faculty.keywords || '')
    const facultyTF = calculateTF(facultyTokens)
    const facultyVector = calculateTFIDF(facultyTF, idf, allTerms)

    const similarity = cosineSimilarity(queryVector, facultyVector)

    if (similarity >= minSimilarity) {
      similarities.push({
        faculty_id: faculty.faculty_id,
        name: faculty.name,
        title: faculty.title,
        school: faculty.school,
        department: faculty.department,
        similarity
      })
    }
  }

  // Sort by similarity (descending) and limit results
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults)
}
