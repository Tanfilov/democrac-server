/**
 * Data Access Module for Politician Detection
 * 
 * This module handles all data access operations related to politicians:
 * - Loading politician data from JSON file
 * - Database operations for politician mentions
 */

const fs = require('fs');
const path = require('path');

/**
 * Load politicians data from JSON file
 * @param {string} politiciansFilePath - Path to politicians JSON file
 * @returns {Array} Array of politician objects formatted for detection
 */
function loadPoliticians(politiciansFilePath) {
  try {
    if (!politiciansFilePath) {
      console.error('No politicians file path provided');
      return [];
    }
    
    const politiciansData = fs.readFileSync(politiciansFilePath, 'utf8');
    const politiciansList = JSON.parse(politiciansData);
    
    // Format for detection (using consistent name property)
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

/**
 * Update article content in the database
 * @param {Object} db - Database connection
 * @param {number} articleId - Article ID
 * @param {string} content - Article content to update
 * @returns {Promise<boolean>} Success status
 */
async function updateArticleContent(db, articleId, content) {
  if (!db || !articleId) {
    console.error('Invalid database connection or article ID');
    return false;
  }
  
  try {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE articles SET content = ? WHERE id = ?',
        [content, articleId],
        (err) => {
          if (err) {
            console.error(`Error updating article content:`, err);
            reject(err);
            return false;
          } else {
            console.log(`Updated content for article ${articleId} (${content.length} characters)`);
            resolve(true);
            return true;
          }
        }
      );
    });
  } catch (error) {
    console.error(`Error in updateArticleContent: ${error.message}`);
    return false;
  }
}

/**
 * Update politician mentions for an article
 * @param {Object} db - Database connection
 * @param {number} articleId - Article ID 
 * @param {Array} politicians - Array of politician names
 * @returns {Promise<Object>} Result with counts of operations
 */
async function updatePoliticianMentions(db, articleId, politicians) {
  if (!db || !articleId || !politicians || politicians.length === 0) {
    return { added: 0, deleted: 0 };
  }
  
  try {
    // First verify that the article exists
    const articleExists = await new Promise((resolve, reject) => {
      db.get('SELECT 1 FROM articles WHERE id = ?', [articleId], (err, row) => {
        if (err) {
          console.error(`Error checking if article ${articleId} exists:`, err);
          reject(err);
        } else {
          resolve(!!row);
        }
      });
    });
    
    if (!articleExists) {
      console.error(`Cannot update politician mentions: Article ${articleId} does not exist`);
      return { added: 0, deleted: 0 };
    }
    
    // Get existing mentions
    const existingMentions = await new Promise((resolve, reject) => {
      db.all(
        'SELECT politicianName FROM politician_mentions WHERE articleId = ?',
        [articleId],
        (err, rows) => {
          if (err) {
            console.error(`Error getting existing mentions for article ${articleId}:`, err);
            reject(err);
          } else {
            resolve(rows ? rows.map(row => row.politicianName) : []);
          }
        }
      );
    });
    
    // Find mentions to add (new ones) and delete (old ones that are no longer detected)
    const newMentions = politicians.filter(p => !existingMentions.includes(p));
    const mentionsToDelete = existingMentions.filter(p => !politicians.includes(p));
    
    // Delete old mentions
    if (mentionsToDelete.length > 0) {
      await Promise.all(mentionsToDelete.map(politician => {
        return new Promise((resolve, reject) => {
          db.run(
            'DELETE FROM politician_mentions WHERE articleId = ? AND politicianName = ?',
            [articleId, politician],
            (err) => {
              if (err) {
                console.error(`Error deleting mention of ${politician} for article ${articleId}:`, err);
                reject(err);
              } else {
                resolve();
              }
            }
          );
        });
      }));
    }
    
    // Add new mentions
    if (newMentions.length > 0) {
      await Promise.all(newMentions.map(politician => {
        return new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO politician_mentions (articleId, politicianName) VALUES (?, ?)',
            [articleId, politician],
            (err) => {
              if (err) {
                console.error(`Error adding mention of ${politician} for article ${articleId}:`, err);
                reject(err);
              } else {
                resolve();
              }
            }
          );
        });
      }));
    }
    
    return {
      added: newMentions.length,
      deleted: mentionsToDelete.length
    };
  } catch (error) {
    console.error(`Error updating politician mentions for article ${articleId}:`, error);
    return { added: 0, deleted: 0, error: error.message };
  }
}

module.exports = {
  loadPoliticians,
  updateArticleContent,
  updatePoliticianMentions
}; 