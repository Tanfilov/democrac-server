// Politicians detection module

/**
 * Find politician mentions in text
 * @param {string} text - The text to search for politician mentions
 * @param {Array} POLITICIANS - Array of politician objects with their data
 * @returns {Array} Array of politician names found in the text
 */
function findPoliticianMentions(text, POLITICIANS) {
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
      
      if (isExactMatch(normalizedText, nameWithPrefix, wordBoundaries, politician)) {
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
        // Check if this is a former position (contains "לשעבר")
        const isFormerPosition = isPositionFormer(normalizedText, posWithPrefix);
        
        // Skip detection for former positions
        if (isFormerPosition) {
          continue;
        }
        
        // Only detect current positions
        const politiciansWithPosition = POLITICIANS.filter(p => p.position === standardPosition);
        
        if (politiciansWithPosition.length > 0) {
          const politician = politiciansWithPosition[0]; // Take the first one
          detectedPoliticians.add(politician.he);
        }
      }
    }
  });
  
  return Array.from(detectedPoliticians);
}

/**
 * Helper function to check if a position is described as former in the text
 * @param {string} text - The text to search in
 * @param {string} position - The position text to look for
 * @returns {boolean} True if position is described as former
 */
function isPositionFormer(text, position) {
  // Check if "לשעבר" appears after the position
  const positionIndex = text.indexOf(position);
  if (positionIndex >= 0) {
    // Get the text after the position
    const afterText = text.substring(positionIndex + position.length);
    
    // Case 1: "לשעבר" (former) appears immediately or with punctuation
    if (afterText.trim().startsWith('לשעבר') || 
        afterText.match(/^[ \t,.;:]+לשעבר/) ||
        afterText.match(/^[ \t,.;:]+ה?לשעבר/)) {
      return true;
    }
    
    // Case 2: "הקודם" (previous/former) appears after the position
    if (afterText.trim().startsWith('הקודם') || 
        afterText.match(/^[ \t,.;:]+הקודם/)) {
      return true;
    }
    
    // Case 3: Reference to a specific government or past period
    if (afterText.match(/בממשלת|בממשל/) ||
        afterText.match(/הראשונה|השנייה|השלישית|הרביעית/) ||
        afterText.match(/הקודמת|היוצאת|הזמנית/)) {
      return true;
    }
    
    // Case 4: Position "של" (of) someone else, indicating historical reference
    if (afterText.match(/[ \t,.;:]*של[ \t]+[א-ת]/)) {
      return true;
    }
    
    // Case 5: Position followed by a name that's not the current position holder
    // This is a more complex case that would require checking against current holders
    // For now, we'll handle this through the other patterns
  }
  return false;
}

/**
 * Helper function to check if text contains required context for a politician
 * @param {string} text - The text to search in
 * @param {Object} politician - The politician object with contextIdentifiers
 * @param {number} nameMatchIndex - Index where the politician name was found
 * @param {number} nameLength - Length of the politician name
 * @returns {boolean} True if required context is found or not needed
 */
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

/**
 * Helper function to check for exact word matches
 * @param {string} text - The text to search in
 * @param {string} word - The word to look for
 * @param {Array} boundaries - Array of character boundaries
 * @param {Object} politician - Optional politician object for context checking
 * @returns {boolean} True if exact match is found
 */
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

/**
 * Helper to check if a position is inside quotes
 * @param {string} text - The text to search in
 * @param {number} startPos - Start position
 * @param {number} endPos - End position
 * @returns {boolean} True if the text between positions is inside quotes
 */
function isInsideQuotes(text, startPos, endPos) {
  // Count quotes before position
  let quoteCount = 0;
  for (let i = 0; i < startPos; i++) {
    if (text[i] === '"') quoteCount++;
  }
  
  // If odd number of quotes before, we're inside quotes
  return quoteCount % 2 === 1;
}

/**
 * Helper function to find all occurrences of a substring
 * @param {string} text - The text to search in
 * @param {string} subtext - The substring to find
 * @returns {Array} Array of indexes where the substring was found
 */
function findAllOccurrences(text, subtext) {
  const indexes = [];
  let index = text.indexOf(subtext);
  
  while (index !== -1) {
    indexes.push(index);
    index = text.indexOf(subtext, index + 1);
  }
  
  return indexes;
}

/**
 * Enhanced politician detection using confidence scoring
 * @param {Object} article - Article object with title, description, and content
 * @param {Array} POLITICIANS - Array of politician objects with their data
 * @param {Function} scrapeArticleContent - Function to scrape content if needed
 * @param {Function} updateArticleContent - Function to update article content in DB
 * @returns {Promise<Array>} Promise resolving to array of detected politician names
 */
