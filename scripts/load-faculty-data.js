const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function loadFacultyData() {
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

    // Read the faculty data JSON file
    const dataPath = path.join(__dirname, '../data/faculty-data.json');
    console.log('📖 Reading faculty data:', dataPath);
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(rawData);

    const facultyRecords = data.faculty;
    console.log(`📋 Found ${facultyRecords.length} faculty records\n`);

    // Insert data in batches
    const batchSize = 50;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < facultyRecords.length; i += batchSize) {
      const batch = facultyRecords.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(facultyRecords.length / batchSize);

      console.log(`📤 Inserting batch ${batchNum}/${totalBatches} (${batch.length} records)...`);

      // Build INSERT query with multiple values
      const values = [];
      const placeholders = [];

      batch.forEach((record, idx) => {
        const offset = idx * 6;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`);
        values.push(
          record.faculty_id,
          record.name,
          record.keywords || 'no keywords',
          record.title,
          record.school,
          record.department
        );
      });

      const insertQuery = `
        INSERT INTO faculty (faculty_id, name, keywords, title, school, department)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (faculty_id) DO NOTHING
      `;

      try {
        const result = await client.query(insertQuery, values);
        const insertedCount = result.rowCount;
        inserted += insertedCount;
        console.log(`✅ Inserted ${insertedCount} records (${inserted} total)\n`);
      } catch (error) {
        console.error(`❌ Error inserting batch ${batchNum}:`, error.message);
        errors += batch.length;
      }
    }

    console.log('\n📊 Import Summary:');
    console.log(`✅ Successfully imported: ${inserted} records`);
    console.log(`⚠️  Skipped/Failed: ${facultyRecords.length - inserted} records`);
    console.log(`📁 Total processed: ${facultyRecords.length} records`);

    // Verify final count
    const { rows } = await client.query('SELECT COUNT(*) as count FROM faculty');
    console.log(`\n📋 Final database count: ${rows[0].count} records`);

  } catch (error) {
    console.error('❌ Error loading data:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed.');
  }
}

// Run if called directly
if (require.main === module) {
  loadFacultyData()
    .then(() => {
      console.log('\n✨ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Load failed:', error);
      process.exit(1);
    });
}

module.exports = { loadFacultyData };
