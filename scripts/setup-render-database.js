const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function setupDatabase() {
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

    // Read the schema file
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    console.log('📖 Reading schema file:', schemaPath);
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('🔧 Setting up database schema...\n');

    // Execute the schema
    await client.query(schema);

    console.log('\n✅ Database schema setup completed successfully!');
    console.log('📋 Created:');
    console.log('   - pgvector extension');
    console.log('   - faculty table');
    console.log('   - 5 indexes');
    console.log('   - 5 functions');

    // Verify setup
    const { rows } = await client.query(`
      SELECT COUNT(*) as count FROM faculty;
    `);
    console.log(`\n📊 Current faculty count: ${rows[0].count}`);

  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed.');
  }
}

// Run if called directly
if (require.main === module) {
  setupDatabase()
    .then(() => {
      console.log('\n✨ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupDatabase };
