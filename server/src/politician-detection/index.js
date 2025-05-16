// Politicians module
const fs = require('fs');
const path = require('path');
const detection = require('./detection');
const improvedDetection = require('./detection-fix');
const relevanceScoring = require('./relevance-scoring');

/**
 * Load politicians data from JSON file
 * @param {string} politiciansFilePath - Path to politicians JSON file
 * @returns {Array} Array of politician objects
 */
function loadPoliticians(politiciansFilePath) {
  try {
    const politiciansData = fs.readFileSync(politiciansFilePath, 'utf8');
    const politiciansList = JSON.parse(politiciansData);
    
    // Format for detection (using name property)
    return politiciansList.map(p => {
      // Default English translation (for now, just use the same name)
      const enName = p.name;
      return { 
        name: p.name, 
        en: enName, 
        position: p.position,
        aliases: p.aliases || [],
        requiresContext: p.requiresContext || false,
        contextIdentifiers: p.contextIdentifiers || []
      };
    });
  } catch (error) {
    console.error('Error loading politicians data:', error);
    return [];
  }
}

// Export functions from detection modules
module.exports = {
  // Main detection functions - use improved versions
  findPoliticianMentions: improvedDetection.findPoliticianMentions,
  enhancedPoliticianDetection: improvedDetection.enhancedPoliticianDetection,
  
  // Helper functions
  loadPoliticians,
  
  // Utility functions from improved detection
  isModifiedPosition: improvedDetection.isModifiedPosition,
  hasRequiredContext: improvedDetection.hasRequiredContext,
  isExactMatch: improvedDetection.isExactMatch,
  findAllOccurrences: improvedDetection.findAllOccurrences,
  isInsideQuotes: improvedDetection.isInsideQuotes,
  
  // Export relevance scoring functions
  scorePoliticianRelevance: relevanceScoring.scorePoliticianRelevance,
  getRelevantPoliticians: relevanceScoring.getRelevantPoliticians,
  countOccurrences: relevanceScoring.countOccurrences,
  countNearQuotes: relevanceScoring.countNearQuotes,
  countInReactionContext: relevanceScoring.countInReactionContext
}; 