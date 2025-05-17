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

module.exports = {
  initialize: initializePoliticianDetection
}; 