const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

let pipeline, env;
let embeddingPipeline = null;

async function loadTransformers() {
  const transformers = await import('@xenova/transformers');
  pipeline = transformers.pipeline;
  env = transformers.env;
  env.allowLocalModels = false;
  env.useBrowserCache = false;
}

async function getEmbeddingPipeline() {
  if (embeddingPipeline) {
    return embeddingPipeline;
  }
  embeddingPipeline = await pipeline(
    'feature-extraction',
    'Xenova/all-MiniLM-L6-v2',
    { quantized: true }
  );
  return embeddingPipeline;
}

function cleanText(text) {
  return text.toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s]/g, ' ').trim();
}

async function generateEmbedding(text) {
  const cleanedText = cleanText(text);
  if (!cleanedText) {
    return new Array(384).fill(0);
  }
  const pipe = await getEmbeddingPipeline();
  const output = await pipe(cleanedText, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

function padEmbeddingTo1536(embedding) {
  return [...embedding, ...new Array(1536 - embedding.length).fill(0)];
}

async function testSimilaritySearch(query) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!\n');

    console.log('🧠 Loading Transformers.js...');
    await loadTransformers();
    console.log('✅ Model loaded!\n');

    console.log(`🔍 Searching for: "${query}"\n`);
    console.log('⏳ Generating query embedding...');
    const queryEmbedding384 = await generateEmbedding(query);
    const queryEmbedding1536 = padEmbeddingTo1536(queryEmbedding384);
    console.log('✅ Query embedding generated!\n');

    console.log('🔎 Finding similar faculty...');
    const embeddingArray = `[${queryEmbedding1536.join(',')}]`;

    const result = await client.query(`
      SELECT
        faculty_id,
        name,
        keywords,
        title,
        school,
        department,
        1 - (embedding <=> $1::vector) AS similarity
      FROM faculty
      WHERE embedding IS NOT NULL
        AND 1 - (embedding <=> $1::vector) > 0.3
      ORDER BY embedding <=> $1::vector
      LIMIT 10
    `, [embeddingArray]);

    console.log(`\n📊 Found ${result.rows.length} similar faculty:\n`);

    result.rows.forEach((faculty, idx) => {
      console.log(`${idx + 1}. ${faculty.name}`);
      console.log(`   Similarity: ${(faculty.similarity * 100).toFixed(1)}%`);
      console.log(`   Title: ${faculty.title}`);
      console.log(`   Department: ${faculty.department}`);
      console.log(`   Keywords: ${faculty.keywords.substring(0, 100)}...`);
      console.log('');
    });

    console.log('✅ Similarity search test completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 Database connection closed.');
  }
}

// Run if called directly
if (require.main === module) {
  const query = process.argv[2] || 'machine learning and artificial intelligence';

  testSimilaritySearch(query)
    .then(() => {
      console.log('\n✨ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testSimilaritySearch };
