const fs = require('fs');
const path = require('path');

// Import detection logic
const detectionFix = require('../detection-fix');
const relevanceScoring = require('../relevance-scoring');

/**
 * Load politician data from JSON and standardize format
 * @param {string} filePath - Path to politicians JSON file
 * @returns {Array} Standardized politician objects
 */
function loadPoliticians(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const rawPoliticians = JSON.parse(data);
    
    // Map to standardized format with required fields
    return rawPoliticians.map(politician => ({
      name: politician.name,
      en: politician.en || politician.name, // English name (same as Hebrew name if not provided)
      position: politician.position || '',
      aliases: politician.aliases || [],
      requiresContext: politician.requiresContext || false,
      contextIdentifiers: politician.contextIdentifiers || []
    }));
  } catch (error) {
    console.error(`Error loading politicians from ${filePath}:`, error);
    throw error;
  }
}

/**
 * Detect politicians in an article
 * @param {Object} article - Article object with title, description, content properties
 * @param {Array} politicians - Array of politician objects
 * @returns {Promise<Array>} Array of politician names found in the article
 */
async function detectPoliticians(article, politicians) {
  if (!article || !politicians) {
    console.error('Invalid inputs to detectPoliticians');
    return [];
  }

  const allText = [
    article.title || '', 
    article.description || '', 
    article.content || ''
  ].join('\n');
  
  // Use the enhanced detection from detection-fix.js
  const detectedPoliticians = detectionFix.findPoliticianMentions(allText, politicians);
  
  // Get unique politician names (avoid duplicates)
  const uniquePoliticians = [...new Set(detectedPoliticians)];
  
  // Track where each politician was found
  const detectionDetails = {};
  
  uniquePoliticians.forEach(name => {
    detectionDetails[name] = {
      foundInTitle: article.title && detectionFix.findPoliticianMentions(article.title, politicians).includes(name),
      foundInDescription: article.description && detectionFix.findPoliticianMentions(article.description, politicians).includes(name),
      foundInContent: article.content && detectionFix.findPoliticianMentions(article.content, politicians).includes(name),
      occurrenceCount: countOccurrences(allText, name, politicians)
    };
  });
  
  // Apply relevance scoring
  const scoredPoliticians = uniquePoliticians.map(name => ({
    name,
    score: relevanceScoring.scorePoliticianRelevance(name, detectionDetails[name])
  }));
  
  // Sort by relevance score
  scoredPoliticians.sort((a, b) => b.score - a.score);
  
  // Return politician names in order of relevance
  return scoredPoliticians.map(p => p.name);
}

/**
 * Count occurrences of a politician in text
 * @param {string} text - The text to search in
 * @param {string} politicianName - Name of the politician
 * @param {Array} politicians - Array of politician objects
 * @returns {number} Number of occurrences
 */
function countOccurrences(text, politicianName, politicians) {
  if (!text) return 0;
  
  // Find the politician object
  const politician = politicians.find(p => p.name === politicianName);
  if (!politician) return 0;
  
  // Count name occurrences
  let count = countSubstringOccurrences(text, politician.name);
  
  // Count aliases
  if (politician.aliases && politician.aliases.length > 0) {
    politician.aliases.forEach(alias => {
      count += countSubstringOccurrences(text, alias);
    });
  }
  
  return count;
}

/**
 * Count occurrences of a substring in text
 * @param {string} text - Text to search in
 * @param {string} substring - Substring to count
 * @returns {number} Number of occurrences
 */
function countSubstringOccurrences(text, substring) {
  if (!text || !substring) return 0;
  
  let count = 0;
  let index = text.indexOf(substring);
  
  while (index !== -1) {
    count++;
    index = text.indexOf(substring, index + 1);
  }
  
  return count;
}

/**
 * Analyze an article to determine which politicians are mentioned
 * @param {Object} article - Article object with title, description, content
 * @param {Array} politicians - Array of politician objects
 * @param {Object} options - Configuration options
 * @returns {Object} Analysis results
 */
async function analyzeArticle(article, politicians, options = {}) {
  if (!article || !politicians) {
    return { detected: [], summary: null };
  }
  
  // Detect politicians in the article
  const detected = await detectPoliticians(article, politicians, options);
  
  let summary = null;
  if (options.createSummary) {
    // Create a detailed summary with scores for each detected politician
    // This would include detection methods, locations, frequencies, etc.
    // This is a placeholder - in a real implementation, you'd gather this data during detection
    summary = {
      article_id: article.id,
      article_title: article.title,
      detections: detected.map(name => ({ name, score: 0 })) // Basic structure
    };
  }
  
  return { detected, summary };
}

// Export the functions
module.exports = {
  loadPoliticians,
  detectPoliticians,
  countOccurrences,
  
  // Re-export functions from detection-fix.js
  findPoliticianMentions: detectionFix.findPoliticianMentions,
  normalizeText: detectionFix.normalizeText,
  cleanText: detectionFix.cleanText,
  isExactMatch: detectionFix.isExactMatch,
  
  // Re-export functions from relevance-scoring.js
  scorePoliticianRelevance: relevanceScoring.scorePoliticianRelevance,
  filterByRelevance: relevanceScoring.filterByRelevance,
  createDetectionSummary: relevanceScoring.createDetectionSummary,
  
  // Helper functions from detection-fix
  hasRequiredContext: detectionFix.hasRequiredContext,
  isModifiedPosition: detectionFix.isModifiedPosition,
  getPartialNameIndicators: detectionFix.getPartialNameIndicators,
  isStandaloneWord: detectionFix.isStandaloneWord,
  findAllOccurrences: detectionFix.findAllOccurrences,
  isInsideQuotes: detectionFix.isInsideQuotes,
  
  analyzeArticle
}; 