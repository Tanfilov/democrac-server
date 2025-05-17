/**
 * Politician Detection Module
 * 
 * This module provides a unified interface for detecting politicians in text content.
 * It encapsulates all politician detection logic in one place and provides
 * a clean API for the rest of the application to use.
 */

const detection = require('./detection');
const relevance = require('./relevance');
const dataAccess = require('./data-access');

/**
 * Find mentioned politicians in an article
 * @param {Object} article - Article object with title, description, and content
 * @returns {Promise<Array>} Promise resolving to array of detected politician names
 */
async function findMentionedPoliticians(article) {
  try {
    // Get list of politicians from database
    const POLITICIANS = await dataAccess.getPoliticians();
    
    // Apply enhanced politician detection with all optimizations
    const detectedPoliticians = await detection.enhancedPoliticianDetection(
      article, 
      POLITICIANS,
      relevance.scrapeArticleContent,
      relevance.updateArticleContent
    );
    
    return detectedPoliticians;
  } catch (error) {
    console.error('Error in findMentionedPoliticians:', error);
    return [];
  }
}

/**
 * Fix politician detection for a specific article
 * This is used by the fix-politician-detection endpoint
 * @param {Object} article - Article object with title, description, and content
 * @returns {Promise<Object>} Promise resolving to object with detection results
 */
async function fixPoliticianDetection(article) {
  try {
    // Get current mentioned politicians
    const before = article.mentionedPoliticians || [];
    
    // Get list of politicians from database
    const POLITICIANS = await dataAccess.getPoliticians();
    
    // Run the enhanced detection directly (identical to findMentionedPoliticians)
    const detectionResult = await detection.enhancedPoliticianDetection(
      article, 
      POLITICIANS,
      relevance.scrapeArticleContent,
      relevance.updateArticleContent
    );
    
    // Store the detected politicians
    await dataAccess.updateArticleMentions(article.id, detectionResult);
    
    // Return the result for API response
    return {
      before,
      after: detectionResult,
      detectionResult
    };
  } catch (error) {
    console.error('Error in fixPoliticianDetection:', error);
    return { 
      before: [], 
      after: [], 
      detectionResult: [] 
    };
  }
}

/**
 * Initialize the politician detection module
 * @param {Object} options - Configuration options
 * @param {string} options.politiciansPath - Path to the politicians JSON file
 * @param {Object} options.db - Database connection object
 * @param {Function} options.scrapeContent - Function to scrape article content
 * @returns {Object} The initialized politician detection module API
 */
function initializePoliticianDetection(options = {}) {
  const { 
    politiciansPath,
    db,
    scrapeContent
  } = options;
  
  // Load politicians data
  const politicians = dataAccess.loadPoliticians(politiciansPath);
  
  // Return the API
  return {
    // Core detection functions
    findMentions: (text) => detection.findPoliticianMentions(text, politicians),
    
    // Enhanced detection functions
    detectForArticle: async (article) => {
      // Use the full enhanced detection for all articles automatically
      return detection.enhancedPoliticianDetection(
        article, 
        politicians, 
        scrapeContent,
        (articleId, content) => dataAccess.updateArticleContent(db, articleId, content)
      );
    },
    
    // Relevance scoring functions
    scoreRelevance: (detectedPoliticians, article) => 
      relevance.scorePoliticianRelevance(detectedPoliticians, article),
    
    getRelevantPoliticians: (scoredPoliticians, options) => 
      relevance.getRelevantPoliticians(scoredPoliticians, options),
    
    // Database operations
    updateMentions: (articleId, politicianNames) => 
      dataAccess.updatePoliticianMentions(db, articleId, politicianNames),
      
    getAllPoliticians: () => politicians,
    
    // Utility functions
    isExactMatch: detection.isExactMatch,
    findAllOccurrences: detection.findAllOccurrences,
    countOccurrences: relevance.countOccurrences
  };
}

/**
 * Main module for politician detection
 * @module politician-detection
 */

const { enhancedPoliticianDetection, findPoliticianMentions } = require('./detection');
const { getPoliticians, updateArticleMentions } = require('./data-access');
const { scrapeArticleContent, updateArticleContent } = require('./relevance');

module.exports = {
  initialize: initializePoliticianDetection,
  findMentionedPoliticians,
  findPoliticianMentions: detection.findPoliticianMentions,
  fixPoliticianDetection
}; 