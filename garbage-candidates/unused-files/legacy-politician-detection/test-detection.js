/**
 * Legacy test-detection.js implementation
 * Saved for reference
 */

// Improved politician detection for quoted speech and specific cases
function findPoliticianMentions(text) {
  if (!text) return [];
  
  // Hebrew prefixes that might appear before names
  const prefixes = ['', 'ל', 'מ', 'ב', 'ו', 'ש', 'ה'];
  const wordBoundaries = [' ', '.', ',', ':', ';', '?', '!', '"', "'", '(', ')', '[', ']', '{', '}', '\n', '\t', '"', '"'];
  
  // Normalize quotes in the text to standard quote characters
  const normalizedText = text
    .replace(/[""״]/g, '"')  // Normalize various quote types to standard quotes
    .replace(/['׳']/g, "'"); // Normalize various apostrophe types
  
  console.log(`Normalized text: ${normalizedText}`);
  
  return POLITICIANS.filter(politician => {
    const politicianName = politician.he;
    
    // 1. Direct check - find exact name in text
    for (const prefix of prefixes) {
      const nameWithPrefix = prefix + politicianName;
      
      if (isExactMatch(normalizedText, nameWithPrefix, wordBoundaries)) {
        console.log(`Found via exact match: ${politicianName}`);
        return true;
      }
    }
    
    // 2. Special pattern for quoted speech/statements - handles "X said: "...Y..."" patterns
    // This is particularly useful for titles like "X attacks: "Y's decision...""
    const specialPatterns = [
      // Name inside quotes after a colon (e.g., "X said: "...name..."")
      `:[^"]*"[^"]*\\b${politicianName}\\b[^"]*"`,
      
      // Name after "של" (of) inside quotes (e.g., ""...of name..."")
      `"[^"]*של\\s+${politicianName}[^"]*"`,
      
      // Direct name in quotes (e.g., ""...name..."")
      `"[^"]*\\b${politicianName}\\b[^"]*"`
    ];
    
    for (const pattern of specialPatterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(normalizedText)) {
        console.log(`Found via special pattern: ${politicianName} (pattern: ${pattern})`);
        return true;
      }
    }
    
    // 3. Check for name after a colon (common in news headlines)
    const colonPattern = new RegExp(`:[^:]*\\b${politicianName}\\b`, 'i');
    if (colonPattern.test(normalizedText)) {
      console.log(`Found after colon: ${politicianName}`);
      return true;
    }
    
    // 4. Check for people specifically mentioned in the title as positions
    const positionTerms = {
      'ראש הממשלה': ['בנימין נתניהו'],
      'נשיא המדינה': ['יצחק הרצוג'],
      'שר הביטחון': ['יואב גלנט'],
      'יו"ר האופוזיציה': ['יאיר לפיד'],
      'הנשיא': ['יצחק הרצוג']
    };
    
    for (const [position, politicians] of Object.entries(positionTerms)) {
      if (normalizedText.includes(position) && politicians.includes(politicianName)) {
        console.log(`Found via position term: ${politicianName} (${position})`);
        return true;
      }
    }
    
    // Check aliases with all the same patterns
    if (politician.aliases && politician.aliases.length > 0) {
      for (const alias of politician.aliases) {
        if (alias.length < 3) continue; // Skip very short aliases
        
        // Direct check
        for (const prefix of prefixes) {
          const aliasWithPrefix = prefix + alias;
          
          if (isExactMatch(normalizedText, aliasWithPrefix, wordBoundaries)) {
            console.log(`Found via alias exact match: ${politicianName} (alias: ${alias})`);
            return true;
          }
        }
        
        // Special patterns for aliases
        for (const pattern of specialPatterns.map(p => p.replace(politicianName, alias))) {
          const regex = new RegExp(pattern, 'i');
          if (regex.test(normalizedText)) {
            console.log(`Found via alias special pattern: ${politicianName} (alias: ${alias}, pattern: ${pattern})`);
            return true;
          }
        }
      }
    }
    
    return false;
  }).map(p => p.he);
} 