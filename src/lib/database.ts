/**
 * PostgreSQL Database Client
 * Replacement for Supabase client
 * Uses Render PostgreSQL (free tier)
 */

import { Pool, PoolClient } from 'pg'

// Database connection pool (singleton)
let pool: Pool | null = null

/**
 * Get or create database connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set')
    }

    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false // Render requires this
      } : false,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err)
    })

    console.log('[Database] PostgreSQL pool created')
  }

  return pool
}

/**
 * Execute a query
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const pool = getPool()
  try {
    const result = await pool.query(text, params)
    return result.rows as T[]
  } catch (error) {
    console.error('[Database] Query error:', error)
    throw error
  }
}

/**
 * Execute a query and return single row
 */
export async function queryOne<T = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows.length > 0 ? rows[0] : null
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<PoolClient> {
  const pool = getPool()
  return await pool.connect()
}

/**
 * Close the database pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
    console.log('[Database] Pool closed')
  }
}

// ============================================================================
// Database Types
// ============================================================================

export interface Faculty {
  faculty_id: string
  name: string
  keywords: string
  title: string
  school: string
  department: string
  embedding?: string // JSON string of number[]
  created_at?: Date
  updated_at?: Date
}

export interface FacultySearchResult extends Faculty {
  similarity_score?: number
}

// ============================================================================
// Supabase-like API for easy migration
// ============================================================================

/**
 * Supabase-like query builder (simplified)
 */
export class QueryBuilder<T> {
  private tableName: string
  private selectFields: string = '*'
  private whereConditions: Array<{ field: string; value: any; operator: string }> = []
  private limitValue?: number
  private offsetValue?: number
  private orderByField?: string
  private orderDirection: 'ASC' | 'DESC' = 'ASC'

  constructor(tableName: string) {
    this.tableName = tableName
  }

  select(fields: string = '*'): this {
    this.selectFields = fields
    return this
  }

  eq(field: string, value: any): this {
    this.whereConditions.push({ field, value, operator: '=' })
    return this
  }

  neq(field: string, value: any): this {
    this.whereConditions.push({ field, value, operator: '!=' })
    return this
  }

  not(field: string, operator: string, value?: any): this {
    if (operator === 'is' && value === null) {
      this.whereConditions.push({ field, value: null, operator: 'IS NOT NULL' })
    }
    return this
  }

  limit(count: number): this {
    this.limitValue = count
    return this
  }

  offset(count: number): this {
    this.offsetValue = count
    return this
  }

  order(field: string, options?: { ascending?: boolean }): this {
    this.orderByField = field
    this.orderDirection = options?.ascending === false ? 'DESC' : 'ASC'
    return this
  }

  private buildQuery(): { text: string; params: any[] } {
    const params: any[] = []
    let text = `SELECT ${this.selectFields} FROM ${this.tableName}`

    // WHERE clause
    if (this.whereConditions.length > 0) {
      const conditions = this.whereConditions.map((cond, index) => {
        if (cond.operator === 'IS NOT NULL') {
          return `${cond.field} IS NOT NULL`
        }
        params.push(cond.value)
        return `${cond.field} ${cond.operator} $${params.length}`
      })
      text += ` WHERE ${conditions.join(' AND ')}`
    }

    // ORDER BY
    if (this.orderByField) {
      text += ` ORDER BY ${this.orderByField} ${this.orderDirection}`
    }

    // LIMIT
    if (this.limitValue !== undefined) {
      params.push(this.limitValue)
      text += ` LIMIT $${params.length}`
    }

    // OFFSET
    if (this.offsetValue !== undefined) {
      params.push(this.offsetValue)
      text += ` OFFSET $${params.length}`
    }

    return { text, params }
  }

  async execute(): Promise<{ data: T[] | null; error: Error | null }> {
    try {
      const { text, params } = this.buildQuery()
      const rows = await query<T>(text, params)
      return { data: rows, error: null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error))
      }
    }
  }

  async single(): Promise<{ data: T | null; error: Error | null }> {
    try {
      const { text, params } = this.buildQuery()
      const row = await queryOne<T>(text, params)
      return { data: row, error: null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error))
      }
    }
  }
}

/**
 * Supabase-like client for backward compatibility
 */
export class DatabaseClient {
  from<T = any>(tableName: string): QueryBuilder<T> {
    return new QueryBuilder<T>(tableName)
  }

  async insert(tableName: string, data: any): Promise<{ data: any | null; error: Error | null }> {
    try {
      const keys = Object.keys(data)
      const values = Object.values(data)
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ')

      const text = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`
      const rows = await query(text, values)

      return { data: rows[0] || null, error: null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error))
      }
    }
  }

  async update(
    tableName: string,
    data: any,
    where: { field: string; value: any }
  ): Promise<{ data: any | null; error: Error | null }> {
    try {
      const keys = Object.keys(data)
      const values = Object.values(data)
      const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ')

      const text = `UPDATE ${tableName} SET ${setClause} WHERE ${where.field} = $${values.length + 1} RETURNING *`
      const rows = await query(text, [...values, where.value])

      return { data: rows[0] || null, error: null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error))
      }
    }
  }

  async delete(
    tableName: string,
    where: { field: string; value: any }
  ): Promise<{ data: any | null; error: Error | null }> {
    try {
      const text = `DELETE FROM ${tableName} WHERE ${where.field} = $1 RETURNING *`
      const rows = await query(text, [where.value])

      return { data: rows[0] || null, error: null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error))
      }
    }
  }
}

/**
 * Create database client (Supabase API compatible)
 */
export function createDatabaseClient(): DatabaseClient {
  return new DatabaseClient()
}

/**
 * Alias for backward compatibility with Supabase code
 */
export const createServiceRoleClient = createDatabaseClient
export const createServerComponentClient = async () => createDatabaseClient()
export const createClientComponentClient = createDatabaseClient

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW() as now')
    console.log('[Database] Connection test successful:', result[0])
    return true
  } catch (error) {
    console.error('[Database] Connection test failed:', error)
    return false
  }
}

/**
 * Check if pgvector extension is installed
 */
export async function checkPgVector(): Promise<boolean> {
  try {
    const result = await query(
      `SELECT * FROM pg_extension WHERE extname = 'vector'`
    )
    return result.length > 0
  } catch (error) {
    console.error('[Database] pgvector check failed:', error)
    return false
  }
}
