/**
 * Dependency Analyzer for Node.js Projects
 * 
 * This script identifies which files are being actively used in a Node.js project
 * by tracing require/import statements from entry points.
 */

const fs = require('fs');
const path = require('path');

// Main entry points for the application
const ENTRY_POINTS = [
  // Production entry points
  'server/index.js',
  'server/src/index.js',
  // Test environment entry points
  'test-environment/src/index.js',
  'test-environment/tools/test-real-articles.js',
  'test-environment/tools/test-detection-html.js',
  'test-environment/tools/test-false-positives.js',
  'test-environment/tools/test-detection-accuracy.js',
  'test-environment/tools/test-specific-detection.js'
];

// Extensions to analyze
const FILE_EXTENSIONS = ['.js', '.json', '.mjs'];

// Directories to ignore (completely)
const IGNORE_DIRS = [
  'node_modules',
  '.git',
  '.cursor'
];

// Explicit files to always keep
const ALWAYS_KEEP = [
  'server/package.json',
  'server/package-lock.json',
  'package.json',
  'package-lock.json',
  'data/politicians/politicians.json',
  'render.yaml',
  '.env',
  '.env.example',
  '.gitignore',
  '.renderignore',
  '.gitattributes',
  'README.md'
];

// Set to track visited files
const visitedFiles = new Set();
// Set to track files in use
const filesInUse = new Set();
// All files in the project
const allFiles = new Set();

/**
 * Extract dependencies from a file
 * @param {string} filePath - Path to the file
 * @returns {string[]} - Array of dependencies
 */
function extractDependencies(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`  File does not exist: ${filePath}`);
    return [];
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const dependencies = [];
    
    // Match require statements
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;
    while ((match = requireRegex.exec(content)) !== null) {
      dependencies.push(match[1]);
    }
    
    // Match import statements
    const importRegex = /import\s+(?:.+\s+from\s+)?['"]([^'"]+)['"]/g;
    while ((match = importRegex.exec(content)) !== null) {
      dependencies.push(match[1]);
    }
    
    console.log(`  Found ${dependencies.length} dependencies in ${filePath}`);
    return dependencies;
  } catch (error) {
    console.error(`  Error reading file ${filePath}:`, error.message);
    return [];
  }
}

/**
 * Resolve dependency path
 * @param {string} dep - Dependency string
 * @param {string} currentFile - Current file path
 * @returns {string|null} - Resolved file path or null if not found
 */
function resolveDependency(dep, currentFile) {
  // Skip built-in modules and npm packages
  if (!dep.startsWith('.') && !dep.startsWith('/')) {
    return null;
  }
  
  const currentDir = path.dirname(currentFile);
  
  // Try with exact path
  let resolvedPath = path.resolve(currentDir, dep);
  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
    console.log(`  Resolved ${dep} -> ${resolvedPath}`);
    return resolvedPath;
  }
  
  // Try with extensions
  for (const ext of FILE_EXTENSIONS) {
    resolvedPath = path.resolve(currentDir, dep + ext);
    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
      console.log(`  Resolved ${dep} -> ${resolvedPath}`);
      return resolvedPath;
    }
  }
  
  // Try with index.js
  resolvedPath = path.resolve(currentDir, dep, 'index.js');
  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
    console.log(`  Resolved ${dep} -> ${resolvedPath}`);
    return resolvedPath;
  }
  
  console.log(`  Could not resolve dependency: ${dep} from ${currentFile}`);
  return null;
}

/**
 * Normalize file path for comparison
 * @param {string} filePath - File path to normalize
 * @returns {string} - Normalized path
 */
function normalizePath(filePath) {
  // Convert to forward slashes for consistency
  return filePath.replace(/\\/g, '/');
}

/**
 * Traverse dependencies recursively
 * @param {string} filePath - Path to the file
 */
function traverseDependencies(filePath) {
  const normalizedPath = normalizePath(filePath);
  
  // Skip if already visited or path does not exist
  if (visitedFiles.has(normalizedPath) || !fs.existsSync(filePath)) {
    return;
  }
  
  console.log(`Visiting: ${normalizedPath}`);
  visitedFiles.add(normalizedPath);
  filesInUse.add(normalizedPath);
  
  // Parse the file for dependencies
  const dependencies = extractDependencies(filePath);
  
  // Recursively process each dependency
  dependencies.forEach(dep => {
    const resolvedPath = resolveDependency(dep, filePath);
    if (resolvedPath) {
      traverseDependencies(resolvedPath);
    }
  });
}

/**
 * Collect all JS files in the project
 * @param {string} dir - Directory to scan
 */
