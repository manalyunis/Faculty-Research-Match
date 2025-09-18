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

async function main() {
  try {
    console.log('🧠 Generating embeddings for all faculty...\n');

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

    console.log(`Found ${facultyData.length} faculty members\n`);

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
        // Generate embeddings for this batch
        const embeddings = await generateEmbeddings(batchTexts);

        if (embeddings.length !== batch.length) {
          throw new Error(`Embedding count mismatch: expected ${batch.length}, got ${embeddings.length}`);
        }

        // Update database with embeddings
        for (let j = 0; j < batch.length; j++) {
          const faculty = batch[j];
          const embedding = embeddings[j];

          try {
            const { error: updateError } = await supabase
              .from('faculty')
              .update({
                embedding: JSON.stringify(embedding)
              })
              .eq('faculty_id', faculty.faculty_id);

            if (updateError) {
              console.error(`❌ Error updating ${faculty.faculty_id}: ${updateError.message}`);
              errors++;
            } else {
              updated++;
            }
          } catch (dbError) {
            console.error(`❌ Database error for ${faculty.faculty_id}:`, dbError);
            errors++;
          }

          processed++;
        }

        console.log(`✅ Batch complete. Progress: ${processed}/${facultyData.length}`);

        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (batchError) {
        console.error(`❌ Batch processing failed:`, batchError.message);
        errors += batch.length;
        processed += batch.length;
      }
    }

    console.log(`\n📊 Embedding Generation Complete:`);
    console.log(`✅ Successfully updated: ${updated} faculty`);
    console.log(`❌ Failed to update: ${errors} faculty`);
    console.log(`📁 Total processed: ${processed} faculty`);

    // Verify final count
    const { count, error: countError } = await supabase
      .from('faculty')
      .select('*', { count: 'exact', head: true })
      .not('embedding', 'is', null);

    if (!countError) {
      console.log(`📋 Faculty with embeddings: ${count}/${facultyData.length}`);
    }

    if (updated === facultyData.length) {
      console.log('\n🎉 All faculty embeddings generated successfully!');
      return true;
    } else {
      console.log('\n⚠️  Some embeddings failed to generate. Check errors above.');
      return false;
    }

  } catch (error) {
    console.error('❌ Embedding generation failed:', error.message);
    return false;
  }
}

main().then((success) => {
  process.exit(success ? 0 : 1);
});