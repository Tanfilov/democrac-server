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
    'שר החוץ': 'שר החוץ',
    'שר המשפטים': 'שר המשפטים',
    'שרת המשפטים': 'שר המשפטים',
    'שר החינוך': 'שר החינוך',
    'שרת החינוך': 'שר החינוך'
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
          console.log(`Detected former position pattern for "${posWithPrefix}" - skipping current position detection`);
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
    console.log(`Text after position "${position}": "${afterText}"`);
    
    // Case 1: "לשעבר" (former) appears immediately or with punctuation
    if (afterText.trim().startsWith('לשעבר') || 
        afterText.match(/^[ \t,.;:]+לשעבר/) ||
        afterText.match(/^[ \t,.;:]+ה?לשעבר/)) {
      console.log(`Pattern detected: "לשעבר" (former)`);
      return true;
    }
    
    // Case 2: "הקודם" (previous/former) appears after the position
    if (afterText.trim().startsWith('הקודם') || 
        afterText.match(/^[ \t,.;:]+הקודם/)) {
      console.log(`Pattern detected: "הקודם" (previous/former)`);
      return true;
    }
    
    // Case 3: Reference to a specific government or past period
    if (afterText.match(/בממשלת|בממשל/) ||
        afterText.match(/הראשונה|השנייה|השלישית|הרביעית/) ||
        afterText.match(/הקודמת|היוצאת|הזמנית/)) {
      console.log(`Pattern detected: Reference to specific government or past period`);
      return true;
    }
    
    // Case 4: Position "של" (of) someone else, indicating historical reference
    if (afterText.match(/[ \t,.;:]*של[ \t]+[א-ת]/)) {
      console.log(`Pattern detected: Position "של" (of) someone else`);
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

console.log("\n--- Testing advanced position detection patterns ---\n");

// Test Cases for the new patterns
const testCases = [
  {
    name: "Minister in specific government",
    text: "אלי ישראל שר המשפטים בממשלת יאיר לפיד",
    expectedPattern: "Reference to specific government"
  },
  {
    name: "Minister in specific period",
    text: "מירב כהן - שרת המשפטים בממשל החלפים",
    expectedPattern: "Reference to specific government"
  },
  {
    name: "Minister in numbered government",
    text: "לימור לבנת - שרת החינוך בממשלת נתניהו הראשונה",
    expectedPattern: "Reference to specific government or past period"
  },
  {
    name: "Previous minister",
    text: "שר הביטחון הקודם בני גנץ",
    expectedPattern: "הקודם (previous/former)"
  },
  {
    name: "Minister of someone",
    text: "שר האוצר של גולדה מאיר",
    expectedPattern: "Position של (of) someone else"
  }
];

testCases.forEach(testCase => {
  console.log(`\n=== Test: ${testCase.name} ===`);
  console.log(`Text: ${testCase.text}`);
  
  // First test if the isPositionFormer function identifies this correctly
  const positionTerms = [
    'ראש הממשלה', 'רה"מ', 'שר הביטחון', 'שר האוצר', 
    'שר החוץ', 'שר המשפטים', 'שרת המשפטים', 'שר החינוך', 'שרת החינוך'
  ];
  
  let patternDetected = false;
  let positionFound = false;
  
  // Find which position is in the text
  for (const position of positionTerms) {
    if (testCase.text.includes(position)) {
      positionFound = true;
      console.log(`Position term found: "${position}"`);
      
      const isFormer = isPositionFormer(testCase.text, position);
      if (isFormer) {
        patternDetected = true;
        console.log(`Correctly identified as a former position pattern`);
      } else {
        console.log(`NOT identified as a former position pattern`);
      }
      break;
    }
  }
  
  if (!positionFound) {
    console.log(`No position term found in the text`);
  }
  
  // Then run the full detection to see what would be detected
  const detectedPoliticians = findPoliticianMentions(testCase.text);
  console.log(`Detected politicians: ${detectedPoliticians.length > 0 ? detectedPoliticians.join(', ') : 'None'}`);
  
  // Verify that this detection is appropriate
  const shouldDetectCurrentHolder = !patternDetected;
  console.log(`Should detect current position holder? ${shouldDetectCurrentHolder ? 'Yes' : 'No'}`);
  
  console.log(`Test ${patternDetected ? 'PASSED' : 'FAILED'}: ${testCase.expectedPattern}`);
});

// Write results to a file for easier inspection
if (testCases.length > 0) {
  const output = testCases.map(tc => `${tc.name}: ${tc.text}`).join('\n');
  fs.writeFileSync('advanced-patterns-test.txt', output, 'utf8');
  console.log('\nTest cases saved to advanced-patterns-test.txt');
} 