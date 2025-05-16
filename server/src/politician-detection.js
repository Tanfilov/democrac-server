/**
 * Unified Politician Detection Module
 * 
 * This file ensures consistent behavior by directly linking to
 * the improved detection module used in politician-detection/index.js.
 * 
 * This helps prevent inconsistencies when different code paths may use
 * either the /politicians or /politician-detection modules.
 */

// Import the improved politician detection module
const politicianDetection = require('./politician-detection/index.js');

// Export all functions from the improved detection module
module.exports = politicianDetection; 