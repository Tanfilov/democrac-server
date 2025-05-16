
/**
 * WARNING: This script will delete all files listed in unused-files.txt
 * Make sure you have reviewed the list and have backups before running this script
 */
const fs = require('fs');
const path = require('path');

// Safety check
if (!process.argv.includes('--confirm')) {
  console.log('SAFETY CHECK: This script will permanently delete files listed in unused-files.txt');
  console.log('To proceed, run this script with the --confirm flag:');
  console.log('  node delete-unused-files.js --confirm');
  process.exit(1);
}

// Read the list of unused files
const unusedFiles = fs.readFileSync('./unused-files.txt', 'utf8')
  .split('\n')
  .filter(line => line.trim() !== '');

console.log(`Deleting ${unusedFiles.length} unused files...`);

// Delete each file
let deletedCount = 0;
unusedFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    console.log(`File not found: ${file}`);
    return;
  }
  
  try {
    fs.unlinkSync(file);
    deletedCount++;
    console.log(`Deleted: ${file}`);
  } catch (error) {
    console.error(`Error deleting file ${file}: ${error.message}`);
  }
});

console.log(`Successfully deleted ${deletedCount} files`);
