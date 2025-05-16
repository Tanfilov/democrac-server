/**
 * Legacy reprocess-politicians.js implementation
 * Saved for reference
 */

// Function to detect politicians in text
const findPoliticianMentions = (text) => {
  if (!text) return [];
  
  const mentions = [];
  const textLower = text.toLowerCase();
  
  // For each politician
  for (const politician of POLITICIANS) {
    // Check primary name
    if (text.includes(politician.he)) {
      mentions.push(politician.he);
    }
    
    // Check aliases
    for (const alias of politician.aliases) {
      if (text.includes(alias)) {
        mentions.push(politician.he); // Add the main name if alias found
        break; // Only add once per politician
      }
    }
  }
  
  return [...new Set(mentions)]; // Remove duplicates
}; 