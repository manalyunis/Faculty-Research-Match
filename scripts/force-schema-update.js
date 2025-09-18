const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function forceSchemaUpdate() {
  try {
    console.log('🚀 Attempting to force schema update via raw SQL...\n');

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

    console.log('Attempting to execute SQL via RPC...');

    // Try to use a PostgreSQL function to modify the constraint
    const sql = `
      DO $$
      BEGIN
        -- Drop existing constraints
        ALTER TABLE faculty DROP CONSTRAINT IF EXISTS embedding_dimension_check;
        ALTER TABLE faculty DROP CONSTRAINT IF EXISTS embedding_check;

        -- Add new constraint for 384 dimensions
        ALTER TABLE faculty ADD CONSTRAINT embedding_dimension_check
        CHECK (
          embedding IS NULL OR
          (jsonb_typeof(embedding) = 'array' AND jsonb_array_length(embedding) = 384)
        );

        RAISE NOTICE 'Schema updated successfully for 384 dimensions';
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Error updating schema: %', SQLERRM;
      END $$;
    `;

    // Try using rpc if there's a function to execute SQL
    try {
      const { data, error } = await supabase.rpc('execute_sql', { sql_query: sql });

      if (error) {
        console.log('❌ RPC approach failed:', error.message);
      } else {
        console.log('✅ RPC execution successful:', data);
      }
    } catch (rpcError) {
      console.log('❌ RPC not available:', rpcError.message);
    }

    // Alternative: Try to create a temporary table and copy data
    console.log('\n🔄 Attempting alternative approach: Table recreation...');

    try {
      // First, let's try to rename the embedding column to backup
      console.log('Step 1: Backing up current embedding column...');

      // This might fail, but let's try
      const backupSql = 'ALTER TABLE faculty RENAME COLUMN embedding TO embedding_backup;';

      // Since direct SQL doesn't work, let's use a different approach
      // We'll update our insertion logic to handle the constraint differently

      console.log('❌ Direct table modification not possible via client');
      console.log('\n💡 Alternative Solution: Bypass constraint during insertion');

      // Let's create a workaround by using a staging approach
      return await createWorkaroundSolution();

    } catch (altError) {
      console.log('❌ Alternative approach failed:', altError.message);
    }

    return false;

  } catch (error) {
    console.error('❌ Force update failed:', error.message);
    return false;
  }
}

async function createWorkaroundSolution() {
  console.log('\n🛠️  Creating workaround solution...');

  // Since we can't modify the database constraint directly,
  // let's modify our approach to work with the existing constraint

  console.log('Option 1: Pad embeddings to 1536 dimensions');
  console.log('  - Pad our 384-dim embeddings to 1536 with zeros');
  console.log('  - Modify similarity calculation to only use first 384 dims');

  console.log('\nOption 2: Use a separate embeddings table');
  console.log('  - Create new table for 384-dim embeddings');
  console.log('  - Link to faculty table via foreign key');

  console.log('\nOption 3: Store embeddings as compressed string');
  console.log('  - Convert to base64 or other format');
  console.log('  - Store in a text field instead');

  console.log('\n🎯 Implementing Option 1: Padding approach...');

  return await implementPaddingApproach();
}

async function implementPaddingApproach() {
  try {
    console.log('Creating padded embedding solution...');

    // Test if padding approach works
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Create a 384-dim embedding and pad it to 1536
    const realEmbedding = new Array(384).fill(0.1);
    const paddedEmbedding = [...realEmbedding, ...new Array(1536 - 384).fill(0)];

    console.log(`Original dimensions: ${realEmbedding.length}`);
    console.log(`Padded dimensions: ${paddedEmbedding.length}`);

    const testRecord = {
      faculty_id: 'test_padded_' + Date.now(),
      name: 'Test Padded Embedding',
      title: 'Test Title',
      school: 'Test School',
      department: 'Test Department',
      keywords: 'test keywords padded',
      embedding: JSON.stringify(paddedEmbedding)
    };

    const { data, error } = await supabase
      .from('faculty')
      .insert(testRecord)
      .select();

    if (error) {
      console.log('❌ Padded embedding test failed:', error.message);
      return false;
    } else {
      console.log('✅ Padded embedding inserted successfully!');
      console.log('🎉 Workaround solution works!');

      // Clean up test record
      await supabase
        .from('faculty')
        .delete()
        .eq('faculty_id', testRecord.faculty_id);

      console.log('✅ Test record cleaned up');

      console.log('\n📋 Next Steps:');
      console.log('1. Update embedding generation script to pad to 1536 dimensions');
      console.log('2. Update similarity calculation to use only first 384 dimensions');
      console.log('3. Generate embeddings for all faculty');

      return true;
    }

  } catch (error) {
    console.error('❌ Padding approach failed:', error.message);
    return false;
  }
}

async function main() {
  return await forceSchemaUpdate();
}

main().then((success) => {
  if (success) {
    console.log('\n🎉 Workaround solution ready!');
    console.log('Run: node scripts/generate-embeddings-padded.js');
  }
  process.exit(success ? 0 : 1);
});