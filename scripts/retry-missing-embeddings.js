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
  if (embedding384.length !== 384) {
    throw new Error(`Expected 384 dimensions, got ${embedding384.length}`);
  }
  const padding = new Array(1536 - 384).fill(0);
  return [...embedding384, ...padding];
}

function createFallbackText(faculty) {
  // Create meaningful text from name, title, school, department when keywords are empty/short
  const parts = [
    faculty.name || '',
    faculty.title || '',
    faculty.school || '',
    faculty.department || ''
  ].filter(part => part && part.trim() && part !== 'Unknown Department' && part !== 'Unknown School');

  return parts.join(' ');
}

async function retryMissingEmbeddings() {
  try {
    console.log('🔄 Retrying embedding generation for missing faculty...\n');

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

    // Get faculty without embeddings
    console.log('📥 Fetching faculty without embeddings...');
    const { data: missingFaculty, error } = await supabase
      .from('faculty')
      .select('faculty_id, name, title, school, department, keywords')
      .is('embedding', null)
      .order('faculty_id');

    if (error || !missingFaculty) {
      throw new Error(`Failed to fetch missing faculty: ${error?.message}`);
    }

    console.log(`Found ${missingFaculty.length} faculty without embeddings`);

    if (missingFaculty.length === 0) {
      console.log('🎉 All faculty already have embeddings!');
      return true;
    }

    // Categorize faculty by complexity
    const categories = {
      empty: missingFaculty.filter(f => !f.keywords || f.keywords.trim().length === 0),
      short: missingFaculty.filter(f => f.keywords && f.keywords.length > 0 && f.keywords.length < 100),
      normal: missingFaculty.filter(f => f.keywords && f.keywords.length >= 100 && f.keywords.length < 1000),
      long: missingFaculty.filter(f => f.keywords && f.keywords.length >= 1000)
    };

    console.log('\n📊 Faculty categorization:');
    console.log(`   Empty keywords: ${categories.empty.length} faculty`);
    console.log(`   Short keywords: ${categories.short.length} faculty`);
    console.log(`   Normal keywords: ${categories.normal.length} faculty`);
    console.log(`   Long keywords: ${categories.long.length} faculty`);

    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalErrors = 0;

    // Process each category with different strategies
    for (const [categoryName, facultyList] of Object.entries(categories)) {
      if (facultyList.length === 0) continue;

      console.log(`\n🔄 Processing ${categoryName} keywords (${facultyList.length} faculty)...`);

      // Determine batch size based on category
      const batchSize = categoryName === 'long' ? 5 :
                        categoryName === 'normal' ? 10 :
                        categoryName === 'short' ? 15 : 20;

      console.log(`   Using batch size: ${batchSize}`);

      for (let i = 0; i < facultyList.length; i += batchSize) {
        const batch = facultyList.slice(i, i + batchSize);

        console.log(`   📦 Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(facultyList.length/batchSize)} (${batch.length} faculty)...`);

        try {
          // Prepare texts based on category
          const batchTexts = batch.map(faculty => {
            if (categoryName === 'empty') {
              // Use fallback text for empty keywords
              const fallbackText = createFallbackText(faculty);
              console.log(`      Using fallback for ${faculty.name}: "${fallbackText.substring(0, 50)}..."`);
              return fallbackText || 'faculty member'; // Ultimate fallback
            } else {
              // Use keywords, but truncate if too long
              let text = faculty.keywords;
              if (text.length > 2000) {
                text = text.substring(0, 2000);
                console.log(`      Truncated keywords for ${faculty.name} (${faculty.keywords.length} → 2000 chars)`);
              }
              return text;
            }
          });

          // Generate embeddings with longer timeout for complex batches
          const timeoutMs = categoryName === 'long' ? 60000 : 30000;

          const embeddings384 = await Promise.race([
            generateEmbeddings(batchTexts),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs))
          ]);

          if (embeddings384.length !== batch.length) {
            throw new Error(`Embedding count mismatch: expected ${batch.length}, got ${embeddings384.length}`);
          }

          console.log(`      ✅ Generated ${embeddings384.length} embeddings (384 dims each)`);

          // Pad embeddings to 1536 dimensions
          const embeddings1536 = embeddings384.map(emb => padEmbeddingTo1536(emb));

          // Update database
          for (let j = 0; j < batch.length; j++) {
            const faculty = batch[j];
            const paddedEmbedding = embeddings1536[j];

            try {
              const { error: updateError } = await supabase
                .from('faculty')
                .update({
                  embedding: JSON.stringify(paddedEmbedding)
                })
                .eq('faculty_id', faculty.faculty_id);

              if (updateError) {
                console.error(`      ❌ Error updating ${faculty.faculty_id}: ${updateError.message}`);
                totalErrors++;
              } else {
                totalUpdated++;
              }
            } catch (dbError) {
              console.error(`      ❌ Database error for ${faculty.faculty_id}:`, dbError.message);
              totalErrors++;
            }

            totalProcessed++;
          }

          console.log(`      ✅ Batch complete. Progress: ${totalProcessed}/${missingFaculty.length}`);

          // Shorter delay between batches for reliability
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (batchError) {
          console.error(`      ❌ Batch failed: ${batchError.message}`);

          // Try individual processing for failed batch
          if (batch.length > 1) {
            console.log(`      🔄 Attempting individual processing...`);

            for (const faculty of batch) {
              try {
                const text = categoryName === 'empty' ? createFallbackText(faculty) : faculty.keywords;
                const embeddings = await generateEmbeddings([text]);
                const paddedEmbedding = padEmbeddingTo1536(embeddings[0]);

                const { error: updateError } = await supabase
                  .from('faculty')
                  .update({
                    embedding: JSON.stringify(paddedEmbedding)
                  })
                  .eq('faculty_id', faculty.faculty_id);

                if (!updateError) {
                  console.log(`      ✅ Individual success: ${faculty.name}`);
                  totalUpdated++;
                } else {
                  console.error(`      ❌ Individual failed: ${faculty.name}`);
                  totalErrors++;
                }
              } catch (individualError) {
                console.error(`      ❌ Individual failed: ${faculty.name} - ${individualError.message}`);
                totalErrors++;
              }

              totalProcessed++;
            }
          } else {
            totalErrors += batch.length;
            totalProcessed += batch.length;
          }
        }
      }
    }

    console.log(`\n📊 Retry Results:`);
    console.log(`✅ Successfully updated: ${totalUpdated} faculty`);
    console.log(`❌ Failed to update: ${totalErrors} faculty`);
    console.log(`📁 Total processed: ${totalProcessed} faculty`);

    // Final verification
    const { count: finalEmbeddedCount, error: countError } = await supabase
      .from('faculty')
      .select('*', { count: 'exact', head: true })
      .not('embedding', 'is', null);

    if (!countError) {
      const { count: totalCount } = await supabase
        .from('faculty')
        .select('*', { count: 'exact', head: true });

      console.log(`📋 Final status: ${finalEmbeddedCount}/${totalCount} faculty have embeddings (${Math.round(finalEmbeddedCount/totalCount*100)}%)`);

      if (finalEmbeddedCount === totalCount) {
        console.log('🎉 100% embedding coverage achieved!');
        return true;
      } else {
        const remaining = totalCount - finalEmbeddedCount;
        console.log(`⚠️  ${remaining} faculty still missing embeddings`);

        if (remaining < 10) {
          console.log('💡 Recommend manual review of remaining failures');
        }
      }
    }

    return totalUpdated > 0;

  } catch (error) {
    console.error('❌ Retry process failed:', error.message);
    return false;
  }
}

retryMissingEmbeddings().then((success) => {
  process.exit(success ? 0 : 1);
});