/**
 * Politician Relevance Scoring Module
 * 
 * This module implements a relevance scoring system for politicians mentioned in articles,
 * to help identify which politicians are most central to an article's content.
 */

/**
 * Calculate relevance scores for politicians detected in an article using a decision tree approach
 * @param {Object} article - Article object with title, description, content
 * @param {Array} detectedPoliticians - Array of politician names detected in the article
 * @returns {Array} Array of objects with politician names and their relevance scores, sorted by score
 */
function scorePoliticianRelevance(article, detectedPoliticians) {
  if (!detectedPoliticians || detectedPoliticians.length === 0) {
    return [];
  }
  
  const { title, description, content } = article;
  const fullText = `${title} ${description} ${content}`;
  
  // Calculate article length metrics
  const contentLength = content ? content.length : 0;
  const earlyContentThreshold = Math.min(500, contentLength * 0.2); // First 500 chars or 20% of content
  
  // Initialize scores and relevance data for each politician
  const relevanceData = {};
  detectedPoliticians.forEach(politician => {
    // Check different zones for mentions
    const titleMentions = countOccurrences(title, politician);
    const descriptionMentions = countOccurrences(description, politician);
    const contentMentions = countOccurrences(content, politician);
    const earlyContentMentions = countOccurrences(content.substring(0, earlyContentThreshold), politician);
    const nearQuoteMentions = countNearQuotes(fullText, politician);
    const reactionContextMentions = countInReactionContext(fullText, politician);
    
    // Store all mentions data
    relevanceData[politician] = {
      name: politician,
      mentions: {
        title: titleMentions,
        description: descriptionMentions,
        content: contentMentions,
        earlyContent: earlyContentMentions,
        nearQuote: nearQuoteMentions,
        inReactionContext: reactionContextMentions
      },
      // Decision tree scoring - calculate relevance based on rules
      isRelevant: false,
      relevanceReason: [],
      // Keep traditional score for sorting
      score: 0
    };
    
    // Apply Rule 1: Title or Description Mention
    if (titleMentions > 0 || descriptionMentions > 0) {
      relevanceData[politician].isRelevant = true;
      relevanceData[politician].relevanceReason.push("Mentioned in title or description");
      
      // Calculate score for sorting (title worth more than description)
      relevanceData[politician].score += titleMentions * 10;
      relevanceData[politician].score += descriptionMentions * 5;
    }
    // Apply Rule 2: Body Mention + Contextual Boost
    else if (contentMentions > 0) {
      // Check if meets any of the contextual criteria
      
      // 2a. Mentioned multiple times
      if (contentMentions > 1) {
        relevanceData[politician].isRelevant = true;
        relevanceData[politician].relevanceReason.push("Mentioned multiple times in content");
        relevanceData[politician].score += contentMentions;
      }
      
      // 2b. Mentioned early in the text
      if (earlyContentMentions > 0) {
        relevanceData[politician].isRelevant = true;
        relevanceData[politician].relevanceReason.push("Mentioned early in content");
        relevanceData[politician].score += 3;
      }
      
      // 2c. Mentioned with reaction verbs or in quoted text
      if (nearQuoteMentions > 0 || reactionContextMentions > 0) {
        relevanceData[politician].isRelevant = true;
        if (nearQuoteMentions > 0) {
          relevanceData[politician].relevanceReason.push("Mentioned near quotes");
          relevanceData[politician].score += nearQuoteMentions * 2;
        }
        if (reactionContextMentions > 0) {
          relevanceData[politician].relevanceReason.push("Mentioned in reaction context");
          relevanceData[politician].score += reactionContextMentions * 3;
        }
      }
      
      // If doesn't meet any criteria, it's just a background mention
      if (!relevanceData[politician].isRelevant) {
        relevanceData[politician].relevanceReason.push("Background mention only");
      }
    }
  });
  
  // Convert to array and sort by score (descending)
  const scoredPoliticians = Object.values(relevanceData).sort((a, b) => b.score - a.score);
  
  return scoredPoliticians;
}

/**
 * Get the most relevant politicians based on relevance rules
 * @param {Array} scoredPoliticians - Array of politicians with relevance scores
 * @param {Object} options - Options for filtering
 * @param {number} options.maxCount - Maximum number of politicians to return (default: 5)
 * @returns {Array} Array of the most relevant politicians
 */
function getRelevantPoliticians(scoredPoliticians, options = {}) {
  const maxCount = options.maxCount || 5;
  
  // Filter to only include relevant politicians based on rules
  let relevantPoliticians = scoredPoliticians.filter(p => p.isRelevant);
  
  // If no one is relevant but we have politicians, take the top scoring ones
  if (relevantPoliticians.length === 0 && scoredPoliticians.length > 0) {
    relevantPoliticians = scoredPoliticians.slice(0, Math.min(2, scoredPoliticians.length));
  }
  
  // Cap to maximum count
  relevantPoliticians = relevantPoliticians.slice(0, maxCount);
  
  return relevantPoliticians.map(p => ({
    name: p.name,
    score: p.score,
    isRelevant: p.isRelevant,
    reasons: p.relevanceReason,
    details: p.mentions
  }));
}

