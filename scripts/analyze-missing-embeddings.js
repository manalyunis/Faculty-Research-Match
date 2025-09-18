const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function analyzeMissingEmbeddings() {
  try {
    console.log('🔍 Analyzing missing embeddings...\n');

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

    // Get total faculty count
    const { count: totalCount, error: totalError } = await supabase
      .from('faculty')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      throw new Error(`Failed to get total count: ${totalError.message}`);
    }

    // Get faculty with embeddings
    const { count: embeddedCount, error: embeddedError } = await supabase
      .from('faculty')
      .select('*', { count: 'exact', head: true })
      .not('embedding', 'is', null);

    if (embeddedError) {
      throw new Error(`Failed to get embedded count: ${embeddedError.message}`);
    }

    const missingCount = totalCount - embeddedCount;

    console.log('📊 Embedding Status:');
    console.log(`   Total faculty: ${totalCount}`);
    console.log(`   With embeddings: ${embeddedCount} (${Math.round(embeddedCount/totalCount*100)}%)`);
    console.log(`   Missing embeddings: ${missingCount} (${Math.round(missingCount/totalCount*100)}%)`);

    if (missingCount === 0) {
      console.log('🎉 All faculty have embeddings!');
      return true;
    }

    // Get details of faculty without embeddings
    console.log('\n🔍 Faculty without embeddings:');
    const { data: missingFaculty, error: missingError } = await supabase
      .from('faculty')
      .select('faculty_id, name, title, school, department, keywords')
      .is('embedding', null)
      .order('faculty_id');

    if (missingError) {
      throw new Error(`Failed to get missing faculty: ${missingError.message}`);
    }

    console.log(`\nFound ${missingFaculty.length} faculty without embeddings:`);

    // Analyze patterns in missing embeddings
    const schoolCounts = {};
    const departmentCounts = {};
    const keywordLengths = [];

    missingFaculty.forEach((faculty, index) => {
      if (index < 10) { // Show first 10
        console.log(`   ${index + 1}. ${faculty.name} (ID: ${faculty.faculty_id})`);
        console.log(`      School: ${faculty.school}`);
        console.log(`      Department: ${faculty.department}`);
        console.log(`      Keywords length: ${faculty.keywords ? faculty.keywords.length : 0} chars`);
        console.log('');
      }

      // Count by school
      schoolCounts[faculty.school] = (schoolCounts[faculty.school] || 0) + 1;

      // Count by department
      departmentCounts[faculty.department] = (departmentCounts[faculty.department] || 0) + 1;

      // Track keyword lengths
      keywordLengths.push(faculty.keywords ? faculty.keywords.length : 0);
    });

    if (missingFaculty.length > 10) {
      console.log(`   ... and ${missingFaculty.length - 10} more`);
    }

    // Show patterns
    console.log('\n📈 Patterns in missing embeddings:');

    console.log('\nBy School:');
    Object.entries(schoolCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([school, count]) => {
        console.log(`   ${school}: ${count} faculty`);
      });

    console.log('\nBy Department:');
    Object.entries(departmentCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([dept, count]) => {
        console.log(`   ${dept}: ${count} faculty`);
      });

    // Keyword analysis
    const avgKeywordLength = keywordLengths.reduce((a, b) => a + b, 0) / keywordLengths.length;
    const emptyKeywords = keywordLengths.filter(len => len === 0).length;

    console.log('\nKeyword Analysis:');
    console.log(`   Average keyword length: ${Math.round(avgKeywordLength)} chars`);
    console.log(`   Empty keywords: ${emptyKeywords}/${missingFaculty.length} (${Math.round(emptyKeywords/missingFaculty.length*100)}%)`);
    console.log(`   Keyword length range: ${Math.min(...keywordLengths)} - ${Math.max(...keywordLengths)} chars`);

    // Sample some faculty with different keyword lengths for retry
    console.log('\n🎯 Recommended retry strategy:');

    const emptyKeywordFaculty = missingFaculty.filter(f => !f.keywords || f.keywords.trim().length === 0);
    const shortKeywordFaculty = missingFaculty.filter(f => f.keywords && f.keywords.length > 0 && f.keywords.length < 50);
    const normalKeywordFaculty = missingFaculty.filter(f => f.keywords && f.keywords.length >= 50);

    console.log(`   1. Empty keywords: ${emptyKeywordFaculty.length} faculty (use name + title for embedding)`);
    console.log(`   2. Short keywords: ${shortKeywordFaculty.length} faculty (likely to succeed on retry)`);
    console.log(`   3. Normal keywords: ${normalKeywordFaculty.length} faculty (retry with smaller batches)`);

    // Export list for retry
    console.log('\n💾 Exporting missing faculty list...');

    const missingFacultyData = {
      total: missingFaculty.length,
      timestamp: new Date().toISOString(),
      faculty: missingFaculty.map(f => ({
        faculty_id: f.faculty_id,
        name: f.name,
        keywords: f.keywords || '',
        keywordLength: f.keywords ? f.keywords.length : 0,
        category: !f.keywords || f.keywords.trim().length === 0 ? 'empty' :
                 f.keywords.length < 50 ? 'short' : 'normal'
      }))
    };

    // Write to file for reference
    const fs = require('fs');
    const path = require('path');
    const outputPath = path.join(__dirname, 'missing-embeddings.json');
    fs.writeFileSync(outputPath, JSON.stringify(missingFacultyData, null, 2));

    console.log(`   ✅ Saved to: ${outputPath}`);

    return false; // Indicates work needed

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    return false;
  }
}

analyzeMissingEmbeddings().then((allComplete) => {
  if (!allComplete) {
    console.log('\n📋 Next Steps:');
    console.log('1. Run: node scripts/retry-missing-embeddings.js');
    console.log('2. Check for specific error patterns');
    console.log('3. Use smaller batch sizes for problematic faculty');
  }
  process.exit(allComplete ? 0 : 1);
});