const fs = require('fs');
const path = require('path');

// Load politicians from JSON file
const politiciansPath = path.join(__dirname, '../data/politicians/politicians.json');
console.log(`Loading politicians from: ${politiciansPath}`);
const POLITICIANS_DATA = fs.readFileSync(politiciansPath, 'utf8');
const POLITICIANS_LIST = JSON.parse(POLITICIANS_DATA);
console.log(`Loaded ${POLITICIANS_LIST.length} politicians`);

// Format for detection
const POLITICIANS = POLITICIANS_LIST.map(p => {
  return { 
    he: p.name, 
    en: p.name, 
    position: p.position,
    aliases: p.aliases || [] 
  };
});

// Find politician mentions in text
const findPoliticianMentions = (text) => {
  if (!text) return [];
  
  // Hebrew prefixes that might appear before names
  const prefixes = ['', 'ל', 'מ', 'ב', 'ו', 'ש', 'ה'];
  const wordBoundaries = [' ', '.', ',', ':', ';', '?', '!', '"', "'", '(', ')', '[', ']', '{', '}', '\n', '\t', '"', '"'];
  
  // Normalize quotes in the text to standard quote characters
  const normalizedText = text
    .replace(/[""״]/g, '"')  // Normalize various quote types to standard quotes
    .replace(/['׳']/g, "'"); // Normalize various apostrophe types
    
  console.log(`Analyzing text: "${normalizedText}"`);
  
  const detectedPoliticians = new Set();
  
  // 1. First check: Direct name and alias matching
  POLITICIANS.forEach(politician => {
    const politicianName = politician.he;
    let detected = false;
    
    // Check exact name
    for (const prefix of prefixes) {
      const nameWithPrefix = prefix + politicianName;
      
      if (isExactMatch(normalizedText, nameWithPrefix, wordBoundaries)) {
        console.log(`Found politician ${politicianName} via exact match`);
        detectedPoliticians.add(politicianName);
        detected = true;
        break;
      }
    }
    
    // Check aliases if not detected by name
    if (!detected && politician.aliases && politician.aliases.length > 0) {
      for (const alias of politician.aliases) {
        if (alias.length < 3) continue; // Skip very short aliases
        
        for (const prefix of prefixes) {
          const aliasWithPrefix = prefix + alias;
          
          if (isExactMatch(normalizedText, aliasWithPrefix, wordBoundaries)) {
            console.log(`Found politician ${politicianName} via alias "${alias}"`);
            detectedPoliticians.add(politicianName);
            detected = true;
            break;
          }
        }
        
        if (detected) break;
      }
    }
  });
  
  // 2. Position-based detection
  const positionMap = {
    'ראש הממשלה': 'ראש הממשלה',
    'רה"מ': 'ראש הממשלה',
    'ראש האופוזיציה': 'ראש האופוזיציה',
    'שר הביטחון': 'שר הביטחון',
    'שר האוצר': 'שר האוצר',
    'שר החוץ': 'שר החוץ'
  };
  
  // Check if any positions are mentioned in the text
  Object.entries(positionMap).forEach(([positionTerm, standardPosition]) => {
    // Check with prefixes
    for (const prefix of prefixes) {
      const posWithPrefix = prefix + positionTerm;
      
      if (isExactMatch(normalizedText, posWithPrefix, wordBoundaries)) {
        // Check if this is a former position (contains "לשעבר")
        const isFormerPosition = isPositionFormer(normalizedText, posWithPrefix);
        
        if (isFormerPosition) {
          console.log(`Detected former position: "${posWithPrefix} לשעבר" - skipping current position detection`);
          continue;
        }
        
        // Find politicians with this position
        const politiciansWithPosition = POLITICIANS.filter(p => p.position === standardPosition);
        
        if (politiciansWithPosition.length > 0) {
          const politician = politiciansWithPosition[0]; // Take the first one
          console.log(`Found politician ${politician.he} via position "${standardPosition}"`);
          detectedPoliticians.add(politician.he);
        }
      }
    }
  });
  
  return Array.from(detectedPoliticians);
};

