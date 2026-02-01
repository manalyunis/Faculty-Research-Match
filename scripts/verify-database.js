const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function verifyDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔌 Connecting to Render PostgreSQL database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // 1. Check pgvector extension
    console.log('🔍 Checking pgvector extension...');
    const extensionResult = await client.query(`
      SELECT * FROM pg_extension WHERE extname = 'vector';
    `);
    console.log(extensionResult.rows.length > 0 ? '✅ pgvector extension is installed' : '❌ pgvector extension is NOT installed');

    // 2. Check faculty table structure
    console.log('\n🔍 Checking faculty table structure...');
    const tableResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'faculty'
      ORDER BY ordinal_position;
    `);
    console.log('✅ Faculty table columns:');
    tableResult.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type}`);
    });

    // 3. Check indexes
    console.log('\n🔍 Checking indexes...');
    const indexResult = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'faculty'
      ORDER BY indexname;
    `);
    console.log(`✅ Found ${indexResult.rows.length} indexes:`);
    indexResult.rows.forEach(idx => {
      console.log(`   - ${idx.indexname}`);
    });

    // 4. Check faculty count
    console.log('\n🔍 Checking faculty data...');
    const countResult = await client.query('SELECT COUNT(*) as count FROM faculty');
    console.log(`✅ Total faculty: ${countResult.rows[0].count}`);

    // 5. Get sample faculty records
    const sampleResult = await client.query(`
      SELECT faculty_id, name, title, school, department
      FROM faculty
      LIMIT 3
    `);
    console.log('\n📋 Sample faculty records:');
    sampleResult.rows.forEach((faculty, idx) => {
      console.log(`\n   ${idx + 1}. ${faculty.name}`);
      console.log(`      ID: ${faculty.faculty_id}`);
      console.log(`      Title: ${faculty.title}`);
      console.log(`      School: ${faculty.school}`);
      console.log(`      Department: ${faculty.department}`);
    });

    // 6. Check embeddings status
    const embeddingResult = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(embedding) as with_embeddings,
        COUNT(*) - COUNT(embedding) as without_embeddings
      FROM faculty
    `);
    console.log('\n🔍 Embeddings status:');
    console.log(`   Total faculty: ${embeddingResult.rows[0].total}`);
    console.log(`   With embeddings: ${embeddingResult.rows[0].with_embeddings}`);
    console.log(`   Without embeddings: ${embeddingResult.rows[0].without_embeddings}`);

    if (parseInt(embeddingResult.rows[0].without_embeddings) > 0) {
      console.log('\n💡 Next step: Generate embeddings for all faculty records');
      console.log('   Run: node scripts/generate-embeddings-padded.js');
    }

    // 7. Check schools and departments
    const schoolResult = await client.query(`
      SELECT school, COUNT(*) as count
      FROM faculty
      GROUP BY school
      ORDER BY count DESC
      LIMIT 5
    `);
    console.log('\n📊 Top 5 schools:');
    schoolResult.rows.forEach(row => {
      console.log(`   - ${row.school}: ${row.count} faculty`);
    });

    console.log('\n✅ Database verification completed successfully!');

  } catch (error) {
    console.error('❌ Error verifying database:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed.');
  }
}

// Run if called directly
if (require.main === module) {
  verifyDatabase()
    .then(() => {
      console.log('\n✨ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Verification failed:', error);
      process.exit(1);
    });
}

module.exports = { verifyDatabase };