/**
 * Count the number of occurrences of a politician name in text
 * @param {string} text - The text to search in
 * @param {string} politician - Politician name to count
 * @returns {number} Number of occurrences
 */
function countOccurrences(text, politician) {
  if (!text || !politician) return 0;
  
  // Create a regex pattern that matches the politician name as a whole word
  const escapedPolitician = escapeRegExp(politician);
  const regex = new RegExp(`(^|\\s|["'\`.,;:!?()[\\]{}])${escapedPolitician}(?=$|\\s|["'\`.,;:!?()[\\]{}])`, 'g');
  
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

/**
 * Count occurrences of a politician name near quotes
 * @param {string} text - The text to search in
 * @param {string} politician - Politician name to look for
 * @returns {number} Number of occurrences near quotes
 */
function countNearQuotes(text, politician) {
  if (!text || !politician) return 0;
  
  // Get all politician name positions
  const positions = findAllPositions(text, politician);
  let nearQuoteCount = 0;
  
  // Context window size (characters before/after to check for quotes)
  const windowSize = 100;
  
  positions.forEach(position => {
    const startWindow = Math.max(0, position - windowSize);
    const endWindow = Math.min(text.length, position + politician.length + windowSize);
    
    const context = text.substring(startWindow, endWindow);
    
    // Check if there are quotes in the context
    if (containsQuotes(context)) {
      nearQuoteCount++;
    }
  });
  
  return nearQuoteCount;
}

/**
 * Check if text contains quotes
 * @param {string} text - Text to check
 * @returns {boolean} True if contains quotes
 */
function containsQuotes(text) {
  // Check for Hebrew and regular quotes
  const quoteRegex = /["״'']/;
  return quoteRegex.test(text);
}

/**
 * Count occurrences of a politician name in reaction contexts
 * @param {string} text - The text to search in
 * @param {string} politician - Politician name to look for
 * @returns {number} Number of occurrences in reaction contexts
 */
function countInReactionContext(text, politician) {
  if (!text || !politician) return 0;
  
  // Get all politician name positions
  const positions = findAllPositions(text, politician);
  let reactionContextCount = 0;
  
  // Context window size (characters before/after to check for reaction verbs)
  const windowSize = 120;
  
  // Hebrew reaction verbs
  const reactionVerbs = [
    'אמר', 'הגיב', 'התייחס', 'טען', 'ציין', 'ביקר',
    'תקף', 'הבהיר', 'הדגיש', 'מסר', 'הצהיר', 'הודיע',
    'כתב', 'פרסם', 'שיתף', 'הודה', 'הכחיש', 'קבע',
    'הוסיף', 'הסביר', 'הזהיר', 'דרש', 'קרא ל'
  ];
  
  positions.forEach(position => {
    const startWindow = Math.max(0, position - windowSize);
    const endWindow = Math.min(text.length, position + politician.length + windowSize);
    
    const context = text.substring(startWindow, endWindow);
    
    // Check if any reaction verb appears in the context
    if (containsAnyWord(context, reactionVerbs)) {
      reactionContextCount++;
    }
  });
  
  return reactionContextCount;
}

/**
 * Check if text contains any of the specified words
 * @param {string} text - Text to check
 * @param {Array} words - Words to look for
 * @returns {boolean} True if any word is found
 */
function containsAnyWord(text, words) {
  for (const word of words) {
    // Create word boundary regex to match whole words
    const escapedWord = escapeRegExp(word);
    const regex = new RegExp(`(^|\\s|["'\`.,;:!?()[\\]{}])${escapedWord}(?=$|\\s|["'\`.,;:!?()[\\]{}])`, 'i');
    
    if (regex.test(text)) {
      return true;
    }
  }
  return false;
}

/**
 * Find all positions of a politician name in text
 * @param {string} text - The text to search in
 * @param {string} politician - Politician name to find
 * @returns {Array} Array of starting positions
 */
function findAllPositions(text, politician) {
  if (!text || !politician) return [];
  
  const positions = [];
  const escapedPolitician = escapeRegExp(politician);
  const regex = new RegExp(`(^|\\s|["'\`.,;:!?()[\\]{}])${escapedPolitician}(?=$|\\s|["'\`.,;:!?()[\\]{}])`, 'g');
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    // Add the position after the prefix character
    positions.push(match.index + match[1].length);
  }
  
  return positions;
}

/**
 * Helper function to escape special regex characters
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  scorePoliticianRelevance,
  getRelevantPoliticians,
  countOccurrences,
  countNearQuotes,
  countInReactionContext
}; 