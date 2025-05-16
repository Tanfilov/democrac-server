/**
 * Politician Detection Module
 * 
 * This module exports functions for detecting politicians in text
 */

const fs = require('fs');
const path = require('path');

/**
 * Load politicians from a JSON file
 * @param {string} filePath - Path to the JSON file with politician data
 * @returns {Array} Array of politicians with their data
 */
function loadPoliticians(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const politicians = JSON.parse(data);
    
    console.log(`Loaded ${politicians.length} politicians from ${filePath}`);
    return politicians;
  } catch (error) {
    console.error(`Error loading politicians from ${filePath}:`, error);
    return [];
  }
}

// Export both the original functions and the improved detection
// We'll use the improved detection internally but maintain API compatibility
const detection = require('./detection-fix');

module.exports = {
  findPoliticianMentions: detection.findPoliticianMentions,
  isModifiedPosition: detection.isModifiedPosition,
  hasRequiredContext: detection.hasRequiredContext,
  isExactMatch: detection.isExactMatch,
  findAllOccurrences: detection.findAllOccurrences,
  isInsideQuotes: detection.isInsideQuotes,
  loadPoliticians
}; 