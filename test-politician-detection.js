/**
 * Test script for politician detection
 */

const fs = require('fs');
const path = require('path');

// Load politicians from JSON file
const POLITICIANS_DATA = fs.readFileSync(path.join(__dirname, 'data/politicians/politicians.json'), 'utf8');
const POLITICIANS_LIST = JSON.parse(POLITICIANS_DATA);

// Format for detection
const POLITICIANS = POLITICIANS_LIST.map(p => {
  return { he: p.name, aliases: p.aliases || [], position: p.position || "" };
});

// --- Implementation of the politician detection ---

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
  
  const detectedPoliticians = new Set();
  
  // 1. Direct name and alias matching
  POLITICIANS.forEach(politician => {
    const politicianName = politician.he;
    let detected = false;
    
    // Check exact name with various Hebrew prefixes
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
    'שר הפנים': 'שר הפנים',
    'השר לביטחון לאומי': 'השר לביטחון לאומי',
    'יושב ראש הכנסת': 'יושב ראש הכנסת',
    'נשיא המדינה': 'נשיא המדינה',
    'הנשיא': 'נשיא המדינה'
  };
  
  // Check if any positions are mentioned in the text
  Object.entries(positionMap).forEach(([positionTerm, standardPosition]) => {
    // Check with prefixes
    for (const prefix of prefixes) {
      const posWithPrefix = prefix + positionTerm;
      
      if (isExactMatch(normalizedText, posWithPrefix, wordBoundaries)) {
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

// --- Test cases ---

console.log("\n--- Testing politician detection ---\n");

const testCases = [
  {
    desc: "Simple direct name match",
    text: "ראש הממשלה בנימין נתניהו הכריז היום על מדיניות חדשה",
    expectPoliticians: ["בנימין נתניהו"]
  },
  {
    desc: "Detection with Hebrew prefix",
    text: "ההודעה הגיעה מבנימין נתניהו",
    expectPoliticians: ["בנימין נתניהו"]
  },
  {
    desc: "Alias detection",
    text: "בתגובה אמר ביבי כי התוכנית תיושם בקרוב",
    expectPoliticians: ["בנימין נתניהו"]
  },
  {
    desc: "Position detection", 
    text: "ראש הממשלה הודיע על פגישה עם שר הביטחון",
    expectPoliticians: ["בנימין נתניהו", "יואב גלנט"]
  },
  {
    desc: "Name with quotes",
    text: 'יו"ר האופוזיציה יאיר לפיד אמר "נתמוך בכל הסכם שיחזיר את החטופים"',
    expectPoliticians: ["יאיר לפיד"]
  },
  {
    desc: "Multiple politicians", 
    text: "שר האוצר בצלאל סמוטריץ' ושר הביטחון יואב גלנט השתתפו בישיבת הממשלה",
    expectPoliticians: ["בצלאל סמוטריץ'", "יואב גלנט"]
  }
];

// Run test cases
testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.desc}`);
  console.log(`Text: "${testCase.text}"`);
  
  const detected = findPoliticianMentions(testCase.text);
  console.log(`Detected politicians: [${detected.join(', ')}]`);
  
  // Check if the detected politicians match the expected ones
  const allFound = testCase.expectPoliticians.every(p => detected.includes(p));
  const noExtra = detected.every(p => testCase.expectPoliticians.includes(p));
  
  if (allFound && noExtra) {
    console.log("✅ Test PASSED");
  } else {
    console.log("❌ Test FAILED");
    console.log(`Expected: [${testCase.expectPoliticians.join(', ')}]`);
  }
  
  console.log('---');
}); 