function collectAllFiles(dir) {
  if (IGNORE_DIRS.some(ignoreDir => dir.includes(path.sep + ignoreDir) || dir.endsWith(path.sep + ignoreDir))) {
    return;
  }
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        collectAllFiles(itemPath);
      } else if (stat.isFile() && FILE_EXTENSIONS.includes(path.extname(itemPath))) {
        const normalizedPath = normalizePath(itemPath);
        allFiles.add(normalizedPath);
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dir}:`, error.message);
  }
}

/**
 * Create a directory for moving unused files
 */
function createGarbageDir() {
  const garbageDir = './garbage-candidates/unused-files';
  
  if (!fs.existsSync('./garbage-candidates')) {
    fs.mkdirSync('./garbage-candidates', { recursive: true });
  }
  
  if (!fs.existsSync(garbageDir)) {
    fs.mkdirSync(garbageDir, { recursive: true });
  }
  
  return garbageDir;
}

/**
 * Main function
 */
function analyzeProject() {
  console.log('Collecting all files in the project...');
  collectAllFiles('.');
  console.log(`Total ${allFiles.size} files found.`);
  
  // Add files that should always be kept
  ALWAYS_KEEP.forEach(file => {
    const normalizedPath = normalizePath(path.resolve(file));
    console.log(`Adding always-keep file: ${normalizedPath}`);
    filesInUse.add(normalizedPath);
  });
  
  console.log('Tracing dependencies from entry points...');
  ENTRY_POINTS.forEach(entryPoint => {
    if (fs.existsSync(entryPoint)) {
      const resolvedPath = path.resolve(entryPoint);
      console.log(`Starting from entry point: ${resolvedPath}`);
      traverseDependencies(resolvedPath);
    } else {
      console.warn(`Entry point not found: ${entryPoint}`);
    }
  });
  
  console.log('Analysis complete.');
  console.log(`Files in use: ${filesInUse.size}`);
  
  // Calculate unused files
  const unusedFiles = new Set();
  allFiles.forEach(file => {
    if (!filesInUse.has(file)) {
      unusedFiles.add(file);
    }
  });
  
  console.log(`Potential unused files: ${unusedFiles.size}`);
  
  // Generate reports
  generateReports(unusedFiles);
}

/**
 * Generate reports
 * @param {Set<string>} unusedFiles - Set of unused files
 */
function generateReports(unusedFiles) {
  // Create reports directory
  const reportsDir = './garbage-candidates';
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir);
  }
  
  // Get the workspace path for normalization
  const workspacePath = process.cwd().replace(/\\/g, '/') + '/';
  
  // Convert sets to arrays and normalize paths for readability
  const filesInUseArray = Array.from(filesInUse)
    .map(file => file.replace(workspacePath, ''))
    .sort();
  
  const unusedFilesArray = Array.from(unusedFiles)
    .map(file => file.replace(workspacePath, ''))
    .sort();
  
  // Write used files report
  fs.writeFileSync(
    path.join(reportsDir, 'files-in-use.txt'),
    filesInUseArray.join('\n')
  );
  
  // Write unused files report
  fs.writeFileSync(
    path.join(reportsDir, 'unused-files.txt'),
    unusedFilesArray.join('\n')
  );
  
  console.log(`Reports generated in ${reportsDir}`);
  console.log('Files in use: files-in-use.txt');
  console.log('Potentially unused files: unused-files.txt');
  
  // Create a script to help move unused files to a garbage folder
  const moveScriptPath = path.join(reportsDir, 'move-to-garbage.js');
  const garbageFolder = 'garbage-candidates/unused-files';
  
  const moveScript = `
/**
 * Script to move unused files to a garbage folder
 * 
 * This script will move all files listed in unused-files.txt to a garbage folder.
 * Files will maintain their relative paths to avoid name conflicts.
 */
const fs = require('fs');
const path = require('path');

// Create garbage folder
const garbageFolder = '${garbageFolder}';
if (!fs.existsSync(garbageFolder)) {
  fs.mkdirSync(garbageFolder, { recursive: true });
}

// Read the list of unused files
const unusedFiles = fs.readFileSync('./garbage-candidates/unused-files.txt', 'utf8')
  .split('\\n')
  .filter(line => line.trim() !== '');

console.log(\`Moving \${unusedFiles.length} unused files to \${garbageFolder}...\`);

// Move each file
let movedCount = 0;
unusedFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    console.log(\`File not found: \${file}\`);
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
    console.log(\`Moved: \${file} -> \${targetPath}\`);
  } catch (error) {
    console.error(\`Error moving file \${file}: \${error.message}\`);
  }
});

console.log(\`Successfully moved \${movedCount} files to \${garbageFolder}\`);
console.log('To delete these files from their original locations, use delete-unused-files.js');

// Create a deletion script
const deleteScriptPath = './garbage-candidates/delete-unused-files.js';
const deleteScript = \`
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
  .split('\\\\n')
  .filter(line => line.trim() !== '');

console.log(\\\`Deleting \\\${unusedFiles.length} unused files...\\\`);

// Delete each file
let deletedCount = 0;
unusedFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    console.log(\\\`File not found: \\\${file}\\\`);
    return;
  }
  
  try {
    fs.unlinkSync(file);
    deletedCount++;
    console.log(\\\`Deleted: \\\${file}\\\`);
  } catch (error) {
    console.error(\\\`Error deleting file \\\${file}: \\\${error.message}\\\`);
  }
});

console.log(\\\`Successfully deleted \\\${deletedCount} files\\\`);
\`;

fs.writeFileSync(deleteScriptPath, deleteScript);
console.log(\`Created deletion script at \${deleteScriptPath}\`);
`;

  fs.writeFileSync(moveScriptPath, moveScript);
  console.log(`Created a helper script to move unused files: ${moveScriptPath}`);
}

// Run the analysis
analyzeProject(); 