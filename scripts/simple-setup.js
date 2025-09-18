const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables. Please check .env.local')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function setupDatabase() {
  try {
    console.log('Setting up database...')

    // Create the faculty table
    console.log('Creating faculty table...')
    const { error } = await supabase
      .from('_placeholder') // Use a placeholder to execute SQL
      .select('1')
      .limit(0)

    // Run raw SQL to create the table
    const { data, error: sqlError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS faculty (
          faculty_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          keywords TEXT NOT NULL,
          title TEXT NOT NULL,
          school TEXT NOT NULL,
          department TEXT NOT NULL,
          embedding VECTOR(1536),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_faculty_name ON faculty USING gin(to_tsvector('english', name));
        CREATE INDEX IF NOT EXISTS idx_faculty_keywords ON faculty USING gin(to_tsvector('english', keywords));
        CREATE INDEX IF NOT EXISTS idx_faculty_school ON faculty (school);
        CREATE INDEX IF NOT EXISTS idx_faculty_department ON faculty (department);
      `
    })

    if (sqlError) {
      console.error('Error creating table:', sqlError)
    } else {
      console.log('✅ Database setup completed successfully!')
    }

  } catch (error) {
    console.error('Setup failed:', error)
  }
}

// Test Supabase connection first
async function testConnection() {
  try {
    console.log('Testing Supabase connection...')

    // Try a simple query
    const { data, error } = await supabase
      .from('faculty')
      .select('*')
      .limit(1)

    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        console.log('✅ Connection successful! Table does not exist yet.')
        return true
      } else {
        console.error('❌ Connection failed:', error)
        return false
      }
    } else {
      console.log('✅ Connection successful! Table exists with', data?.length || 0, 'records.')
      return true
    }

  } catch (error) {
    console.error('❌ Connection test failed:', error)
    return false
  }
}

async function main() {
  const isConnected = await testConnection()

  if (isConnected) {
    await setupDatabase()
  } else {
    console.log('Please check your Supabase credentials in .env.local')
  }
}

main()