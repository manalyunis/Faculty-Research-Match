const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

async function processExcelFile(filePath, outputPath) {
  try {
    console.log(`Processing ${filePath}...`);

    // Read the Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Found ${rawData.length} rows in Excel file`);
    console.log('Sample row:', rawData[0]);

    // Process the data to match our API format
    const faculty = rawData.map((row, index) => {
      // Try to map common field names
      const facultyId = row.faculty_id || row.id || row.ID || row['National Identifier'] || `FACULTY-${index + 1}`;
      const name = row.name || row.Name || row['Full Name'] || row['Faculty Name'];
      const keywords = row.keywords || row.Keywords || row['Research Keywords'] || row['Research Areas'] || '';
      const title = row.title || row.Title || row['Academic Title'] || row.Position || row.Job || 'Professor';

      // Parse Organization field to extract school and department
      const organization = row.organization || row.Organization || '';
      let school = 'Unknown School';
      let department = 'Unknown Department';

      if (organization) {
        // Example: "School of Engineering - Electrical & Computer Engineering Department, Byblos"
        const parts = organization.split(' - ');
        if (parts.length >= 2) {
          school = parts[0].trim();
          // Remove location suffix (e.g., ", Byblos")
          department = parts[1].replace(/,.*$/, '').trim();
        } else {
          school = organization.trim();
        }
      }

      return {
        faculty_id: String(facultyId).trim(),
        name: String(name || 'Unknown Name').trim(),
        keywords: String(keywords).trim(),
        title: String(title).trim(),
        school: school,
        department: department
      };
    }).filter(faculty => faculty.name !== 'Unknown Name' && faculty.keywords);

    console.log(`Processed ${faculty.length} valid faculty records`);

    // Create the output in the format expected by our API
    const output = {
      faculty: faculty
    };

    // Write to JSON file
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`Output written to ${outputPath}`);

    return faculty;
  } catch (error) {
    console.error('Error processing Excel file:', error);
    throw error;
  }
}

async function uploadToAPI(data) {
  try {
    console.log('Uploading to API...');

    const response = await fetch('http://localhost:3000/api/ingest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (response.ok) {
      console.log('Upload successful:', result);
    } else {
      console.error('Upload failed:', result);
    }

    return result;
  } catch (error) {
    console.error('Error uploading to API:', error);
    throw error;
  }
}

async function main() {
  const excelPath = path.join(__dirname, '../../Sample.xlsx');
  const outputPath = path.join(__dirname, '../data/faculty-data.json');

  // Create data directory if it doesn't exist
  const dataDir = path.dirname(outputPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  try {
    // Process Excel file
    const faculty = await processExcelFile(excelPath, outputPath);

    // Upload to API (optional - you can also just create the JSON file)
    // const result = await uploadToAPI({ faculty });

    console.log('\n=== Processing Complete ===');
    console.log(`Processed ${faculty.length} faculty records`);
    console.log(`JSON output: ${outputPath}`);
    console.log('\nTo upload this data to your API, run:');
    console.log(`curl -X POST http://localhost:3000/api/ingest -H "Content-Type: application/json" -d @${outputPath}`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { processExcelFile, uploadToAPI };