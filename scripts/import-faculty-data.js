const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function importFacultyData() {
  try {
    // Setup Supabase client
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

    // Read Excel file
    const excelPath = path.join(__dirname, '../../Sample.xlsx');
    console.log('📖 Reading Excel file:', excelPath);

    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (rawData.length === 0) {
      console.error('❌ No data found in Excel file');
      return;
    }

    // Display headers and first few rows to understand structure
    console.log('📋 Excel file structure:');
    console.log('Headers:', rawData[0]);
    console.log('Sample row:', rawData[1]);
    console.log('Total rows:', rawData.length);

    // Convert to objects using first row as headers
    const headers = rawData[0];
    const dataRows = rawData.slice(1).filter(row => row.some(cell => cell)); // Remove empty rows

    console.log(`\n🔄 Processing ${dataRows.length} faculty records...`);

    // Map Excel columns to our database schema
    const facultyRecords = dataRows.map((row, index) => {
      const record = {};

      // Direct mapping based on known column structure
      headers.forEach((header, colIndex) => {
        const value = row[colIndex];
        const headerStr = header?.toString() || '';

        switch (headerStr) {
          case 'National Identifier':
            record.faculty_id = value?.toString() || `auto_${Date.now()}_${index}`;
            break;
          case 'Full Name':
            record.name = value?.toString() || '';
            break;
          case 'Keywords':
            record.keywords = value?.toString() || '';
            break;
          case 'Job':
            record.title = value?.toString() || '';
            break;
          case 'Organization':
            // Parse organization string to extract school and department
            const orgStr = value?.toString() || '';
            if (orgStr.includes(' - ')) {
              const parts = orgStr.split(' - ');
              record.school = parts[0].trim();
              record.department = parts[1]?.split(',')[0]?.trim() || 'Unknown Department';
            } else {
              record.school = orgStr || 'Unknown School';
              record.department = 'Unknown Department';
            }
            break;
        }
      });

      // Ensure required fields
      if (!record.faculty_id) {
        record.faculty_id = `auto_${Date.now()}_${index}`;
      }
      if (!record.name) {
        record.name = `Unknown Faculty ${index + 1}`;
      }
      if (!record.title) {
        record.title = 'Unknown Title';
      }
      if (!record.school) {
        record.school = 'Unknown School';
      }
      if (!record.department) {
        record.department = 'Unknown Department';
      }
      if (!record.keywords) {
        record.keywords = '';
      }

      return record;
    });

    // Show sample of mapped data
    console.log('\n📋 Sample mapped record:');
    console.log(JSON.stringify(facultyRecords[0], null, 2));

    // Insert data in batches
    const batchSize = 50;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < facultyRecords.length; i += batchSize) {
      const batch = facultyRecords.slice(i, i + batchSize);

      console.log(`\n📤 Inserting batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(facultyRecords.length/batchSize)} (${batch.length} records)...`);

      const { data, error } = await supabase
        .from('faculty')
        .insert(batch)
        .select();

      if (error) {
        console.error(`❌ Error inserting batch:`, error);
        errors += batch.length;
      } else {
        console.log(`✅ Successfully inserted ${data.length} records`);
        inserted += data.length;
      }
    }

    console.log(`\n📊 Import Summary:`);
    console.log(`✅ Successfully imported: ${inserted} records`);
    console.log(`❌ Failed to import: ${errors} records`);
    console.log(`📁 Total processed: ${facultyRecords.length} records`);

    // Verify final count
    const { count, error: countError } = await supabase
      .from('faculty')
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      console.log(`📋 Final database count: ${count} records`);
    }

  } catch (error) {
    console.error('❌ Import error:', error);
  }
}

importFacultyData();