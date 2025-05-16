// Politicians module
const fs = require('fs');
const path = require('path');
const detection = require('./detection');

/**
 * Load politicians data from JSON file
 * @param {string} politiciansFilePath - Path to politicians JSON file
 * @returns {Array} Array of politician objects
 */
function loadPoliticians(politiciansFilePath) {
  try {
    const politiciansData = fs.readFileSync(politiciansFilePath, 'utf8');
    const politiciansList = JSON.parse(politiciansData);
    
    // Format for detection (using name property for consistent detection)
    return politiciansList.map(p => {
      // Default English translation (for now, just use the same name)
      const enName = p.name;
      return { 
        name: p.name, // Use name consistently instead of he
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

// Export functions from detection.js
module.exports = {
  // Main detection functions
  findPoliticianMentions: detection.findPoliticianMentions,
  enhancedPoliticianDetection: detection.enhancedPoliticianDetection,
  
  // Helper functions
  loadPoliticians,
  
  // Utility functions
  isPositionFormer: detection.isPositionFormer,
  hasRequiredContext: detection.hasRequiredContext,
  isExactMatch: detection.isExactMatch,
  findAllOccurrences: detection.findAllOccurrences,
  isInsideQuotes: detection.isInsideQuotes
}; 