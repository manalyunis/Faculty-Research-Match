const { createServiceRoleClient } = require('../dist/lib/supabase.js');

async function setupDatabase() {
  try {
    console.log('Setting up database...');

    const supabase = createServiceRoleClient();

    // First, enable the vector extension
    console.log('Enabling vector extension...');
    const { error: vectorError } = await supabase
      .from('_database')
      .select('*')
      .limit(1);

    if (vectorError) {
      console.log('Vector extension may need to be enabled manually in Supabase dashboard');
    }

    // Create the faculty table using raw SQL
    console.log('Creating faculty table...');
    const { data, error } = await supabase
      .rpc('exec_sql', {
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
      });

    if (error) {
      console.error('Error creating table:', error);
    } else {
      console.log('Database setup completed successfully!');
    }

  } catch (error) {
    console.error('Setup failed:', error);
  }
}

// Test Supabase connection first
async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    const supabase = createServiceRoleClient();

    // Try a simple query
    const { data, error } = await supabase
      .from('faculty')
      .select('*')
      .limit(1);

    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        console.log('✅ Connection successful! Table does not exist yet.');
        return true;
      } else {
        console.error('❌ Connection failed:', error);
        return false;
      }
    } else {
      console.log('✅ Connection successful! Table exists with', data?.length || 0, 'records.');
      return true;
    }

  } catch (error) {
    console.error('❌ Connection test failed:', error);
    return false;
  }
}

async function main() {
  const isConnected = await testConnection();

  if (isConnected) {
    await setupDatabase();
  } else {
    console.log('Please check your Supabase credentials in .env.local');
  }
}

if (require.main === module) {
  main();
}

module.exports = { testConnection, setupDatabase };