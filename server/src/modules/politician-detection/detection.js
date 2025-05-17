/**
 * Politician Detection Logic Module
 * 
 * This module contains the core logic for detecting politicians in text content.
 * It handles various detection strategies including:
 * - Direct name matching
 * - Alias matching
 * - Position-based detection
 * - Context-aware detection
 */

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
    
  return POLITICIANS.filter(politician => {
    const politicianName = politician.name || politician.he; // Support both name structures
    
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
  }).map(p => p.name || p.he);
}

/**
 * Get partial name indicators that wouldn't be detected by the main detection logic
 * @param {string} fullName - The politician's full name
 * @returns {Array} Array of partial name indicators
 */
function getPartialNameIndicators(fullName) {
  const parts = [];
  
  // Split by space to get individual name parts
  const nameParts = fullName.split(' ');
  
  // Add last name if it's not too short
  if (nameParts.length > 1 && nameParts[nameParts.length - 1].length >= 3) {
    parts.push(nameParts[nameParts.length - 1]);
  }
  
  // For specific known cases
  if (fullName === 'יצחק הרצוג') {
    parts.push('הרצוג');
    parts.push('בוז׳י');
    parts.push('בוזי');
    parts.push('בוזי');
  } else if (fullName === 'בנימין נתניהו') {
    parts.push('ביבי');
  } else if (fullName === 'יאיר לפיד') {
    parts.push('לפיד');
  } 
  // Add more specific cases as needed
  
  return parts;
}

/**
 * Check if a word appears as a standalone word in the text
 * @param {string} text - The text to search in
 * @param {string} word - The word to check
 * @returns {boolean} True if it appears as a standalone word
 */
function isStandaloneWord(text, word) {
  const wordBoundaries = [' ', '.', ',', ':', ';', '?', '!', '"', "'", '(', ')', '[', ']', '{', '}', '\n', '\t', '"', '"'];
  const regex = new RegExp(`(^|[${wordBoundaries.join('')}])${escapeRegExp(word)}($|[${wordBoundaries.join('')}])`, 'i');
  return regex.test(text);
}

/**
 * Helper function to escape special regex characters
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Helper function to check if a position is described as former/future/etc in the text
 * @param {string} text - The text to search in
 * @param {string} position - The position text to look for
 * @returns {boolean} True if position is modified in a way that doesn't refer to current holder
 */
