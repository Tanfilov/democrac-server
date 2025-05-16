
/**
 * Script to move unused files to a garbage folder
 * 
 * This script will move all files listed in unused-files.txt to a garbage folder.
 * Files will maintain their relative paths to avoid name conflicts.
 */
const fs = require('fs');
const path = require('path');

// Create garbage folder
const garbageFolder = 'garbage-candidates/unused-files';
if (!fs.existsSync(garbageFolder)) {
  fs.mkdirSync(garbageFolder, { recursive: true });
}

// Read the list of unused files
const unusedFiles = fs.readFileSync('./garbage-candidates/unused-files.txt', 'utf8')
  .split('\n')
  .filter(line => line.trim() !== '');

console.log(`Moving ${unusedFiles.length} unused files to ${garbageFolder}...`);

// Move each file
let movedCount = 0;
unusedFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    console.log(`File not found: ${file}`);
    return;
  }
  
  // Create the target directory structure
  const targetPath = path.join(garbageFolder, file);
  const targetDir = path.dirname(targetPath);
  
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  try {
    // Copy the file
    fs.copyFileSync(file, targetPath);
    movedCount++;
    console.log(`Moved: ${file} -> ${targetPath}`);
  } catch (error) {
    console.error(`Error moving file ${file}: ${error.message}`);
  }
});

console.log(`Successfully moved ${movedCount} files to ${garbageFolder}`);
console.log('To delete these files from their original locations, use delete-unused-files.js');

// Create a deletion script
const deleteScriptPath = './garbage-candidates/delete-unused-files.js';
const deleteScript = `
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
  .split('\\n')
  .filter(line => line.trim() !== '');

console.log(\`Deleting \${unusedFiles.length} unused files...\`);

// Delete each file
let deletedCount = 0;
unusedFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    console.log(\`File not found: \${file}\`);
    return;
  }
  
  try {
    fs.unlinkSync(file);
    deletedCount++;
    console.log(\`Deleted: \${file}\`);
  } catch (error) {
    console.error(\`Error deleting file \${file}: \${error.message}\`);
  }
});

console.log(\`Successfully deleted \${deletedCount} files\`);
`;

fs.writeFileSync(deleteScriptPath, deleteScript);
console.log(`Created deletion script at ${deleteScriptPath}`);
