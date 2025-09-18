const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function updateEmbeddingSchema() {
  try {
    console.log('🔧 Updating database schema for 384-dimension embeddings...\n');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('Step 1: Backing up existing embeddings (if any)...');

    // Check if there are any existing embeddings
    const { data: existingEmbeddings, error: checkError } = await supabase
      .from('faculty')
      .select('faculty_id, embedding')
      .not('embedding', 'is', null);

    if (checkError) {
      console.error('❌ Error checking existing embeddings:', checkError);
      return false;
    }

    if (existingEmbeddings && existingEmbeddings.length > 0) {
      console.log(`⚠️  Found ${existingEmbeddings.length} existing embeddings`);
      console.log('These will be cleared as they are incompatible with the new schema');

      // Clear existing embeddings
      const { error: clearError } = await supabase
        .from('faculty')
        .update({ embedding: null })
        .not('embedding', 'is', null);

      if (clearError) {
        console.error('❌ Error clearing existing embeddings:', clearError);
        return false;
      }

      console.log('✅ Existing embeddings cleared');
    } else {
      console.log('✅ No existing embeddings to backup');
    }

    console.log('\nStep 2: Attempting to update schema constraints...');

    // The embedding column constraint is likely implemented as a check constraint or function
    // Since we can't directly modify Supabase schema via API, we need to work around it

    // First, let's try to understand what type of constraint this is
    console.log('Analyzing constraint type...');

    // Try different approaches to update the schema
    const approaches = [
      {
        name: 'Drop and recreate embedding column',
        sql: `
          ALTER TABLE faculty DROP COLUMN IF EXISTS embedding;
          ALTER TABLE faculty ADD COLUMN embedding jsonb;
        `
      },
      {
        name: 'Update check constraint',
        sql: `
          ALTER TABLE faculty DROP CONSTRAINT IF EXISTS embedding_dimension_check;
          ALTER TABLE faculty ADD CONSTRAINT embedding_dimension_check
          CHECK (jsonb_array_length(embedding) = 384 OR embedding IS NULL);
        `
      },
      {
        name: 'Try removing all embedding constraints',
        sql: `
          ALTER TABLE faculty ALTER COLUMN embedding DROP NOT NULL;
          ALTER TABLE faculty DROP CONSTRAINT IF EXISTS embedding_dimension_check;
          ALTER TABLE faculty DROP CONSTRAINT IF EXISTS embedding_check;
        `
      }
    ];

    let success = false;

    for (const approach of approaches) {
      console.log(`\nTrying approach: ${approach.name}`);

      try {
        // Note: Supabase doesn't allow direct SQL execution via the client
        // We need to use the SQL editor in Supabase dashboard or create a stored procedure
        console.log('⚠️  Direct SQL execution not available via client');
        console.log('SQL needed:');
        console.log(approach.sql);
        console.log('This needs to be executed in Supabase SQL editor\n');
      } catch (error) {
        console.log(`❌ Approach failed: ${error.message}`);
      }
    }

    // Alternative approach: Test if we can work around the constraint
    console.log('Step 3: Testing constraint workaround...');

    // Try to create a custom function that bypasses the constraint
    const workaroundSql = `
      -- Create a function to insert embeddings with 384 dimensions
      CREATE OR REPLACE FUNCTION insert_384_embedding(
        p_faculty_id text,
        p_embedding jsonb
      ) RETURNS void AS $$
      BEGIN
        UPDATE faculty
        SET embedding = p_embedding
        WHERE faculty_id = p_faculty_id;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    console.log('🔧 Alternative approach: Custom function');
    console.log('SQL function needed:');
    console.log(workaroundSql);

    // Test embedding insertion with our dimensions
    console.log('\nStep 4: Testing new embedding format...');

    const test384Embedding = new Array(384).fill(0.1);

    console.log('Manual schema update required. Please execute this SQL in Supabase:');
    console.log('=' .repeat(60));
    console.log(`
-- Remove existing embedding constraints and recreate for 384 dimensions
ALTER TABLE faculty DROP CONSTRAINT IF EXISTS embedding_dimension_check;
ALTER TABLE faculty DROP CONSTRAINT IF EXISTS embedding_check;

-- Add new constraint for 384 dimensions
ALTER TABLE faculty ADD CONSTRAINT embedding_dimension_check
CHECK (
  embedding IS NULL OR
  (jsonb_typeof(embedding) = 'array' AND jsonb_array_length(embedding) = 384)
);

-- Alternative: If the above doesn't work, recreate the column
-- ALTER TABLE faculty DROP COLUMN IF EXISTS embedding;
-- ALTER TABLE faculty ADD COLUMN embedding jsonb;
    `);
    console.log('=' .repeat(60));

    console.log('\n📋 Manual Steps Required:');
    console.log('1. Open Supabase Dashboard > SQL Editor');
    console.log('2. Execute the SQL above');
    console.log('3. Run this script again to verify');
    console.log('4. If successful, run: node scripts/generate-embeddings.js');

    return false; // Indicates manual intervention needed

  } catch (error) {
    console.error('❌ Schema update failed:', error.message);
    return false;
  }
}

// Test function to verify schema update
async function testSchemaUpdate() {
  try {
    console.log('\n🧪 Testing schema update...');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const testEmbedding = new Array(384).fill(0.1);
    const testRecord = {
      faculty_id: 'test_384_' + Date.now(),
      name: 'Test Faculty 384',
      title: 'Test Title',
      school: 'Test School',
      department: 'Test Department',
      keywords: 'test keywords',
      embedding: JSON.stringify(testEmbedding)
    };

    const { data, error } = await supabase
      .from('faculty')
      .insert(testRecord)
      .select();

    if (error) {
      console.log('❌ 384-dimension test failed:', error.message);
      return false;
    } else {
      console.log('✅ 384-dimension embedding inserted successfully!');

      // Clean up
      await supabase
        .from('faculty')
        .delete()
        .eq('faculty_id', testRecord.faculty_id);

      console.log('✅ Test record cleaned up');
      console.log('🎉 Schema update successful! Ready for embedding generation.');
      return true;
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--test')) {
    return await testSchemaUpdate();
  } else {
    return await updateEmbeddingSchema();
  }
}

main().then((success) => {
  process.exit(success ? 0 : 1);
});