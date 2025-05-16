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
    aliases: p.aliases || [],
    requiresContext: p.requiresContext || false,
    contextIdentifiers: p.contextIdentifiers || []
  };
});

// Helper function to check if text contains required context for a politician
function hasRequiredContext(text, politician, nameMatchIndex, nameLength) {
  if (!politician.requiresContext || !politician.contextIdentifiers || politician.contextIdentifiers.length === 0) {
    return true; // No context required
  }
  
  // Define the window size (in characters) to look for context before and after the name
  const windowSize = 200; // Look for context within 200 characters before and after the name
  
  // Get the window of text around the name
  const startWindow = Math.max(0, nameMatchIndex - windowSize);
  const endWindow = Math.min(text.length, nameMatchIndex + nameLength + windowSize);
  
  const textWindow = text.substring(startWindow, endWindow);
  
  // Check if any context identifiers appear in the window
  const foundContext = politician.contextIdentifiers.some(context => {
    const contextFound = textWindow.includes(context);
    if (contextFound) {
      console.log(`Found required context "${context}" near ${politician.he} at position ${nameMatchIndex}`);
    }
    return contextFound;
  });
  
  if (!foundContext) {
    console.log(`No required context found for ${politician.he} - context needed: [${politician.contextIdentifiers.join(', ')}]`);
  }
  
  return foundContext;
}

// Helper functions for politician detection
function findAllOccurrences(text, subtext) {
  const indexes = [];
  let index = text.indexOf(subtext);
  
  while (index !== -1) {
    indexes.push(index);
    index = text.indexOf(subtext, index + 1);
  }
  
  return indexes;
}

function isInsideQuotes(text, startPos, endPos) {
  // Count quotes before position
  let quoteCount = 0;
  for (let i = 0; i < startPos; i++) {
    if (text[i] === '"') quoteCount++;
  }
  
  // If odd number of quotes before, we're inside quotes
  return quoteCount % 2 === 1;
}

function isExactMatch(text, word, boundaries, politician = null) {
  if (!text.includes(word)) return false;
  
  const indexes = findAllOccurrences(text, word);
  
  for (const index of indexes) {
    const beforeChar = index === 0 ? ' ' : text[index - 1];
    const afterChar = index + word.length >= text.length ? ' ' : text[index + word.length];
    
    // Standard boundary check
    const isMatch = (boundaries.includes(beforeChar) || index === 0) && 
                   (boundaries.includes(afterChar) || index + word.length === text.length);
                   
    if (isMatch) {
      // If this politician requires context, check for it around this specific match
      if (politician && politician.requiresContext) {
        if (!hasRequiredContext(text, politician, index, word.length)) {
          continue; // Skip this match as it doesn't have the required context
        }
      }
      
      return true;
    }
    
    // Check if inside quotes - be more lenient with boundary check
    if (isInsideQuotes(text, index, index + word.length)) {
      const isSpaceOrBoundaryBefore = beforeChar === ' ' || boundaries.includes(beforeChar);
      const isSpaceOrBoundaryAfter = afterChar === ' ' || boundaries.includes(afterChar);
      
      if (isSpaceOrBoundaryBefore && isSpaceOrBoundaryAfter) {
        // If this politician requires context, check for it around this specific match
        if (politician && politician.requiresContext) {
          if (!hasRequiredContext(text, politician, index, word.length)) {
            continue; // Skip this match as it doesn't have the required context
          }
        }
        
        return true;
      }
    }
  }
  
  return false;
}

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
  
  // 1. Direct name and alias matching
  POLITICIANS.forEach(politician => {
    const politicianName = politician.he;
    let detected = false;
    
    // Check exact name with various Hebrew prefixes
    for (const prefix of prefixes) {
      const nameWithPrefix = prefix + politicianName;
      
      if (isExactMatch(normalizedText, nameWithPrefix, wordBoundaries, politician)) {
        console.log(`Found politician ${politicianName} via exact match with prefix "${prefix}"`);
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
          
          if (isExactMatch(normalizedText, aliasWithPrefix, wordBoundaries, politician)) {
            console.log(`Found politician ${politicianName} via alias "${alias}" with prefix "${prefix}"`);
            detectedPoliticians.add(politicianName);
            detected = true;
            break;
          }
        }
        
        if (detected) break;
      }
    }
  });
  
  return Array.from(detectedPoliticians);
};

// Test cases for context-based detection
const testCases = [
  {
    name: "אלי כהן with context - Minister of Foreign Affairs",
    text: "שר החוץ אלי כהן דיבר היום על ההחלטה החדשה",
    expectedResult: true
  },
  {
    name: "אלי כהן with context - far away in text",
    text: "הממשלה קיבלה החלטה חדשה. שר החוץ התייחס לנושא. אלי כהן טען כי מדיניות זו תשרת את המדינה.",
    expectedResult: true
  },
  {
    name: "אלי כהן without context - simple mention",
    text: "אלי כהן הגיע לאירוע. רבים באו לברך אותו.",
    expectedResult: false
  },
  {
    name: "אלי כהן with party context",
    text: "חבר הכנסת מטעם הליכוד, אלי כהן, השתתף בישיבה",
    expectedResult: true
  },
  {
    name: "Regular politician without context restrictions",
    text: "בנימין נתניהו נאם היום בכנסת",
    expectedResult: true
  }
];

// Print current ambiguous politicians requiring context
const ambiguousPoliticians = POLITICIANS.filter(p => p.requiresContext);
console.log("\n===== Politicians Requiring Context =====");
ambiguousPoliticians.forEach(p => {
  console.log(`${p.he} - Requires context: ${p.contextIdentifiers.join(', ')}`);
});

// Run the tests
console.log("\n===== Running Context Detection Tests =====\n");

testCases.forEach((testCase, index) => {
  console.log(`\n[Test ${index + 1}] ${testCase.name}`);
  console.log(`Text: "${testCase.text}"`);
  
  const detectedPoliticians = findPoliticianMentions(testCase.text);
  
  console.log(`Detected politicians: ${detectedPoliticians.length > 0 ? detectedPoliticians.join(', ') : 'None'}`);
  
  // For tests with אלי כהן specifically
  if (testCase.text.includes('אלי כהן')) {
    const eliCohenDetected = detectedPoliticians.includes('אלי כהן');
    const testResult = (eliCohenDetected === testCase.expectedResult);
    
    console.log(`Expected אלי כהן detection: ${testCase.expectedResult ? 'Yes' : 'No'}`);
    console.log(`Actual אלי כהן detection: ${eliCohenDetected ? 'Yes' : 'No'}`);
    console.log(`Test ${testResult ? 'PASSED' : 'FAILED'}`);
  } else {
    console.log(`Test completed (not specifically testing אלי כהן)`);
  }
});

// Write results to a file for easier inspection
console.log('\nWriting test results to context-detection-test-results.txt');
fs.writeFileSync('context-detection-test-results.txt', 
  testCases.map(tc => `${tc.name}: ${tc.text}`).join('\n'), 
  'utf8'
);
console.log('All tests completed.'); 