function isModifiedPosition(text, position) {
  // Check if position is modified in a way that it doesn't refer to the current holder
  const positionIndex = text.indexOf(position);
  if (positionIndex >= 0) {
    // Get the text before and after the position
    const beforeText = text.substring(Math.max(0, positionIndex - 30), positionIndex);
    const afterText = text.substring(positionIndex + position.length, Math.min(text.length, positionIndex + position.length + 30));
    
    // Check for modifiers that indicate a different context
    
    // 1. Former position modifiers
    const formerModifiers = ['לשעבר', 'הקודם', 'היוצא', 'לקודם', 'הזמני'];
    for (const modifier of formerModifiers) {
      if (afterText.trim().startsWith(modifier) || afterText.match(new RegExp(`^[ \t,.;:]+${modifier}`))) {
        return true;
      }
    }
    
    // 2. Future position modifiers
    const futureModifiers = ['הבא', 'העתידי', 'המיועד', 'יהיה', 'יכהן', 'הנכנס'];
    for (const modifier of futureModifiers) {
      if (afterText.trim().startsWith(modifier) || afterText.match(new RegExp(`^[ \t,.;:]+${modifier}`))) {
        return true;
      }
    }
    
    // 3. Conditional or hypothetical references
    const conditionalModifiers = ['מי ש', 'אילו היה', 'אם יהיה', 'עשוי להיות', 'עלול להיות', 'היה '];
    for (const modifier of conditionalModifiers) {
      if (beforeText.trim().endsWith(modifier) || beforeText.includes(modifier)) {
        return true;
      }
    }
    
    // 4. Reference to a specific government or past period
    if (afterText.match(/בממשלת|בממשל/) ||
        afterText.match(/הראשונה|השנייה|השלישית|הרביעית/) ||
        afterText.match(/הקודמת|היוצאת|הזמנית/)) {
      return true;
    }
    
    // 5. Position "של" (of) someone else, indicating historical reference
    if (afterText.match(/[ \t,.;:]*של[ \t]+[א-ת]/)) {
      return true;
    }
    
    // 6. Position + country/nationality - referring to foreign leaders
    // Check text before and after position for country names or nationalities
    const afterPositionClose = afterText.substring(0, Math.min(30, afterText.length));
    const beforePositionClose = beforeText.substring(Math.max(0, beforeText.length - 30));
    
    const foreignIndicators = [
      'אמריקאי', 'אמריקאית', 'אמריקה', 'ארצות הברית', 'ארה"ב', 'ארהב',
      'בריטי', 'בריטית', 'בריטניה', 'אנגלי', 'אנגליה',
      'צרפתי', 'צרפתית', 'צרפת', 
      'רוסי', 'רוסית', 'רוסיה',
      'גרמני', 'גרמנית', 'גרמניה',
      'סיני', 'סינית', 'סין',
      'הודי', 'הודית', 'הודו',
      'יפני', 'יפנית', 'יפן',
      'קנדי', 'קנדית', 'קנדה',
      'אוסטרלי', 'אוסטרלית', 'אוסטרליה',
      'אירופי', 'אירופית', 'אירופה',
      'ערבי', 'ערבית', 'ערב',
      'איראני', 'איראנית', 'איראן',
      'האיראני', 'האיראנית',
      'לבנוני', 'לבנונית', 'לבנון',
      'סורי', 'סורית', 'סוריה',
      'טורקי', 'טורקית', 'טורקיה',
      'מצרי', 'מצרית', 'מצרים',
      'ירדני', 'ירדנית', 'ירדן',
      'הזר', 'זרה', 'זר'
    ];
    
    // Check both before and after the position
    for (const indicator of foreignIndicators) {
      if (afterPositionClose.includes(indicator) || beforePositionClose.includes(indicator)) {
        return true;
      }
    }
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
  return politician.contextIdentifiers.some(context => textWindow.includes(context));
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
  try {
    // Step 1: Check title and description
    let detectedPoliticians = [];
    let confidenceScores = {};
    let detectionMethods = {};
    
    // Check title - highest confidence
    if (article.title) {
      const titlePoliticians = findPoliticianMentions(article.title, POLITICIANS);
      titlePoliticians.forEach(p => {
        detectedPoliticians.push(p);
        confidenceScores[p] = (confidenceScores[p] || 0) + 3; // Higher weight for title matches
        detectionMethods[p] = [...(detectionMethods[p] || []), 'title'];
      });
    }
    
    // Check description
    if (article.description) {
      const descriptionPoliticians = findPoliticianMentions(article.description, POLITICIANS);
      descriptionPoliticians.forEach(p => {
        if (!detectedPoliticians.includes(p)) detectedPoliticians.push(p);
        confidenceScores[p] = (confidenceScores[p] || 0) + 2; // Medium weight for description matches
        detectionMethods[p] = [...(detectionMethods[p] || []), 'description'];
      });
    }
    
    // Step 2: If we have content already, check it
    if (article.content && article.content.length > 50) {
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
    
    // Extract just the sorted politician names
    const highConfidencePoliticians = politiciansWithScores
      .filter(p => p.score >= 2) // Only keep politicians with at least 2 confidence score
      .map(p => p.name);
      
    // Return all detected politicians if specific high confidence ones aren't found
    return highConfidencePoliticians.length > 0 ? highConfidencePoliticians : detectedPoliticians;
  } catch (error) {
    console.error("Error in enhanced politician detection:", error);
    return [];
  }
}

module.exports = {
  findPoliticianMentions,
  enhancedPoliticianDetection,
  isExactMatch,
  isInsideQuotes,
  hasRequiredContext,
  findAllOccurrences,
  isModifiedPosition
}; 