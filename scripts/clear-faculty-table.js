const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function clearFacultyTable() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ Missing environment variables');
      return;
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('🗑️  Clearing faculty table...');

    // Get current count first
    const { count: beforeCount, error: countError } = await supabase
      .from('faculty')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error getting count:', countError);
      return;
    }

    console.log(`Current records in table: ${beforeCount}`);

    if (beforeCount === 0) {
      console.log('✅ Table is already empty');
      return;
    }

    // Delete all records
    const { error: deleteError } = await supabase
      .from('faculty')
      .delete()
      .neq('faculty_id', ''); // This will match all records

    if (deleteError) {
      console.error('❌ Error deleting records:', deleteError);
      return;
    }

    // Verify deletion
    const { count: afterCount, error: verifyError } = await supabase
      .from('faculty')
      .select('*', { count: 'exact', head: true });

    if (verifyError) {
      console.error('Error verifying deletion:', verifyError);
      return;
    }

    console.log(`✅ Successfully deleted ${beforeCount} records`);
    console.log(`Records remaining: ${afterCount}`);

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

clearFacultyTable();