const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Path to the Excel file
const excelFilePath = path.join(__dirname, 'exports', 'articles_export_2025-05-16T00-35-57.750Z.xlsx');

// Read the Excel file
console.log(`Reading file: ${excelFilePath}`);
const workbook = XLSX.readFile(excelFilePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

console.log(`Total rows: ${data.length}`);

// First, let's see what columns we have
if (data.length > 0) {
  console.log("Available columns in the Excel file:");
  const columns = Object.keys(data[0]);
  columns.forEach(col => {
    console.log(`- ${col}`);
  });
}

// Analyze missed politicians
const missedPoliticians = {};
const recognizedPoliticians = {};
let rowsWithMissedPoliticians = 0;

data.forEach((row, index) => {
  if (row.Politicians_missed && row.Politicians_missed.trim() !== '') {
    rowsWithMissedPoliticians++;
    
    // Split the politicians names (they might be comma-separated)
    const missed = row.Politicians_missed.split(',').map(p => p.trim()).filter(p => p);
    
    missed.forEach(politician => {
      if (!missedPoliticians[politician]) {
        missedPoliticians[politician] = 0;
      }
      missedPoliticians[politician]++;
    });
    
    // Print the row for analysis
    console.log(`\n--- Row ${index + 1} ---`);
    
    // Print all available fields that might help us understand why detection fails
    Object.entries(row).forEach(([key, value]) => {
      if (typeof value === 'string' && value.length > 150) {
        console.log(`${key}: ${value.substring(0, 150)}...`);
      } else {
        console.log(`${key}: ${value}`);
      }
    });
  }
  
  // Also track recognized politicians for comparison
  if (row.Politicians_recognized && row.Politicians_recognized.trim() !== '') {
    const recognized = row.Politicians_recognized.split(',').map(p => p.trim()).filter(p => p);
    
    recognized.forEach(politician => {
      if (!recognizedPoliticians[politician]) {
        recognizedPoliticians[politician] = 0;
      }
      recognizedPoliticians[politician]++;
    });
  }
});

// Sort missed politicians by frequency
const sortedMissed = Object.entries(missedPoliticians)
  .sort((a, b) => b[1] - a[1])
  .map(([name, count]) => ({ name, count }));

console.log(`\n--- SUMMARY ---`);
console.log(`Total rows with missed politicians: ${rowsWithMissedPoliticians} / ${data.length}`);
console.log(`\nTop missed politicians:`);
sortedMissed.forEach(({ name, count }) => {
  console.log(`- ${name}: ${count} times`);
});

// Compare with recognized politicians 
console.log(`\nMost frequently recognized politicians:`);
const sortedRecognized = Object.entries(recognizedPoliticians)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([name, count]) => ({ name, count }));

sortedRecognized.forEach(({ name, count }) => {
  console.log(`- ${name}: ${count} times`);
});

console.log('\nAnalysis complete!'); 