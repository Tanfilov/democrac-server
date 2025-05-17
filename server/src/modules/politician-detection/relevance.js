/**
 * Politician Relevance Scoring Module
 * 
 * This module handles scoring and ranking detected politicians by relevance.
 * It provides functions to determine which politicians are most relevant to an article.
 */

/**
 * Score politicians based on relevance factors
 * @param {Array} detectedPoliticians - List of detected politician names
 * @param {Object} article - The article object with title, description, content
 * @returns {Array} Array of politician objects with relevance scores
 */
function scorePoliticianRelevance(detectedPoliticians, article) {
  if (!detectedPoliticians || detectedPoliticians.length === 0) {
    return [];
  }
  
  const combinedText = [
    article.title || '', 
    article.description || '', 
    article.content || ''
  ].join(' ');
  
  const relevanceData = {};
  
  // Analyze each detected politician
  detectedPoliticians.forEach(politician => {
    // Initialize relevance data
    relevanceData[politician] = {
      name: politician,
      score: 0,
      isRelevant: false,
      occurrences: {
        total: 0,
        title: 0,
        description: 0,
        content: 0,
        nearQuotes: 0,
        inReactionContext: 0
      }
    };
    
    // Count total occurrences
    relevanceData[politician].occurrences.total = countOccurrences(combinedText, politician);
    
    // Count occurrences in title (high importance)
    if (article.title) {
      relevanceData[politician].occurrences.title = countOccurrences(article.title, politician);
      relevanceData[politician].score += relevanceData[politician].occurrences.title * 3; // Title mentions are 3x more important
    }
    
    // Count occurrences in description (medium importance)
    if (article.description) {
      relevanceData[politician].occurrences.description = countOccurrences(article.description, politician);
      relevanceData[politician].score += relevanceData[politician].occurrences.description * 2; // Description mentions are 2x important
    }
    
    // Count occurrences in content (base importance)
    if (article.content) {
      relevanceData[politician].occurrences.content = countOccurrences(article.content, politician);
      relevanceData[politician].score += relevanceData[politician].occurrences.content; // Base score for content mentions
      
      // Count occurrences near quotes (indicates statements from/about politician)
      relevanceData[politician].occurrences.nearQuotes = countNearQuotes(article.content, politician);
      relevanceData[politician].score += relevanceData[politician].occurrences.nearQuotes * 1.5; // Quote-associated mentions are 1.5x important
      
      // Count occurrences in reaction context (indicates central role)
      relevanceData[politician].occurrences.inReactionContext = countInReactionContext(article.content, politician);
      relevanceData[politician].score += relevanceData[politician].occurrences.inReactionContext * 1.5; // Reaction context is 1.5x important
    }
    
    // Determine if politician is relevant
    // Criteria:
    // 1. Appears in title
    // 2. OR appears at least twice in description
    // 3. OR appears near quotes and multiple times in content
    relevanceData[politician].isRelevant = 
      relevanceData[politician].occurrences.title > 0 || 
      relevanceData[politician].occurrences.description >= 2 ||
      (relevanceData[politician].occurrences.nearQuotes > 0 && relevanceData[politician].occurrences.content >= 3);
  });
  
  // Convert to array and sort by score
  const scoredPoliticians = Object.values(relevanceData).sort((a, b) => b.score - a.score);
  
  return scoredPoliticians;
}

/**
 * Get the most relevant politicians based on scoring and options
 * @param {Array} scoredPoliticians - Array of politician objects with scores
 * @param {Object} options - Options for filtering
 * @param {number} options.minScore - Minimum score to consider (default: 1)
 * @param {number} options.maxCount - Maximum number to return (default: 5)
 * @returns {Array} Array of relevant politician objects
 */
function getRelevantPoliticians(scoredPoliticians, options = {}) {
  const minScore = options.minScore || 1;
  const maxCount = options.maxCount || 5;
  
  // Start with politicians marked as relevant
  let relevantPoliticians = scoredPoliticians.filter(p => p.isRelevant);
  
  // If none are marked relevant, use a minimum score threshold
  if (relevantPoliticians.length === 0 && scoredPoliticians.length > 0) {
    // Find politicians with at least the minimum score
    const politiciansWithMinScore = scoredPoliticians.filter(p => p.score >= minScore);
    
    // Use the top 2 if available
    relevantPoliticians = politiciansWithMinScore.slice(0, Math.min(2, politiciansWithMinScore.length));
  }
  
  // Limit to maxCount
  relevantPoliticians = relevantPoliticians.slice(0, maxCount);
  
  return relevantPoliticians.map(p => ({
    name: p.name,
    score: p.score,
    occurrences: p.occurrences
  }));
}

/**
 * Count occurrences of a politician name in text
 * @param {string} text - The text to search in
 * @param {string} politician - The politician name to count
 * @returns {number} Number of occurrences
 */
function countOccurrences(text, politician) {
  if (!text || !politician) return 0;
  
  let count = 0;
  let index = text.indexOf(politician);
  
  while (index !== -1) {
    count++;
    index = text.indexOf(politician, index + 1);
  }
  
  return count;
}

/**
 * Count occurrences of a politician name near quotes
 * @param {string} text - The text to search in
 * @param {string} politician - The politician name to count
 * @returns {number} Number of occurrences near quotes
 */
function countNearQuotes(text, politician) {
  if (!text || !politician) return 0;
  
  // Look for patterns like: politician: "quote" or "quote" says politician
  const patterns = [
    new RegExp(`${escapeRegExp(politician)}[,:]?\\s*[""]`, 'gi'), // politician: "quote
    new RegExp(`[""]\\s*[^"]{1,40}\\s${escapeRegExp(politician)}\\b`, 'gi'), // "quote" politician
    new RegExp(`\\b${escapeRegExp(politician)}\\s[^"]{1,40}\\s*[""]`, 'gi'), // politician said "quote
    new RegExp(`[""][^"]{1,60}${escapeRegExp(politician)}[^"]{1,60}[""]`, 'gi') // "quote with politician mentioned inside"
  ];
  
  let count = 0;
  patterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      count += matches.length;
    }
  });
  
  return count;
}

/**
 * Count occurrences of a politician in reaction contexts
 * @param {string} text - The text to search in
 * @param {string} politician - The politician name to count
 * @returns {number} Number of occurrences in reaction contexts
 */
function countInReactionContext(text, politician) {
  if (!text || !politician) return 0;
  
  // Reaction context terms in Hebrew
  const reactionTerms = [
    'הגיב', 'תגובת', 'תגובה', 'תקף', 'מסר', 'הודיע', 'אמר', 'צייץ', 'כתב',
    'פרסם', 'הצהיר', 'טען', 'התבטא', 'הכריז', 'קבע', 'אישר', 'הכחיש',
    'התנגד', 'האשים', 'דחה', 'חשף', 'דרש', 'תגובתו', 'אמרו'
  ];
  
  let count = 0;
  
  // Look for patterns: politician + reaction term or reaction term + politician
  const patternBefore = new RegExp(`\\b${escapeRegExp(politician)}\\s+(?:${reactionTerms.join('|')})\\b`, 'gi');
  const patternAfter = new RegExp(`\\b(?:${reactionTerms.join('|')})\\s+[^.]{0,50}?\\b${escapeRegExp(politician)}\\b`, 'gi');
  
  const beforeMatches = text.match(patternBefore);
  const afterMatches = text.match(patternAfter);
  
  count += beforeMatches ? beforeMatches.length : 0;
  count += afterMatches ? afterMatches.length : 0;
  
  return count;
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