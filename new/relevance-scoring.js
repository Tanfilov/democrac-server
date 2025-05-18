/**
 * Scoring module to evaluate the relevance of politician mentions in articles
 */

/**
 * Score a politician's relevance to an article based on detection details
 * @param {string} name - Politician name
 * @param {Object} detectionDetails - Object with detection information
 * @returns {number} Relevance score
 */
function scorePoliticianRelevance(name, detectionDetails) {
  if (!name || !detectionDetails) return 0;
  
  let score = 0;
  
  // Factors for scoring
  const {
    occurrenceCount = 0,      // Total occurrences
    foundInTitle = false,     // Was found in article title
    foundInDescription = false, // Was found in article description
    foundInContent = false,   // Was found in article content
    isEarlyInContent = false, // First occurrence is early in content
    isNearQuotes = false,     // Any occurrence is near quotes
    methods = []              // Detection methods used
  } = detectionDetails;
  
  // Title mentions are high value
  if (foundInTitle) {
    score += 3;
  }
  
  // Description mentions
  if (foundInDescription) {
    score += 2;
  }
  
  // Content mentions
  if (foundInContent) {
    score += 1;
    
    // Additional score based on occurrence count (capped at 5)
    score += Math.min(occurrenceCount / 2, 2.5);
    
    // Extra points for strategic positioning
    if (isEarlyInContent) score += 1;
    if (isNearQuotes) score += 1;
  }
  
  // Special detection methods
  if (methods.includes('special_pattern')) {
    score += 2;
  }
  
  if (methods.includes('colon_pattern')) {
    score += 1.5;
  }
  
  return score;
}

/**
 * Filter politicians based on their relevance scores
 * @param {Array} politiciansWithScores - Array of objects with name and score properties
 * @param {number} threshold - Confidence threshold
 * @param {Object} options - Additional options
 * @returns {Array} Filtered politician names
 */
function filterByRelevance(politiciansWithScores, threshold = 2, options = {}) {
  if (!politiciansWithScores || !Array.isArray(politiciansWithScores)) {
    return [];
  }
  
  const {
    lowerThresholdPoliticians = [],  // Politicians with lower threshold
    lowerThreshold = 1              // The lower threshold value
  } = options;
  
  return politiciansWithScores
    .filter(p => {
      if (lowerThresholdPoliticians.includes(p.name)) {
        return p.score >= lowerThreshold;
      }
      return p.score >= threshold;
    })
    .map(p => p.name);
}

/**
 * Create detection summary with scores for auditing and refinement
 * @param {Array} politicianNames - Array of politician names detected
 * @param {Object} detectionDetails - Detection details keyed by politician name
 * @param {Object} article - Article object
 * @returns {Object} Detection summary
 */
function createDetectionSummary(politicianNames, detectionDetails, article) {
  if (!politicianNames || !detectionDetails || !article) {
    return { article_id: article?.id || 'unknown', detections: [] };
  }
  
  const detections = politicianNames.map(name => {
    const details = detectionDetails[name] || {};
    const score = scorePoliticianRelevance(name, details);
    
    return {
      name,
      score,
      detection_methods: details.methods || [],
      mention_locations: {
        title: details.foundInTitle || false,
        description: details.foundInDescription || false,
        content: details.foundInContent || false
      },
      occurrence_count: details.occurrenceCount || 0,
      early_mention: details.isEarlyInContent || false,
      near_quotes: details.isNearQuotes || false
    };
  });
  
  return {
    article_id: article.id,
    article_title: article.title,
    detections
  };
}

module.exports = {
  scorePoliticianRelevance,
  filterByRelevance,
  createDetectionSummary
}; 