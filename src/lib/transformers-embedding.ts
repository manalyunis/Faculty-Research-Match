/**
 * Transformers.js Embedding Service
 * JavaScript replacement for Python sentence-transformers
 * Uses the same model: all-MiniLM-L6-v2
 */

import { pipeline, Pipeline, env } from '@xenova/transformers';

// Configure transformers.js
env.allowLocalModels = false;
env.useBrowserCache = false;

// Simple in-memory cache for the model
let embeddingPipeline: Pipeline | null = null;
let isLoadingModel = false;

/**
 * Load the embedding model (cached in memory)
 */
async function getEmbeddingPipeline(): Promise<Pipeline> {
  if (embeddingPipeline) {
    return embeddingPipeline;
  }

  if (isLoadingModel) {
    // Wait for model to finish loading
    while (isLoadingModel) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return embeddingPipeline!;
  }

  try {
    isLoadingModel = true;
    console.log('[TransformersJS] Loading embedding model: Xenova/all-MiniLM-L6-v2...');

    embeddingPipeline = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      {
        quantized: true, // Use quantized model for smaller size
      }
    );

    console.log('[TransformersJS] Model loaded successfully');
    return embeddingPipeline;
  } catch (error) {
    console.error('[TransformersJS] Error loading model:', error);
    throw new Error(`Failed to load embedding model: ${error}`);
  } finally {
    isLoadingModel = false;
  }
}

/**
 * Clean text before embedding (same as Python version)
 */
function cleanText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .trim();
}

/**
 * Generate embeddings for text
 * Returns 384-dimensional vector (same as Python)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const cleanedText = cleanText(text);

    if (!cleanedText) {
      console.warn('[TransformersJS] Empty text provided, returning zero vector');
      return new Array(384).fill(0);
    }

    const pipe = await getEmbeddingPipeline();

    const output = await pipe(cleanedText, {
      pooling: 'mean',
      normalize: true,
    });

    // Convert to regular array
    const embedding = Array.from(output.data as Float32Array);

    // Ensure we have 384 dimensions (model should output this)
    if (embedding.length !== 384) {
      console.warn(`[TransformersJS] Expected 384 dimensions, got ${embedding.length}`);
    }

    return embedding;
  } catch (error) {
    console.error('[TransformersJS] Error generating embedding:', error);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts (batch processing)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const cleanedTexts = texts.map(cleanText).filter(t => t.length > 0);

    if (cleanedTexts.length === 0) {
      console.warn('[TransformersJS] No valid texts provided');
      return texts.map(() => new Array(384).fill(0));
    }

    const pipe = await getEmbeddingPipeline();

    // Process in batches to avoid memory issues
    const batchSize = 8;
    const results: number[][] = [];

    for (let i = 0; i < cleanedTexts.length; i += batchSize) {
      const batch = cleanedTexts.slice(i, i + batchSize);

      const outputs = await Promise.all(
        batch.map(text =>
          pipe(text, {
            pooling: 'mean',
            normalize: true,
          })
        )
      );

      results.push(...outputs.map(output => Array.from(output.data as Float32Array)));
    }

    return results;
  } catch (error) {
    console.error('[TransformersJS] Error generating batch embeddings:', error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Embedding dimensions don't match: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Find similar items based on embeddings
 * @param queryEmbedding - The query embedding vector
 * @param candidates - Array of {id, embedding} objects
 * @param topK - Number of top results to return
 * @param minSimilarity - Minimum similarity threshold (0-1)
 */
export function findSimilar<T extends { id: string; embedding: number[] }>(
  queryEmbedding: number[],
  candidates: T[],
  topK: number = 10,
  minSimilarity: number = 0.3
): Array<T & { similarity: number }> {
  const results = candidates
    .map(candidate => ({
      ...candidate,
      similarity: cosineSimilarity(queryEmbedding, candidate.embedding),
    }))
    .filter(item => item.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return results;
}

/**
 * Convert 384-dim embedding to 1536-dim (OpenAI-compatible format)
 * Pads with zeros as per existing database schema
 */
export function padEmbeddingTo1536(embedding: number[]): number[] {
  if (embedding.length === 1536) {
    return embedding;
  }

  if (embedding.length !== 384) {
    console.warn(`[TransformersJS] Unexpected embedding size: ${embedding.length}`);
  }

  // Pad to 1536 dimensions with zeros
  return [...embedding, ...new Array(1536 - embedding.length).fill(0)];
}

/**
 * Extract 384-dim embedding from 1536-dim (reverse of padding)
 */
export function extractEmbeddingFrom1536(embedding: number[]): number[] {
  if (embedding.length === 384) {
    return embedding;
  }

  if (embedding.length !== 1536) {
    console.warn(`[TransformersJS] Unexpected embedding size: ${embedding.length}`);
  }

  // Extract first 384 dimensions (rest are zeros)
  return embedding.slice(0, 384);
}

/**
 * Test if the embedding service is working
 */
export async function testEmbeddingService(): Promise<boolean> {
  try {
    console.log('[TransformersJS] Testing embedding service...');

    const testText = 'machine learning and artificial intelligence';
    const embedding = await generateEmbedding(testText);

    if (embedding.length !== 384) {
      console.error(`[TransformersJS] Test failed: expected 384 dims, got ${embedding.length}`);
      return false;
    }

    // Check if embedding is not all zeros
    const sum = embedding.reduce((a, b) => a + Math.abs(b), 0);
    if (sum === 0) {
      console.error('[TransformersJS] Test failed: embedding is all zeros');
      return false;
    }

    console.log('[TransformersJS] Test passed successfully');
    console.log(`[TransformersJS] Sample embedding (first 5 dims): ${embedding.slice(0, 5).map(n => n.toFixed(4)).join(', ')}`);

    return true;
  } catch (error) {
    console.error('[TransformersJS] Test failed:', error);
    return false;
  }
}

/**
 * Preload the model (optional, for faster first request)
 */
export async function preloadModel(): Promise<void> {
  console.log('[TransformersJS] Preloading embedding model...');
  await getEmbeddingPipeline();
  console.log('[TransformersJS] Model preloaded and cached');
}

// Export types for TypeScript
export interface SimilarityResult<T> {
  item: T;
  similarity: number;
}

export interface EmbeddingStats {
  modelLoaded: boolean;
  dimensions: number;
  modelName: string;
}

/**
 * Get embedding service stats
 */
export function getStats(): EmbeddingStats {
  return {
    modelLoaded: embeddingPipeline !== null,
    dimensions: 384,
    modelName: 'Xenova/all-MiniLM-L6-v2',
  };
}