async function enhancedPoliticianDetection(article, POLITICIANS, scrapeArticleContent, updateArticleContent) {
  console.log(`\n--- Enhanced detection for article ${article.id}: "${article.title}" ---`);
  
  // Step 1: Check title and description
  let detectedPoliticians = [];
  let confidenceScores = {};
  let detectionMethods = {};
  
  // Check title - highest confidence
  if (article.title) {
    console.log(`Checking title: ${article.title}`);
    const titlePoliticians = findPoliticianMentions(article.title, POLITICIANS);
    titlePoliticians.forEach(p => {
      detectedPoliticians.push(p);
      confidenceScores[p] = (confidenceScores[p] || 0) + 3; // Higher weight for title matches
      detectionMethods[p] = [...(detectionMethods[p] || []), 'title'];
    });
  }
  
  // Check description
  if (article.description) {
    console.log(`Checking description: ${article.description.substring(0, 100)}${article.description.length > 100 ? '...' : ''}`);
    const descriptionPoliticians = findPoliticianMentions(article.description, POLITICIANS);
    descriptionPoliticians.forEach(p => {
      if (!detectedPoliticians.includes(p)) detectedPoliticians.push(p);
      confidenceScores[p] = (confidenceScores[p] || 0) + 2; // Medium weight for description matches
      detectionMethods[p] = [...(detectionMethods[p] || []), 'description'];
    });
  }
  
  // Step 2: If we have content already, check it
  if (article.content && article.content.length > 50) {
    console.log(`Checking content (${article.content.length} characters)`);
    const contentPoliticians = findPoliticianMentions(article.content, POLITICIANS);
    contentPoliticians.forEach(p => {
      if (!detectedPoliticians.includes(p)) detectedPoliticians.push(p);
      confidenceScores[p] = (confidenceScores[p] || 0) + 1; // Lower weight for content matches
      detectionMethods[p] = [...(detectionMethods[p] || []), 'content'];
    });
  } 
  // If we don't have sufficient content, scrape it
  else if (article.link && scrapeArticleContent) {
    try {
      console.log(`Scraping content for politician detection from: ${article.link}`);
      const scrapedContent = await scrapeArticleContent(article.link);
      
      if (scrapedContent && scrapedContent.length > 50) {
        // Update the article content in the database
        if (updateArticleContent) {
          await updateArticleContent(article.id, scrapedContent);
        }
        
        // Check for politicians in the scraped content
        const contentPoliticians = findPoliticianMentions(scrapedContent, POLITICIANS);
        contentPoliticians.forEach(p => {
          if (!detectedPoliticians.includes(p)) detectedPoliticians.push(p);
          confidenceScores[p] = (confidenceScores[p] || 0) + 1; // Lower weight for content matches
          detectionMethods[p] = [...(detectionMethods[p] || []), 'scraped_content'];
        });
      }
    } catch (error) {
      console.error(`Error scraping content for article ${article.id}:`, error);
    }
  }
  
  // Step 3: Sort politicians by confidence score and filter out low confidence mentions
  const politiciansWithScores = detectedPoliticians.map(name => ({
    name,
    score: confidenceScores[name] || 0,
    methods: detectionMethods[name] || []
  })).sort((a, b) => b.score - a.score);
  
  // Identify special and foreign politicians that might need special handling
  const specialPoliticians = [
    'דונלד טראמפ', 
    'ג\'ו ביידן', 
    'קמאלה האריס',
    'עמנואל מקרון'
  ];
  
  // Filter results based on confidence score with special rules for certain politicians
  const highConfidencePoliticians = politiciansWithScores
    .filter(p => {
      // For special politicians like Trump, use a lower threshold
      if (specialPoliticians.includes(p.name)) {
        return p.score >= 1;
      }
      // For regular politicians, use normal threshold
      return p.score >= 2;
    })
    .map(p => p.name);
  
  console.log('Politician detection results:', 
    politiciansWithScores.map(p => `${p.name} (confidence: ${p.score}, methods: ${p.methods.join(',')})`).join(', ')
  );
  console.log('High confidence politicians:', highConfidencePoliticians.join(', '));
  
  return highConfidencePoliticians;
}

module.exports = {
  findPoliticianMentions,
  enhancedPoliticianDetection,
  isPositionFormer,
  hasRequiredContext,
  isExactMatch,
  findAllOccurrences,
  isInsideQuotes
}; 