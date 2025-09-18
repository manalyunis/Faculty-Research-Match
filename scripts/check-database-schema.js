const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkDatabaseSchema() {
  try {
    console.log('🔍 Checking database schema...\n');

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

    // Check table structure
    console.log('📋 Faculty table structure:');
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_info', { table_name: 'faculty' });

    if (tableError) {
      console.log('❌ Could not get table info via RPC, trying alternative...');

      // Alternative: Check with a sample query
      const { data: sampleData, error: sampleError } = await supabase
        .from('faculty')
        .select('*')
        .limit(1);

      if (sampleError) {
        console.error('❌ Error getting sample data:', sampleError);
      } else {
        console.log('✅ Sample record structure:');
        if (sampleData && sampleData.length > 0) {
          Object.keys(sampleData[0]).forEach(key => {
            const value = sampleData[0][key];
            const type = Array.isArray(value) ? `array[${value.length}]` : typeof value;
            console.log(`   ${key}: ${type}`);
          });
        }
      }
    } else {
      console.log('✅ Table info retrieved:', tableInfo);
    }

    // Check for embedding column constraints
    console.log('\n🔧 Checking embedding column constraints...');

    // Test with a small embedding to see what error we get
    const testEmbedding = new Array(384).fill(0.1);

    console.log(`Testing with ${testEmbedding.length} dimensions...`);

    const { error: testError } = await supabase
      .from('faculty')
      .select('faculty_id')
      .limit(1)
      .single();

    if (testError) {
      console.error('❌ Error with test query:', testError);
    } else {
      console.log('✅ Basic query works');
    }

    // Try to insert a test record to see constraint error
    const testRecord = {
      faculty_id: 'test_embedding_' + Date.now(),
      name: 'Test Faculty',
      title: 'Test Title',
      school: 'Test School',
      department: 'Test Department',
      keywords: 'test keywords',
      embedding: JSON.stringify(testEmbedding)
    };

    console.log('\n🧪 Testing embedding insertion...');
    const { data: insertData, error: insertError } = await supabase
      .from('faculty')
      .insert(testRecord)
      .select();

    if (insertError) {
      console.log('❌ Embedding insertion failed (expected):');
      console.log('   Error:', insertError.message);
      console.log('   Details:', insertError.details);
      console.log('   Hint:', insertError.hint);

      // Parse the constraint from error message
      if (insertError.message.includes('expected') && insertError.message.includes('dimensions')) {
        const match = insertError.message.match(/expected (\d+) dimensions/);
        if (match) {
          console.log(`\n📏 Current constraint: ${match[1]} dimensions`);
          console.log(`📏 Our model generates: 384 dimensions`);
          console.log(`📏 Dimension mismatch: ${match[1]} vs 384`);
        }
      }
    } else {
      console.log('✅ Embedding inserted successfully!');
      console.log('   This means the constraint may have been fixed already.');

      // Clean up test record
      await supabase
        .from('faculty')
        .delete()
        .eq('faculty_id', testRecord.faculty_id);

      console.log('✅ Test record cleaned up');
    }

    // Check current faculty count
    const { count, error: countError } = await supabase
      .from('faculty')
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      console.log(`\n📊 Current faculty count: ${count}`);
    }

    // Check how many have embeddings
    const { count: embeddingCount, error: embeddingError } = await supabase
      .from('faculty')
      .select('*', { count: 'exact', head: true })
      .not('embedding', 'is', null);

    if (!embeddingError) {
      console.log(`📊 Faculty with embeddings: ${embeddingCount}`);
    }

  } catch (error) {
    console.error('❌ Schema check failed:', error.message);
    return false;
  }
}

checkDatabaseSchema().then(() => {
  process.exit(0);
});