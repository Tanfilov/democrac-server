const fs = require('fs');
const path = require('path');

// Load politicians from JSON file
const politiciansPath = path.join(__dirname, 'data/politicians/politicians.json');
console.log(`Loading politicians from: ${politiciansPath}`);
const POLITICIANS_DATA = fs.readFileSync(politiciansPath, 'utf8');
console.log(`File contents length: ${POLITICIANS_DATA.length} characters`);
const POLITICIANS_LIST = JSON.parse(POLITICIANS_DATA);
console.log(`Loaded ${POLITICIANS_LIST.length} politicians`);

// Print first politician data to verify content
const firstPolitician = POLITICIANS_LIST[0];
console.log(`First politician data:`, JSON.stringify(firstPolitician, null, 2));

// Manually add aliases to Netanyahu for testing since the file doesn't have them
const netanyahuIndex = POLITICIANS_LIST.findIndex(p => p.name === 'בנימין נתניהו');
if (netanyahuIndex >= 0) {
  console.log('Manually adding aliases to Netanyahu for testing purposes');
  POLITICIANS_LIST[netanyahuIndex].aliases = ['נתניהו', 'ביבי'];
  console.log(`Updated Netanyahu entry:`, JSON.stringify(POLITICIANS_LIST[netanyahuIndex], null, 2));
}

// Format for detection (same as in the app)
const POLITICIANS = POLITICIANS_LIST.map(p => {
  return { he: p.name, en: p.name, aliases: p.aliases || [] };
});

// Helper function to check for exact word matches
function isExactMatch(text, word, boundaries) {
  if (!text.includes(word)) {
    // console.log(`Text does not include "${word}"`);
    return false;
  }
  
  const indexes = findAllOccurrences(text, word);
  console.log(`Found "${word}" at positions: ${indexes.join(', ')}`);
  
  for (const index of indexes) {
    const beforeChar = index === 0 ? ' ' : text[index - 1];
    const afterChar = index + word.length >= text.length ? ' ' : text[index + word.length];
    
    console.log(`  Before char: "${beforeChar}", After char: "${afterChar}"`);
    
    // Standard boundary check
    if ((boundaries.includes(beforeChar) || index === 0) && 
        (boundaries.includes(afterChar) || index + word.length === text.length)) {
      console.log(`  ✓ Boundary check passed`);
      return true;
    }
    
    console.log(`  ✗ Boundary check failed`);
  }
  
  return false;
}

// Helper function to find all occurrences of a substring
function findAllOccurrences(text, subtext) {
  const indexes = [];
  let index = text.indexOf(subtext);
  
  while (index !== -1) {
    indexes.push(index);
    index = text.indexOf(subtext, index + 1);
  }
  
  return indexes;
}

// Find politician mentions in text (simplified version of the app's function)
function findPoliticianMentions(text) {
  if (!text) return [];
  
  // Hebrew prefixes that might appear before names
  const prefixes = ['', 'ל', 'מ', 'ב', 'ו', 'ש', 'ה'];
  const wordBoundaries = [' ', '.', ',', ':', ';', '?', '!', '"', "'", '(', ')', '[', ']', '{', '}', '\n', '\t', '"', '"'];
  
  // Normalize quotes in the text to standard quote characters
  const normalizedText = text
    .replace(/[""״]/g, '"')  // Normalize various quote types to standard quotes
    .replace(/['׳']/g, "'"); // Normalize various apostrophe types
  
  console.log(`Normalized text: "${normalizedText}"`);
  
  // Find Netanyahu specifically for debugging
  const netanyahuEntry = POLITICIANS.find(p => p.he === 'בנימין נתניהו');
  if (netanyahuEntry) {
    console.log(`Checking Netanyahu with aliases: ${JSON.stringify(netanyahuEntry.aliases)}`);
  }
    
  return POLITICIANS.filter(politician => {
    const politicianName = politician.he;
    
    if (politician.he === 'בנימין נתניהו') {
      console.log(`Checking for Netanyahu...`);
    }
    
    // 1. Direct check - find exact name in text
    for (const prefix of prefixes) {
      const nameWithPrefix = prefix + politicianName;
      
      if (politician.he === 'בנימין נתניהו') {
        console.log(`Checking for "${nameWithPrefix}"`);
      }
      
      if (isExactMatch(normalizedText, nameWithPrefix, wordBoundaries)) {
        console.log(`Found politician ${politicianName} via exact match`);
        return true;
      }
    }
    
    // Check aliases with the same patterns
    if (politician.aliases && politician.aliases.length > 0) {
      for (const alias of politician.aliases) {
        if (alias.length < 3) continue; // Skip very short aliases
        
        for (const prefix of prefixes) {
          const aliasWithPrefix = prefix + alias;
          
          if (politician.he === 'בנימין נתניהו') {
            console.log(`Checking for alias "${aliasWithPrefix}"`);
          }
          
          if (isExactMatch(normalizedText, aliasWithPrefix, wordBoundaries)) {
            console.log(`Found politician ${politicianName} via alias "${alias}"`);
            return true;
          }
        }
      }
    }
    
    return false;
  }).map(p => p.he);
}

// Test cases that previously had issues
const testCases = [
  // Test case from our Excel analysis (with partial name)
  "נתניהו שוחח עם עידן אלכסנדר, והודה לויטקוף: \"מוקירים את הסיוע\"",
  
  // Test case with full name
  "ראש הממשלה בנימין נתניהו הודיע על תכנית חדשה",
  
  // Test case with nickname
  "ביבי מתכוון להגיע לארה\"ב בחודש הבא",
  
  // Test case with partial name in quotes
  "איזנקוט תוקף: \"ההתעקשות של נתניהו על עסקה חלקית היא שגיאה קשה\"",
  
  // Test case with position
  "ראש הממשלה מתכוון לנאום באו\"ם בחודש הבא"
];

// Run tests
console.log("Testing Netanyahu detection with different name variations:");
console.log("---------------------------------------------------------");

testCases.forEach((text, index) => {
  console.log(`\nTest case ${index + 1}: "${text}"`);
  const detected = findPoliticianMentions(text);
  
  console.log(`Detected politicians: ${detected.length > 0 ? detected.join(', ') : 'None'}`);
  
  const netanyahuDetected = detected.includes('בנימין נתניהו');
  console.log(`Netanyahu detection: ${netanyahuDetected ? 'SUCCESS ✓' : 'FAILED ✗'}`);
});

console.log("\nSummary of Netanyahu's entry in politicians.json:");
const netanyahuEntry = POLITICIANS_LIST.find(p => p.name === 'בנימין נתניהו');
console.log(`- Name: ${netanyahuEntry.name}`);
console.log(`- Aliases: ${JSON.stringify(netanyahuEntry.aliases)}`); 