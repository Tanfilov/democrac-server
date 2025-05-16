const fs = require('fs');
const path = require('path');

// Load politicians from JSON file
const politiciansPath = path.join(__dirname, 'data/politicians/politicians.json');
console.log(`Loading politicians from: ${politiciansPath}`);
const POLITICIANS_DATA = fs.readFileSync(politiciansPath, 'utf8');
const POLITICIANS_LIST = JSON.parse(POLITICIANS_DATA);
console.log(`Loaded ${POLITICIANS_LIST.length} politicians`);

// Format for detection (same as in the app)
const POLITICIANS = POLITICIANS_LIST.map(p => {
  return { 
    he: p.name, 
    en: p.name, 
    aliases: p.aliases || [],
    position: p.position || ""
  };
});

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

// Find politician mentions in text (enhanced version with position detection)
function findPoliticianMentions(text) {
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
  
  // 2. Second check: Position-based detection
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
  
  // Test case with position only
  "ראש הממשלה מתכוון לנאום באו\"ם בחודש הבא",
  
  // Additional test case for other positions
  "שר הביטחון הודיע על צעדים חדשים בגבול",
  
  // Test case with position abbreviation
  "רה\"מ הגיע לביקור בארה\"ב"
];

// Run tests
console.log("Testing politician detection with position recognition:");
console.log("---------------------------------------------------------");

testCases.forEach((text, index) => {
  console.log(`\nTest case ${index + 1}: "${text}"`);
  const detected = findPoliticianMentions(text);
  
  console.log(`Detected politicians: ${detected.length > 0 ? detected.join(', ') : 'None'}`);
  
  const netanyahuDetected = detected.includes('בנימין נתניהו');
  console.log(`Netanyahu detection: ${netanyahuDetected ? 'SUCCESS ✓' : 'FAILED ✗'}`);
}); 