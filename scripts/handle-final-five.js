const { spawn } = require('child_process');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

function padEmbeddingTo1536(embedding384) {
  if (embedding384.length !== 384) {
    throw new Error(`Expected 384 dimensions, got ${embedding384.length}`);
  }
  const padding = new Array(1536 - 384).fill(0);
  return [...embedding384, ...padding];
}

async function generateSingleEmbedding(text, maxRetries = 3) {
  for (let retry = 0; retry < maxRetries; retry++) {
    try {
      const pythonPath = path.join(__dirname, '..', 'python', 'simple_embedding_service.py');

      const testData = { texts: [text] };

      const result = await new Promise((resolve, reject) => {
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
              if (result.success && result.embeddings && result.embeddings.length > 0) {
                resolve(result.embeddings[0]);
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

      return result;

    } catch (error) {
      console.log(`      Retry ${retry + 1}/${maxRetries} failed: ${error.message}`);
      if (retry === maxRetries - 1) {
        throw error;
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 2000 * (retry + 1)));
    }
  }
}

function createAlternativeTexts(faculty) {
  // Create multiple alternative texts for problematic faculty
  const alternatives = [];

  // Option 1: Basic info
  alternatives.push(`${faculty.name} ${faculty.title} ${faculty.school} ${faculty.department}`);

  // Option 2: Just name and title
  alternatives.push(`${faculty.name} ${faculty.title}`);

  // Option 3: Clean keywords (remove special characters, truncate)
  if (faculty.keywords) {
    const cleaned = faculty.keywords
      .replace(/[^\w\s,.-]/g, ' ')  // Remove special chars except basic punctuation
      .replace(/\s+/g, ' ')         // Normalize whitespace
      .trim()
      .substring(0, 500);           // Truncate to 500 chars
    if (cleaned.length > 10) {
      alternatives.push(cleaned);
    }
  }

  // Option 4: Very simple fallback
  alternatives.push(`faculty member ${faculty.name}`);

  // Option 5: Department-based
  alternatives.push(`${faculty.department} faculty ${faculty.title}`);

  return alternatives;
}

async function handleFinalFive() {
  try {
    console.log('🔧 Handling final 5 problematic faculty members...\n');

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

    // Get remaining faculty without embeddings
    console.log('📥 Fetching remaining faculty without embeddings...');
    const { data: remainingFaculty, error } = await supabase
      .from('faculty')
      .select('faculty_id, name, title, school, department, keywords')
      .is('embedding', null)
      .order('faculty_id');

    if (error) {
      throw new Error(`Failed to fetch remaining faculty: ${error.message}`);
    }

    console.log(`Found ${remainingFaculty.length} faculty still without embeddings:`);

    if (remainingFaculty.length === 0) {
      console.log('🎉 All faculty now have embeddings!');
      return true;
    }

    // Show details of problematic faculty
    remainingFaculty.forEach((faculty, index) => {
      console.log(`\n${index + 1}. ${faculty.name} (ID: ${faculty.faculty_id})`);
      console.log(`   Title: ${faculty.title}`);
      console.log(`   School: ${faculty.school}`);
      console.log(`   Department: ${faculty.department}`);
      console.log(`   Keywords length: ${faculty.keywords ? faculty.keywords.length : 0} chars`);
      if (faculty.keywords && faculty.keywords.length > 0) {
        console.log(`   Keywords preview: "${faculty.keywords.substring(0, 100)}..."`);
      }
    });

    let successCount = 0;
    let failureCount = 0;

    // Process each faculty individually with multiple strategies
    for (const faculty of remainingFaculty) {
      console.log(`\n🔄 Processing: ${faculty.name}`);

      const alternatives = createAlternativeTexts(faculty);
      let success = false;

      for (let i = 0; i < alternatives.length && !success; i++) {
        const text = alternatives[i];
        console.log(`   📝 Trying strategy ${i + 1}/${alternatives.length}: "${text.substring(0, 50)}..."`);

        try {
          const embedding384 = await generateSingleEmbedding(text);
          const paddedEmbedding = padEmbeddingTo1536(embedding384);

          // Update database
          const { error: updateError } = await supabase
            .from('faculty')
            .update({
              embedding: JSON.stringify(paddedEmbedding)
            })
            .eq('faculty_id', faculty.faculty_id);

          if (updateError) {
            console.log(`      ❌ Database update failed: ${updateError.message}`);
            continue;
          }

          console.log(`      ✅ Success with strategy ${i + 1}!`);
          successCount++;
          success = true;

        } catch (error) {
          console.log(`      ❌ Strategy ${i + 1} failed: ${error.message}`);
        }

        // Small delay between attempts
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (!success) {
        console.log(`   ❌ All strategies failed for ${faculty.name}`);
        failureCount++;

        // As last resort, create a minimal embedding using just the name
        try {
          console.log(`   🆘 Last resort: using just name "${faculty.name}"`);
          const embedding384 = await generateSingleEmbedding(faculty.name);
          const paddedEmbedding = padEmbeddingTo1536(embedding384);

          const { error: updateError } = await supabase
            .from('faculty')
            .update({
              embedding: JSON.stringify(paddedEmbedding)
            })
            .eq('faculty_id', faculty.faculty_id);

          if (!updateError) {
            console.log(`   ✅ Last resort succeeded!`);
            successCount++;
            failureCount--;
          } else {
            console.log(`   ❌ Last resort failed: ${updateError.message}`);
          }

        } catch (lastResortError) {
          console.log(`   ❌ Last resort failed: ${lastResortError.message}`);
        }
      }
    }

    console.log(`\n📊 Final Results:`);
    console.log(`✅ Successfully processed: ${successCount}/${remainingFaculty.length}`);
    console.log(`❌ Failed to process: ${failureCount}/${remainingFaculty.length}`);

    // Final verification
    const { count: finalEmbeddedCount, error: countError } = await supabase
      .from('faculty')
      .select('*', { count: 'exact', head: true })
      .not('embedding', 'is', null);

    if (!countError) {
      const { count: totalCount } = await supabase
        .from('faculty')
        .select('*', { count: 'exact', head: true });

      const percentage = Math.round(finalEmbeddedCount/totalCount*100);
      console.log(`\n🎯 Final Coverage: ${finalEmbeddedCount}/${totalCount} faculty (${percentage}%)`);

      if (finalEmbeddedCount === totalCount) {
        console.log('🎉 100% EMBEDDING COVERAGE ACHIEVED!');
        console.log('🚀 Advanced similarity system ready for all faculty!');
        return true;
      } else {
        const remaining = totalCount - finalEmbeddedCount;
        console.log(`⚠️  ${remaining} faculty still without embeddings (likely due to data issues)`);

        if (remaining <= 2) {
          console.log('💡 Consider manual data cleanup for remaining faculty');
        }
      }
    }

    return successCount > 0;

  } catch (error) {
    console.error('❌ Final processing failed:', error.message);
    return false;
  }
}

handleFinalFive().then((success) => {
  process.exit(success ? 0 : 1);
});