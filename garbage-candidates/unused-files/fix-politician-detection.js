/**
 * Script to fix the politician detection algorithm in the server code
 */

const fs = require('fs');
const path = require('path');

// Path to the index.js file
const indexPath = path.join(__dirname, 'server', 'src', 'index.js');

// Read the file
console.log('Reading server/src/index.js...');
const fileContent = fs.readFileSync(indexPath, 'utf8');

// Find the findPoliticianMentions function
const functionRegex = /\/\/ Find politician mentions in text\s*const findPoliticianMentions\s*=\s*\(\s*text\s*\)\s*=>\s*\{[\s\S]*?\};/;
const oldFunction = fileContent.match(functionRegex)[0];

console.log('Found findPoliticianMentions function:');
console.log(oldFunction);

// Create the new function with a simpler, more reliable approach
const newFunction = `// Find politician mentions in text
const findPoliticianMentions = (text) => {
  if (!text) return [];
  
  // Convert text to lowercase for case-insensitive comparison
  const textLower = text.toLowerCase();
  
  return POLITICIANS.filter(politician => {
    // Check full politician name (case insensitive)
    if (textLower.includes(politician.he.toLowerCase())) {
      return true;
    }
    
    // Check for last name if the politician name has multiple parts
    const nameParts = politician.he.split(' ');
    if (nameParts.length > 1) {
      const lastName = nameParts[nameParts.length - 1];
      if (textLower.includes(lastName.toLowerCase())) {
        return true;
      }
    }
    
    // Check aliases if any
    if (politician.aliases && politician.aliases.length > 0) {
      return politician.aliases.some(alias => 
        textLower.includes(alias.toLowerCase())
      );
    }
    
    return false;
  }).map(p => p.he);
};`;

// Replace the old function with the new one
const updatedContent = fileContent.replace(oldFunction, newFunction);

// Create a backup of the original file
fs.writeFileSync(indexPath + '.bak', fileContent, 'utf8');
console.log('Backup created as server/src/index.js.bak');

// Write the updated content
fs.writeFileSync(indexPath, updatedContent, 'utf8');
console.log('Updated server/src/index.js with the new function');

console.log('\nSummary of changes:');
console.log('1. Replaced regex-based politician name matching with simpler string-based includes() method');
console.log('2. Added last name matching to detect partial mentions of politicians');
console.log('3. Simplified the alias matching logic');
console.log('\nThese changes should make politician detection more reliable and fix issues with the regex matching.'); 