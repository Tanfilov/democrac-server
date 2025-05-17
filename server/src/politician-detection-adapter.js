/**
 * Politician Detection Module Adapter
 * 
 * This adapter provides backward compatibility with existing code while
 * using the new modular implementation. It bridges between the old API
 * (which was scattered across multiple files) and the new unified module.
 */

const path = require('path');
const politicianDetectionModule = require('./modules/politician-detection');

// Initialize the politician detection module with default options
const politiciansPath = path.join(__dirname, '../../data/politicians/politicians.json');

// This will be initialized when setDatabase is called
let politicianDetection = null;
let databaseConnection = null;
let scrapeContentFunction = null;

/**
 * Set the database connection for database operations
 * @param {Object} db - The database connection
 */
function setDatabase(db) {
  if (!db) {
    console.error('Invalid database connection provided to politician detection adapter');
    return;
  }
  
  databaseConnection = db;
  
  // Re-initialize the module with the database connection
  politicianDetection = politicianDetectionModule.initialize({
    politiciansPath,
    db: databaseConnection,
    scrapeContent: scrapeContentFunction
  });
}

/**
 * Set the function to scrape article content
 * @param {Function} scrapeFunction - Function to scrape article content
 */
function setScrapeFunction(scrapeFunction) {
  scrapeContentFunction = scrapeFunction;
  
  // Re-initialize the module with the scrape function
  if (databaseConnection) {
    politicianDetection = politicianDetectionModule.initialize({
      politiciansPath,
      db: databaseConnection,
      scrapeContent: scrapeContentFunction
    });
  }
}

/**
 * Initialize module with both database and scrape function
 * @param {Object} options - Initialization options
 * @param {Object} options.db - Database connection
 * @param {Function} options.scrapeContent - Function to scrape content
 */
function initialize(options = {}) {
  if (options.db) {
    databaseConnection = options.db;
  }
  
  if (options.scrapeContent) {
    scrapeContentFunction = options.scrapeContent;
  }
  
  // Initialize the module with provided options
  politicianDetection = politicianDetectionModule.initialize({
    politiciansPath,
    db: databaseConnection,
    scrapeContent: scrapeContentFunction
  });
  
  return module.exports;
}

// Lazy-initialize on first access if not explicitly initialized
function getDetectionModule() {
  if (!politicianDetection) {
    console.warn('Politician detection module accessed before proper initialization');
    politicianDetection = politicianDetectionModule.initialize({
      politiciansPath
    });
  }
  return politicianDetection;
}

// Exported API - compatible with old API but using new implementation
module.exports = {
  // Core initialization functions
  initialize,
  setDatabase,
  setScrapeFunction,
  
  // Backward compatibility functions
  findPoliticianMentions: (text) => getDetectionModule().findMentions(text),
  
  enhancedPoliticianDetection: async (article) => 
    await getDetectionModule().detectForArticle(article),
  
  updatePoliticianMentions: (articleId, politicians) => 
    getDetectionModule().updateMentions(articleId, politicians),
  
  // Relevance scoring
  scorePoliticianRelevance: (detectedPoliticians, article) => 
    getDetectionModule().scoreRelevance(detectedPoliticians, article),
  
  getRelevantPoliticians: (scoredPoliticians, options) => 
    getDetectionModule().getRelevantPoliticians(scoredPoliticians, options),
  
  // Access to politicians data
  loadPoliticians: () => getDetectionModule().getAllPoliticians(),
  
  // Utility functions
  countOccurrences: (text, politician) => 
    getDetectionModule().countOccurrences(text, politician),
  
  isExactMatch: (text, word, boundaries, politician) => 
    getDetectionModule().isExactMatch(text, word, boundaries, politician),
  
  findAllOccurrences: (text, subtext) => 
    getDetectionModule().findAllOccurrences(text, subtext)
}; 