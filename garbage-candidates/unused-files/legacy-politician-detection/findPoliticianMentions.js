/**
 * Legacy Politician Detection Algorithm
 * Saved for reference from server/src/index.js
 */

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
    
  return POLITICIANS.filter(politician => {
    const politicianName = politician.he;
    
    // 1. Direct check - find exact name in text
    for (const prefix of prefixes) {
      const nameWithPrefix = prefix + politicianName;
      
      if (isExactMatch(normalizedText, nameWithPrefix, wordBoundaries)) {
        return true;
      }
    }
    
    // 2. Special pattern for quoted speech/statements - handles "X said: "...Y..."" patterns
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
        return true;
      }
    }
    
    // 3. Check for name after a colon (common in news headlines)
    const colonPattern = new RegExp(`:[^:]*\\b${politicianName}\\b`, 'i');
    if (colonPattern.test(normalizedText)) {
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
            return true;
          }
        }
        
        // Special patterns for aliases
        for (const pattern of specialPatterns.map(p => p.replace(politicianName, alias))) {
          const regex = new RegExp(pattern, 'i');
          if (regex.test(normalizedText)) {
            return true;
          }
        }
      }
    }
    
    return false;
  }).map(p => p.he);
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

module.exports = {
  findPoliticianMentions,
  isExactMatch,
  isInsideQuotes,
  findAllOccurrences
}; 