/**
 * Core detection logic for finding mentions of politicians in text
 * This is an enhanced version of the detection algorithm with
 * improved context handling and position-based detection
 */

/**
 * Normalize text for consistent detection
 * @param {string} text - The text to normalize
 * @returns {string} Normalized text
 */
function normalizeText(text) {
  if (!text) return '';
  
  // Normalize quotation marks
  let normalized = text;
  normalized = normalized.replace(/[""״]/g, '"');
  normalized = normalized.replace(/[׳']/g, "'");
  
  // Normalize dashes and hyphens
  normalized = normalized.replace(/[\u2013\u2014\u2015]/g, '-');
  
  // Normalize Hebrew characters (e.g., final forms)
  normalized = normalized.replace(/\u05da/g, 'ך'); // Final Kaf
  normalized = normalized.replace(/\u05dd/g, 'ם'); // Final Mem
  normalized = normalized.replace(/\u05df/g, 'ן'); // Final Nun
  normalized = normalized.replace(/\u05e3/g, 'ף'); // Final Pe
  normalized = normalized.replace(/\u05e5/g, 'ץ'); // Final Tsadi
  
  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

/**
 * Escape special regex characters in a string
 * @param {string} string - String to escape
 * @returns {string} - Escaped string
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if a word is a standalone word in the text
 * @param {string} text - The text to search in
 * @param {string} word - The word to check
 * @returns {boolean} Whether the word appears as a standalone word
 */
function isStandaloneWord(text, word) {
  if (!text || !word) return false;
  const escapedWord = escapeRegExp(word);
  const regex = new RegExp(`\\b${escapedWord}\\b`, 'i');
  return regex.test(text);
}

/**
 * Find all occurrences of a substring in text
 * @param {string} text - Text to search in
 * @param {string} subtext - Substring to find
 * @returns {number[]} Array of starting positions
 */
function findAllOccurrences(text, subtext) {
  if (!text || !subtext) return [];
  
  const positions = [];
  let pos = text.indexOf(subtext);
  
  while (pos !== -1) {
    positions.push(pos);
    pos = text.indexOf(subtext, pos + 1);
  }
  
  return positions;
}

/**
 * Check if a position in text is inside quotation marks
 * @param {string} text - The full text
 * @param {number} startPos - Start position
 * @param {number} endPos - End position
 * @returns {boolean} Whether the position is inside quotes
 */
function isInsideQuotes(text, startPos, endPos) {
  if (!text) return false;
  
  // Count quote marks before the position
  const textBeforeMatch = text.substring(0, startPos);
  const quoteCount = (textBeforeMatch.match(/"/g) || []).length;
  
  // If odd number of quotes, we're inside quotes
  return quoteCount % 2 === 1;
}

/**
 * Get partial name indicators for a politician's full name
 * @param {string} fullName - Full name of the politician
 * @returns {string[]} Array of partial name indicators
 */
function getPartialNameIndicators(fullName) {
  if (!fullName) return [];
  
  const indicators = [];
  
  // Extract last name if at least 3 characters
  const nameParts = fullName.split(' ');
  if (nameParts.length > 1) {
    const lastName = nameParts[nameParts.length - 1];
    if (lastName && lastName.length >= 3) {
      indicators.push(lastName);
    }
  }
  
  // Special case hardcoded nicknames
  const nicknameMap = {
    'בנימין נתניהו': ['ביבי', 'נתניהו'],
    'יאיר לפיד': ['לפיד'],
    'יצחק הרצוג': ['בוז\'י', 'הרצוג'],
    'בני גנץ': ['גנץ'],
    'אביגדור ליברמן': ['ליברמן'],
    'אריה דרעי': ['דרעי'],
    'נפתלי בנט': ['בנט'],
    'גדעון סער': ['סער'],
    'איילת שקד': ['שקד'],
    'משה כחלון': ['כחלון'],
    'אורלי לוי-אבקסיס': ['אורלי', 'לוי'],
    'אבי גבאי': ['גבאי'],
    'זהבה גלאון': ['גלאון'],
    'בצלאל סמוטריץ\'': ['סמוטריץ\'', 'סמוטריץ'],
    'איתמר בן גביר': ['בן גביר'],
    'מרב מיכאלי': ['מיכאלי'],
    'מנסור עבאס': ['עבאס']
  };
  
  if (fullName in nicknameMap) {
    indicators.push(...nicknameMap[fullName]);
  }
  
  return indicators;
}

/**
 * Check if the required context identifiers are present
 * @param {string} text - The text to search in
 * @param {Object} politician - The politician object
 * @param {number} nameMatchIndex - The index where the name was found
 * @param {number} nameLength - The length of the matched name
 * @returns {boolean} Whether the context requirements are satisfied
 */
function hasRequiredContext(text, politician, nameMatchIndex, nameLength) {
  // If politician doesn't require context, return true immediately
  if (!politician.requiresContext) return true;
  
  // If politician requires context but has no context identifiers, warn and return true
  if (!politician.contextIdentifiers || !Array.isArray(politician.contextIdentifiers) || politician.contextIdentifiers.length === 0) {
    console.warn(`Politician ${politician.name} requires context but has no contextIdentifiers defined`);
    return true;
  }
  
  // Define window size for context search
  const windowSize = 200;
  
  // Get text window around the match
  const startWindowPos = Math.max(0, nameMatchIndex - windowSize);
  const endWindowPos = Math.min(text.length, nameMatchIndex + nameLength + windowSize);
  const textWindow = text.substring(startWindowPos, endWindowPos);
  
  // Check if any context identifier is in the window
  const contextFound = politician.contextIdentifiers.some(identifier => {
    if (!identifier) return false;
    return textWindow.toLowerCase().includes(identifier.toLowerCase());
  });
  
  if (contextFound) {
    console.log(`Context found for ${politician.name}`);
  } else {
    console.log(`No required context found for ${politician.name}`);
  }
  
  return contextFound;
}

/**
 * Check if a position mention is modified (former, future, foreign, etc.)
 * @param {string} text - The full text
 * @param {string} position - The position string found
 * @param {number} posIndex - The position's start index in text
 * @returns {boolean} Whether the position is modified
 */
function isModifiedPosition(text, position, posIndex = -1) {
  if (!text || !position) return false;
  
  if (posIndex === -1) {
    posIndex = text.indexOf(position);
    if (posIndex === -1) return false;
  }
  
  const windowSize = 30;
  const startWindowPos = Math.max(0, posIndex - windowSize);
  const endWindowPos = Math.min(text.length, posIndex + position.length + windowSize);
  const textWindow = text.substring(startWindowPos, endWindowPos);
  
  // Former modifiers
  const formerModifiers = [
    'לשעבר', 'הקודם', 'היוצא', 'לקודם', 'הזמני',
    'דאז', 'שכיהן', 'שהיה'
  ];
  for (const modifier of formerModifiers) {
    if (textWindow.includes(position + ' ' + modifier) || 
        textWindow.includes(position + ' ה' + modifier)) {
      return true;
    }
  }
  
  // Future modifiers
  const futureModifiers = [
    'הבא', 'העתידי', 'המיועד', 'יהיה', 'יכהן', 'הנכנס',
    'עתידי', 'עתיד', 'עתידית', 'מועמד'
  ];
  for (const modifier of futureModifiers) {
    if (textWindow.includes(position + ' ' + modifier) || 
        textWindow.includes(position + ' ה' + modifier)) {
      return true;
    }
  }
  
  // Conditional/hypothetical before position
  const conditionalPhrases = [
    'מי ש', 'אילו היה', 'אם יהיה', 'עשוי להיות', 'עלול להיות', 'היה '
  ];
  const textBeforePos = text.substring(Math.max(0, posIndex - 20), posIndex);
  for (const phrase of conditionalPhrases) {
    if (textBeforePos.includes(phrase)) {
      return true;
    }
  }
  
  // Specific government/past period
  const periodModifiers = ['בממשלת', 'הראשונה', 'הקודמת', 'בתקופת'];
  for (const modifier of periodModifiers) {
    if (textWindow.includes(position + ' ' + modifier)) {
      return true;
    }
  }
  
  // Position "of" someone else
  const selPattern = position + ' של ';
  if (textWindow.includes(selPattern)) {
    return true;
  }
  
  // Foreign country indicators
  const foreignIndicators = [
    'אמריקאי', 'צרפת', 'רוסיה', 'סיני', 'בריטי', 'גרמני', 'טורקי',
    'בריטניה', 'צרפתי', 'רוסי', 'סין', 'ארה"ב', 'ארצות הברית', 'אירופה',
    'אירופי', 'איראן', 'איראני', 'מצרי', 'מצרים', 'ירדני', 'ירדן'
  ];
  for (const indicator of foreignIndicators) {
    if (textWindow.includes(indicator)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a string contains a politician's name or alias as an exact match
 * @param {string} text - The text to search in
 * @param {string} word - The name or alias to look for
 * @param {Array} boundaries - Array of word boundary characters
 * @param {Object} politician - The politician object being checked
 * @returns {boolean} - Whether the name or alias is found
 */
function isExactMatch(text, word, boundaries, politician = null) {
  if (!text || !word) return false;
  
  const occurrences = findAllOccurrences(text.toLowerCase(), word.toLowerCase());
  if (occurrences.length === 0) return false;
  
  for (const index of occurrences) {
    // Check word boundaries
    const beforeChar = index === 0 ? '' : text[index - 1];
    const afterChar = index + word.length >= text.length ? '' : text[index + word.length];
    
    const isValidBoundaryBefore = index === 0 || boundaries.includes(beforeChar);
    const isValidBoundaryAfter = index + word.length >= text.length || boundaries.includes(afterChar);
    
    // Check if inside quotes - more lenient boundary checking
    const isQuoted = isInsideQuotes(text, index, index + word.length);
    
    if ((isValidBoundaryBefore && isValidBoundaryAfter) || isQuoted) {
      // If politician requires context, check if context is present
      if (politician && politician.requiresContext) {
        if (!hasRequiredContext(text, politician, index, word.length)) {
          continue; // Skip this occurrence if required context is missing
        }
      }
      
      return true;
    }
  }
  
  return false;
}

/**
 * Find mentions of politicians in a text
 * @param {string} text - The text to search in
 * @param {Array} POLITICIANS - Array of politician objects
 * @returns {Array} - Array of detected politician names
 */
function findPoliticianMentions(text, POLITICIANS) {
  if (!text || !POLITICIANS || POLITICIANS.length === 0) return [];
  
  // Normalize the text
  const normalizedText = normalizeText(text);
  
  // Set of detected politicians (for uniqueness)
  const detectedPoliticians = new Set();
  
  // Define Hebrew prefixes and word boundaries
  const hebrewPrefixes = ['', 'ל', 'מ', 'ב', 'ו', 'ש', 'ה', 'כ'];
  const wordBoundaries = [' ', '.', ',', ':', ';', '?', '!', '"', "'", '(', ')', '[', ']', '{', '}', '\n', '\t'];
  
  // A. Direct name and alias matching
  for (const politician of POLITICIANS) {
    // Skip politicians without a name
    if (!politician.name) continue;
    
    // Check for exact name match with different prefixes
    for (const prefix of hebrewPrefixes) {
      const nameWithPrefix = prefix + politician.name;
      if (isExactMatch(normalizedText, nameWithPrefix, wordBoundaries, politician)) {
        detectedPoliticians.add(politician.name);
        break;
      }
    }
    
    // If not found by name, check aliases
    if (!detectedPoliticians.has(politician.name) && 
        politician.aliases && 
        Array.isArray(politician.aliases)) {
      
      for (const alias of politician.aliases) {
        // Skip short aliases
        if (!alias || alias.length < 3) continue;
        
        for (const prefix of hebrewPrefixes) {
          const aliasWithPrefix = prefix + alias;
          if (isExactMatch(normalizedText, aliasWithPrefix, wordBoundaries, politician)) {
            detectedPoliticians.add(politician.name);
            break;
          }
        }
        
        if (detectedPoliticians.has(politician.name)) break;
      }
    }
  }
  
  // B. Position-based detection
  const positionMap = {
    'ראש הממשלה': 'ראש הממשלה',
    'רה"מ': 'ראש הממשלה',
    'ראש ממשלת ישראל': 'ראש הממשלה',
    'שר החוץ': 'שר החוץ',
    'שר הביטחון': 'שר הביטחון',
    'שר האוצר': 'שר האוצר',
    'נשיא המדינה': 'נשיא המדינה',
    'הנשיא': 'נשיא המדינה',
    'שר המשפטים': 'שר המשפטים',
    'ראש האופוזיציה': 'ראש האופוזיציה',
    'יו"ר הכנסת': 'יו"ר הכנסת',
    'יושב ראש הכנסת': 'יו"ר הכנסת',
    'שר הבריאות': 'שר הבריאות',
    'שר החינוך': 'שר החינוך',
    'שר התחבורה': 'שר התחבורה',
    'שר הפנים': 'שר הפנים',
    'שר השיכון': 'שר השיכון',
    'שר הבינוי והשיכון': 'שר השיכון'
  };
  
  // Check for position mentions
  for (const [positionTerm, standardPosition] of Object.entries(positionMap)) {
    for (const prefix of hebrewPrefixes) {
      const posWithPrefix = prefix + positionTerm;
      
      if (isExactMatch(normalizedText, posWithPrefix, wordBoundaries)) {
        // Check if this position is modified (former, future, foreign)
        const posIndex = normalizedText.toLowerCase().indexOf(posWithPrefix.toLowerCase());
        if (isModifiedPosition(normalizedText, posWithPrefix, posIndex)) {
          continue; // Skip if it's not current position holder
        }
        
        // Find politicians matching this position
        const matchingPoliticians = POLITICIANS.filter(p => 
          p.position && 
          (p.position === standardPosition || p.position.includes(standardPosition)));
        
        if (matchingPoliticians.length > 0) {
          // Take first matching politician
          const politician = matchingPoliticians[0];
          
          // Check if there are partial name indicators of this politician near the position
          const nameParts = getPartialNameIndicators(politician.name);
          
          // Define window around the position to check for name parts
          const windowSize = 200;
          const startWindowPos = Math.max(0, posIndex - windowSize);
          const endWindowPos = Math.min(normalizedText.length, posIndex + posWithPrefix.length + windowSize);
          const positionWindow = normalizedText.substring(startWindowPos, endWindowPos);
          
          // Check if any name part appears in this window
          const foundPart = nameParts.some(part => 
            isStandaloneWord(positionWindow, part));
          
          if (foundPart) {
            detectedPoliticians.add(politician.name);
          }
        }
      }
    }
  }
  
  return Array.from(detectedPoliticians);
}

/**
 * Enhanced detection that handles article content scraping and special patterns
 * @param {Object} article - Article object with id, title, description, content, and link
 * @param {Array} POLITICIANS - Array of politician objects
 * @param {Function} scrapeArticleContent - Function to scrape article content
 * @param {Function} updateArticleContent - Function to update article content in DB
 * @returns {Array} - Array of detected politician names
 */
async function enhancedPoliticianDetection(article, POLITICIANS, scrapeArticleContent, updateArticleContent) {
  try {
    if (!article) {
      console.error('Invalid article object provided to enhancedPoliticianDetection');
      return [];
    }
    
    // Set of all detected politicians
    const detectedPoliticiansOverall = new Set();
    
    // Objects to track detection details
    const politicianScores = {};
    const detectionMethods = {};
    const firstOccurrenceIndex = {};
    const isEarlyInContent = {};
    const isNearQuotes = {};
    
    // Check title for politicians
    if (article.title) {
      const titleDetected = findPoliticianMentions(article.title, POLITICIANS);
      for (const name of titleDetected) {
        detectedPoliticiansOverall.add(name);
        detectionMethods[name] = detectionMethods[name] || [];
        detectionMethods[name].push('title');
      }
    }
    
    // Check description for politicians
    if (article.description) {
      const descriptionDetected = findPoliticianMentions(article.description, POLITICIANS);
      for (const name of descriptionDetected) {
        detectedPoliticiansOverall.add(name);
        detectionMethods[name] = detectionMethods[name] || [];
        detectionMethods[name].push('description');
      }
    }
    
    // Check content (or scrape it if needed)
    let content = article.content;
    
    if (!content || content.length < 50) {
      // Try to scrape content if a link and scrape function are available
      if (article.link && typeof scrapeArticleContent === 'function') {
        console.log(`Article ${article.id} has insufficient content, attempting to scrape from ${article.link}`);
        
        const scrapedContent = await scrapeArticleContent(article.link);
        
        if (scrapedContent && scrapedContent.length > 50) {
          console.log(`Successfully scraped content for article ${article.id} (${scrapedContent.length} chars)`);
          content = scrapedContent;
          
          // Update the database if a callback is provided
          if (typeof updateArticleContent === 'function') {
            await updateArticleContent(article.id, scrapedContent);
          }
        } else {
          console.warn(`Failed to scrape sufficient content for article ${article.id}`);
        }
      }
    }
    
    // Analyze content if available
    if (content && content.length > 50) {
      // Normalize content for analysis
      const normalizedContent = normalizeText(content);
      
      // Detect politicians in content
      const contentDetected = findPoliticianMentions(content, POLITICIANS);
      
      for (const name of contentDetected) {
        detectedPoliticiansOverall.add(name);
        
        // Record content as a detection method
        detectionMethods[name] = detectionMethods[name] || [];
        detectionMethods[name].push('content');
        
        // Find all occurrences and count
        const occurrences = findAllOccurrences(content.toLowerCase(), name.toLowerCase());
        politicianScores[name] = (politicianScores[name] || 0) + occurrences.length;
        
        // Check if first occurrence is early
        if (occurrences.length > 0) {
          firstOccurrenceIndex[name] = occurrences[0];
          isEarlyInContent[name] = occurrences[0] < 500; // First 500 chars considered "early"
        }
        
        // Check if any mention is near quote marks
        isNearQuotes[name] = false;
        const quotePositions = findAllOccurrences(content, '"');
        
        for (const pos of occurrences) {
          for (const quotePos of quotePositions) {
            // If name is within 100 chars of a quote, mark as near quotes
            if (Math.abs(pos - quotePos) < 100) {
              isNearQuotes[name] = true;
              break;
            }
          }
          if (isNearQuotes[name]) break;
        }
      }
      
      // Special pattern detection in content for each politician
      for (const politician of POLITICIANS) {
        if (!politician.name) continue;
        if (detectedPoliticiansOverall.has(politician.name)) continue; // Already detected
        
        // Check various name forms
        const nameVariations = [politician.name, ...(politician.aliases || [])];
        
        for (const nameToMatch of nameVariations) {
          if (!nameToMatch || nameToMatch.length < 3) continue;
          
          const escapedName = escapeRegExp(nameToMatch);
          
          // Quoted speech/statements patterns
          const specialPatterns = [
            `:[^"]*"[^"]*\\b${escapedName}\\b[^"]*"`, // Name inside quotes after colon
            `"[^"]*של\\s+${escapedName}[^"]*"`,      // Name after "of" inside quotes
            `"[^"]*\\b${escapedName}\\b[^"]*"`       // Direct name in quotes
          ];
          
          for (const pattern of specialPatterns) {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(normalizedContent)) {
              // If politician requires context, check it
              if (politician.requiresContext) {
                // Get match position
                const match = normalizedContent.match(regex);
                if (match && match.index) {
                  if (hasRequiredContext(normalizedContent, politician, match.index, match[0].length)) {
                    detectedPoliticiansOverall.add(politician.name);
                    detectionMethods[politician.name] = detectionMethods[politician.name] || [];
                    detectionMethods[politician.name].push('special_pattern');
                    break;
                  }
                }
              } else {
                detectedPoliticiansOverall.add(politician.name);
                detectionMethods[politician.name] = detectionMethods[politician.name] || [];
                detectionMethods[politician.name].push('special_pattern');
                break;
              }
            }
          }
          
          if (detectedPoliticiansOverall.has(politician.name)) break;
          
          // Name after colon (often in headlines within content)
          const colonPattern = `:[^:]*\\b${escapedName}\\b`;
          const colonRegex = new RegExp(colonPattern, 'i');
          
          if (colonRegex.test(normalizedContent)) {
            // If politician requires context, check it
            if (politician.requiresContext) {
              // Get match position
              const match = normalizedContent.match(colonRegex);
              if (match && match.index) {
                if (hasRequiredContext(normalizedContent, politician, match.index, match[0].length)) {
                  detectedPoliticiansOverall.add(politician.name);
                  detectionMethods[politician.name] = detectionMethods[politician.name] || [];
                  detectionMethods[politician.name].push('colon_pattern');
                  break;
                }
              }
            } else {
              detectedPoliticiansOverall.add(politician.name);
              detectionMethods[politician.name] = detectionMethods[politician.name] || [];
              detectionMethods[politician.name].push('colon_pattern');
              break;
            }
          }
        }
      }
    }
    
    // Calculate relevance scores for each detected politician
    const politiciansWithScores = Array.from(detectedPoliticiansOverall).map(name => {
      let score = 0;
      
      // Title mentions are high value
      if (detectionMethods[name]?.includes('title')) {
        score += 3;
      }
      
      // Description mentions
      if (detectionMethods[name]?.includes('description')) {
        score += 2;
      }
      
      // Content mentions
      if (detectionMethods[name]?.includes('content')) {
        score += 1;
        
        // Extra points based on content occurrence details
        if (isEarlyInContent[name]) score += 1;
        if (isNearQuotes[name]) score += 1;
      }
      
      // Special pattern detection
      if (detectionMethods[name]?.includes('special_pattern')) {
        score += 2;
      }
      
      // Colon pattern
      if (detectionMethods[name]?.includes('colon_pattern')) {
        score += 1.5;
      }
      
      return { name, score };
    });
    
    // Filter based on confidence score
    const confidenceThreshold = 2;
    const lowerThresholdPoliticians = ['דונלד טראמפ', 'ג\'ו ביידן']; // Special/foreign politicians
    
    const highConfidencePoliticians = politiciansWithScores.filter(p => {
      if (lowerThresholdPoliticians.includes(p.name)) {
        return p.score >= 1; // Lower threshold for special cases
      }
      return p.score >= confidenceThreshold;
    }).map(p => p.name);
    
    return highConfidencePoliticians;
  } catch (error) {
    console.error('Error in enhancedPoliticianDetection:', error);
    return [];
  }
}

module.exports = {
  findPoliticianMentions,
  enhancedPoliticianDetection,
  isExactMatch,
  hasRequiredContext,
  isModifiedPosition,
  normalizeText,
  getPartialNameIndicators,
  isStandaloneWord,
  findAllOccurrences,
  isInsideQuotes,
  escapeRegExp
}; 