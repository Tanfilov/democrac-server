const fs = require('fs');
const path = require('path');

// List of JSON files to check
const jsonFiles = [
  'package.json',
  'package-lock.json',
  '.env'
];

// Check each file
jsonFiles.forEach(file => {
  try {
    console.log(`Checking ${file}...`);
    const content = fs.readFileSync(file, 'utf8');
    
    // Skip validation for non-JSON files
    if (!file.endsWith('.json')) {
      console.log(`${file} is not a JSON file, skipping validation`);
      return;
    }
    
    // Check for BOM (Byte Order Mark)
    if (content.charCodeAt(0) === 0xFEFF) {
      console.error(`ERROR: ${file} contains a BOM (Byte Order Mark) at the beginning of the file`);
      return;
    }
    
    // Try to parse JSON
    JSON.parse(content);
    console.log(`${file} is valid JSON`);
  } catch (error) {
    console.error(`ERROR in ${file}: ${error.message}`);
  }
}); 