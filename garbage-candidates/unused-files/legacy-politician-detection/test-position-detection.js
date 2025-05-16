/**
 * Legacy test-position-detection.js implementation
 * Saved for reference
 */

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