// Helper function to check if a position is described as former in the text
function isPositionFormer(text, position) {
  // Check if "לשעבר" appears after the position
  const positionIndex = text.indexOf(position);
  if (positionIndex >= 0) {
    // Get the text after the position
    const afterText = text.substring(positionIndex + position.length);
    
    // Check if "לשעבר" appears immediately or with some space/punctuation after the position
    if (afterText.trim().startsWith('לשעבר') || 
        afterText.match(/^[ \t,.;:]+לשעבר/) ||
        afterText.match(/^[ \t,.;:]+ה?לשעבר/)) {
      console.log(`Found "לשעבר" after "${position}" - identified as former position`);
      return true;
    }
  }
  return false;
}

// Helper function to check for exact word matches
function isExactMatch(text, word, boundaries) {
  if (!text.includes(word)) return false;
  
  const indexes = findAllOccurrences(text, word);
  
  for (const index of indexes) {
    const beforeChar = index === 0 ? ' ' : text[index - 1];
    const afterChar = index + word.length >= text.length ? ' ' : text[index + word.length];
    
    // Standard boundary check
    if ((boundaries.includes(beforeChar) || index === 0) && 
        (boundaries.includes(afterChar) || index + word.length === text.length)) {
      return true;
    }
    
    // Check if inside quotes - be more lenient with boundary check
    if (isInsideQuotes(text, index, index + word.length)) {
      const isSpaceOrBoundaryBefore = beforeChar === ' ' || boundaries.includes(beforeChar);
      const isSpaceOrBoundaryAfter = afterChar === ' ' || boundaries.includes(afterChar);
      
      if (isSpaceOrBoundaryBefore && isSpaceOrBoundaryAfter) {
        return true;
      }
    }
  }
  
  return false;
}

// Helper to check if a position is inside quotes
function isInsideQuotes(text, startPos, endPos) {
  // Count quotes before position
  let quoteCount = 0;
  for (let i = 0; i < startPos; i++) {
    if (text[i] === '"') quoteCount++;
  }
  
  // If odd number of quotes before, we're inside quotes
  return quoteCount % 2 === 1;
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

// --- Run tests ---

console.log("\n--- Testing position detection with Former Prime Minister ---\n");

// Test Cases
const testCases = [
  {
    name: "Current Prime Minister",
    text: "ראש הממשלה בנימין נתניהו הודיע היום כי...",
    expected: ["בנימין נתניהו"]
  },
  {
    name: "Former Prime Minister",
    text: "ראש הממשלה לשעבר נפתלי בנט אמר בראיון...",
    expected: ["נפתלי בנט"]
  },
  {
    name: "Former Prime Minister with comma",
    text: "ראש הממשלה, לשעבר, נפתלי בנט ביקר את הממשלה",
    expected: ["נפתלי בנט"]
  },
  {
    name: "Current and Former Prime Ministers",
    text: "ראש הממשלה בנימין נתניהו וראש הממשלה לשעבר נפתלי בנט נפגשו",
    expected: ["בנימין נתניהו", "נפתלי בנט"]
  },
  {
    name: "Former Prime Minister with prefix",
    text: "לראש הממשלה לשעבר נפתלי בנט יש ביקורת על המדיניות",
    expected: ["נפתלי בנט"]
  }
];

testCases.forEach(testCase => {
  console.log(`\n=== Test: ${testCase.name} ===`);
  console.log(`Text: ${testCase.text}`);
  
  const detected = findPoliticianMentions(testCase.text);
  console.log(`Detected politicians: ${detected.length > 0 ? detected.join(', ') : 'None'}`);
  
  // Compare with expected (ignoring order)
  const sortedDetected = [...detected].sort();
  const sortedExpected = [...testCase.expected].sort();
  const success = JSON.stringify(sortedDetected) === JSON.stringify(sortedExpected);
  
  console.log(`Test ${success ? 'PASSED' : 'FAILED'}`);
  if (!success) {
    console.log(`Expected: ${sortedExpected.join(', ')}`);
    console.log(`Actual: ${sortedDetected.join(', ')}`);
  }
});

// Run a test specifically for the issue reported
console.log("\n=== Specific Test Case for the Issue ===");
const specificTestCase = "נפתלי בנת, ראש הממשלה לשעבר";
console.log(`Text: ${specificTestCase}`);

const detected = findPoliticianMentions(specificTestCase);
console.log(`Detected politicians: ${detected.length > 0 ? detected.join(', ') : 'None'}`);

console.log("Should not detect Netanyahu because 'ראש הממשלה לשעבר' is a former position");
console.log("Test complete!"); 