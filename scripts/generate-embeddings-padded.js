const { spawn } = require('child_process');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function generateEmbeddings(texts) {
  return new Promise((resolve, reject) => {
    const pythonPath = path.join(__dirname, '..', 'python', 'simple_embedding_service.py');

    const testData = { texts };

    const pythonProcess = spawn('python', [`"${pythonPath}"`, 'generate_embeddings'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          if (result.success && result.embeddings) {
            resolve(result.embeddings);
          } else {
            reject(new Error(`Embedding generation failed: ${result.error}`));
          }
        } catch (parseError) {
          reject(new Error(`Failed to parse output: ${stdout}\nError: ${stderr}`));
        }
      } else {
        reject(new Error(`Python process failed with code ${code}: ${stderr}`));
      }
    });

    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });

    pythonProcess.stdin.write(JSON.stringify(testData));
    pythonProcess.stdin.end();
  });
}

function padEmbeddingTo1536(embedding384) {
  // Pad the 384-dimension embedding to 1536 dimensions with zeros
  if (embedding384.length !== 384) {
    throw new Error(`Expected 384 dimensions, got ${embedding384.length}`);
  }

  // Add 1152 zeros to make it 1536 total
  const padding = new Array(1536 - 384).fill(0);
  return [...embedding384, ...padding];
}

function extractReal384Embedding(embedding1536) {
  // Extract the first 384 dimensions from a padded 1536-dimension embedding
  if (embedding1536.length !== 1536) {
    throw new Error(`Expected 1536 dimensions, got ${embedding1536.length}`);
  }

  return embedding1536.slice(0, 384);
}

async function main() {
  try {
    console.log('🧠 Generating padded embeddings for all faculty...\n');

    // Setup Supabase client
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

    // Fetch all faculty data
    console.log('📥 Fetching faculty data...');
    const { data: facultyData, error } = await supabase
      .from('faculty')
      .select('faculty_id, name, keywords')
      .order('faculty_id');

    if (error || !facultyData) {
      throw new Error(`Failed to fetch faculty data: ${error?.message}`);
    }

    console.log(`Found ${facultyData.length} faculty members`);
    console.log('🔧 Using padding workaround: 384 → 1536 dimensions\n');

    // Process in batches to avoid memory issues
    const batchSize = 20;
    let processed = 0;
    let updated = 0;
    let errors = 0;

    for (let i = 0; i < facultyData.length; i += batchSize) {
      const batch = facultyData.slice(i, i + batchSize);
      const batchTexts = batch.map(f => f.keywords || '');

      console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(facultyData.length/batchSize)} (${batch.length} faculty)...`);

      try {
        // Generate 384-dimension embeddings for this batch
        const embeddings384 = await generateEmbeddings(batchTexts);

        if (embeddings384.length !== batch.length) {
          throw new Error(`Embedding count mismatch: expected ${batch.length}, got ${embeddings384.length}`);
        }

        console.log(`   ✅ Generated ${embeddings384.length} embeddings (384 dims each)`);

        // Pad each embedding to 1536 dimensions
        const embeddings1536 = embeddings384.map(emb => {
          if (emb.length !== 384) {
            throw new Error(`Expected 384 dimensions, got ${emb.length}`);
          }
          return padEmbeddingTo1536(emb);
        });

        console.log(`   ✅ Padded to 1536 dimensions for database compatibility`);

        // Update database with padded embeddings
        for (let j = 0; j < batch.length; j++) {
          const faculty = batch[j];
          const paddedEmbedding = embeddings1536[j];

          // Verify padding worked correctly
          if (paddedEmbedding.length !== 1536) {
            throw new Error(`Padding failed: expected 1536, got ${paddedEmbedding.length}`);
          }

          try {
            const { error: updateError } = await supabase
              .from('faculty')
              .update({
                embedding: JSON.stringify(paddedEmbedding)
              })
              .eq('faculty_id', faculty.faculty_id);

            if (updateError) {
              console.error(`   ❌ Error updating ${faculty.faculty_id}: ${updateError.message}`);
              errors++;
            } else {
              updated++;
            }
          } catch (dbError) {
            console.error(`   ❌ Database error for ${faculty.faculty_id}:`, dbError);
            errors++;
          }

          processed++;
        }

        console.log(`   ✅ Batch complete. Progress: ${processed}/${facultyData.length}`);

        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (batchError) {
        console.error(`❌ Batch processing failed:`, batchError.message);
        errors += batch.length;
        processed += batch.length;
      }
    }

    console.log(`\n📊 Padded Embedding Generation Complete:`);
    console.log(`✅ Successfully updated: ${updated} faculty`);
    console.log(`❌ Failed to update: ${errors} faculty`);
    console.log(`📁 Total processed: ${processed} faculty`);
    console.log(`🔧 Format: 384 real dimensions + 1152 padding = 1536 total`);

    // Verify final count
    const { count, error: countError } = await supabase
      .from('faculty')
      .select('*', { count: 'exact', head: true })
      .not('embedding', 'is', null);

    if (!countError) {
      console.log(`📋 Faculty with embeddings: ${count}/${facultyData.length}`);
    }

    // Test extraction of real embedding
    if (count > 0) {
      console.log('\n🧪 Testing embedding extraction...');
      const { data: testFaculty, error: testError } = await supabase
        .from('faculty')
        .select('faculty_id, embedding')
        .not('embedding', 'is', null)
        .limit(1)
        .single();

      if (!testError && testFaculty) {
        const paddedEmbedding = JSON.parse(testFaculty.embedding);
        const realEmbedding = extractReal384Embedding(paddedEmbedding);

        console.log(`   ✅ Padded embedding: ${paddedEmbedding.length} dimensions`);
        console.log(`   ✅ Extracted real embedding: ${realEmbedding.length} dimensions`);
        console.log(`   ✅ Real embedding range: [${Math.min(...realEmbedding).toFixed(4)}, ${Math.max(...realEmbedding).toFixed(4)}]`);
        console.log(`   ✅ Padding verification: All padding values are 0? ${paddedEmbedding.slice(384).every(v => v === 0)}`);
      }
    }

    if (updated === facultyData.length) {
      console.log('\n🎉 All faculty embeddings generated successfully!');
      console.log('🚀 Advanced similarity system is now ready!');
      console.log('\nNext: Test with: curl "http://localhost:3000/api/search?q=computer+science"');
      return true;
    } else {
      console.log('\n⚠️  Some embeddings failed to generate. Check errors above.');
      return false;
    }

  } catch (error) {
    console.error('❌ Padded embedding generation failed:', error.message);
    return false;
  }
}

// Export functions for use in other scripts
module.exports = {
  padEmbeddingTo1536,
  extractReal384Embedding,
  generateEmbeddings
};

if (require.main === module) {
  main().then((success) => {
    process.exit(success ? 0 : 1);
  });
}