const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Use @xenova/transformers directly
let pipeline, env;
let embeddingPipeline = null;

async function loadTransformers() {
  const transformers = await import('@xenova/transformers');
  pipeline = transformers.pipeline;
  env = transformers.env;

  // Configure transformers.js
  env.allowLocalModels = false;
  env.useBrowserCache = false;
}

async function getEmbeddingPipeline() {
  if (embeddingPipeline) {
    return embeddingPipeline;
  }

  console.log('   Loading model: Xenova/all-MiniLM-L6-v2...');
  embeddingPipeline = await pipeline(
    'feature-extraction',
    'Xenova/all-MiniLM-L6-v2',
    { quantized: true }
  );
  console.log('   Model loaded successfully!');
  return embeddingPipeline;
}

function cleanText(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .trim();
}

async function generateEmbedding(text) {
  const cleanedText = cleanText(text);

  if (!cleanedText) {
    return new Array(384).fill(0);
  }

  const pipe = await getEmbeddingPipeline();
  const output = await pipe(cleanedText, {
    pooling: 'mean',
    normalize: true,
  });

  return Array.from(output.data);
}

function padEmbeddingTo1536(embedding) {
  if (embedding.length !== 384) {
    console.warn(`Warning: Expected 384 dimensions, got ${embedding.length}`);
  }
  return [...embedding, ...new Array(1536 - embedding.length).fill(0)];
}

async function generateEmbeddingsForAllFaculty() {
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

    // Load the embedding service
    console.log('🧠 Loading Transformers.js...');
    console.log('⏳ This may take a few moments on first run...\n');
    await loadTransformers();

    // Fetch all faculty data
    console.log('📥 Fetching faculty data...');
    const { rows: facultyData } = await client.query(`
      SELECT faculty_id, name, keywords
      FROM faculty
      ORDER BY faculty_id
    `);
    console.log(`Found ${facultyData.length} faculty members\n`);

    // Process in batches
    const batchSize = 10; // Smaller batches to avoid memory issues
    let processed = 0;
    let updated = 0;
    let errors = 0;

    for (let i = 0; i < facultyData.length; i += batchSize) {
      const batch = facultyData.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(facultyData.length / batchSize);

      console.log(`🔄 Processing batch ${batchNum}/${totalBatches} (${batch.length} faculty)...`);

      for (const faculty of batch) {
        try {
          // Generate embedding using Transformers.js
          const text = faculty.keywords || faculty.name || '';
          const embedding384 = await generateEmbedding(text);

          // Pad to 1536 dimensions for database compatibility
          const embedding1536 = padEmbeddingTo1536(embedding384);

          // Convert to PostgreSQL array format
          const embeddingArray = `[${embedding1536.join(',')}]`;

          // Update database
          await client.query(
            'UPDATE faculty SET embedding = $1 WHERE faculty_id = $2',
            [embeddingArray, faculty.faculty_id]
          );

          updated++;
          processed++;

          // Show progress every 10 records
          if (processed % 10 === 0) {
            console.log(`   Progress: ${processed}/${facultyData.length} (${Math.round(processed/facultyData.length*100)}%)`);
          }

        } catch (error) {
          console.error(`   ❌ Error processing ${faculty.faculty_id}:`, error.message);
          errors++;
          processed++;
        }
      }

      console.log(`   ✅ Batch ${batchNum} complete\n`);

      // Small delay to avoid overwhelming the system
      if (i + batchSize < facultyData.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('\n📊 Embedding Generation Summary:');
    console.log(`✅ Successfully updated: ${updated} faculty`);
    console.log(`❌ Failed to update: ${errors} faculty`);
    console.log(`📁 Total processed: ${processed} faculty`);
    console.log(`🔧 Format: 384 real dimensions + 1152 padding = 1536 total`);

    // Verify final count
    const { rows } = await client.query(`
      SELECT COUNT(*) as count FROM faculty WHERE embedding IS NOT NULL
    `);
    console.log(`\n📋 Faculty with embeddings: ${rows[0].count}/${facultyData.length}`);

    if (updated === facultyData.length) {
      console.log('\n🎉 All faculty embeddings generated successfully!');
      console.log('🚀 Your similarity search system is now ready!');
      return true;
    } else {
      console.log('\n⚠️  Some embeddings failed to generate. Check errors above.');
      return false;
    }

  } catch (error) {
    console.error('❌ Error generating embeddings:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed.');
  }
}

// Run if called directly
if (require.main === module) {
  generateEmbeddingsForAllFaculty()
    .then((success) => {
      console.log('\n✨ Done!');
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n💥 Generation failed:', error);
      process.exit(1);
    });
}

module.exports = { generateEmbeddingsForAllFaculty };
