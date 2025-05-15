/**
 * Script to reprocess all articles for politician mentions
 * This will use the updated POLITICIANS list to detect mentions in all articles
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Load politicians from JSON file
const POLITICIANS_DATA = fs.readFileSync(path.join(__dirname, '../../data/politicians/politicians.json'), 'utf8');
const POLITICIANS_LIST = JSON.parse(POLITICIANS_DATA);

// Format for detection (Hebrew name and possible English translation)
const POLITICIANS = POLITICIANS_LIST.map(p => {
  return { he: p.name, en: p.name, aliases: p.aliases || [] };
});

// Database path
const DB_PATH = path.join(__dirname, '../articles.db');
const db = new sqlite3.Database(DB_PATH);

// Helper function to escape regular expression special characters
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Find politician mentions in text
const findPoliticianMentions = (text) => {
  if (!text) return [];
  
  // Convert text to lowercase for case-insensitive comparison
  const textLower = text.toLowerCase();
  
  return POLITICIANS.filter(politician => {
    // More accurate detection with word boundary checks
    const heNamePattern = new RegExp(`\\b${escapeRegExp(politician.he.toLowerCase())}\\b`, 'u');
    const enNamePattern = new RegExp(`\\b${escapeRegExp(politician.en.toLowerCase())}\\b`, 'i');
    
    // Check main names
    if (heNamePattern.test(textLower) || enNamePattern.test(textLower)) {
      return true;
    }
    
    // Check aliases if any
    if (politician.aliases && politician.aliases.length > 0) {
      return politician.aliases.some(alias => {
        const aliasPattern = new RegExp(`\\b${escapeRegExp(alias.toLowerCase())}\\b`, 'u');
        return aliasPattern.test(textLower);
      });
    }
    
    return false;
  }).map(p => p.he);
};

// Update politician mentions for an article
const updatePoliticianMentions = async (articleId, politicians) => {
  if (!articleId || !politicians || politicians.length === 0) return;
  
  try {
    // Clear existing mentions for this article
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM politician_mentions WHERE articleId = ?', [articleId], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
    
    // Insert new mentions
    const mentionValues = politicians.map(name => 
      `(${articleId}, '${name.replace(/'/g, "''")}')`
    ).join(',');
    
    if (mentionValues.length > 0) {
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO politician_mentions (articleId, politicianName) VALUES ${mentionValues}`,
          (err) => {
            if (err) {
              console.error('Error inserting politician mentions:', err);
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });
    }
    
    return politicians.length;
  } catch (error) {
    console.error(`Error updating politician mentions: ${error.message}`);
    return 0;
  }
};

// Process articles to detect politicians
const processArticles = async () => {
  console.log('Starting to reprocess all articles for politician mentions...');
  
  try {
    // Get all articles
    const articles = await new Promise((resolve, reject) => {
      db.all('SELECT id, title, description, content FROM articles', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
    
    console.log(`Found ${articles.length} articles to process`);
    
    let politicianMentionCount = 0;
    
    // Process each article
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      
      // Detect politicians in article
      const detectedPoliticians = new Set();
      
      // Check title
      if (article.title) {
        findPoliticianMentions(article.title).forEach(p => detectedPoliticians.add(p));
      }
      
      // Check description
      if (article.description) {
        findPoliticianMentions(article.description).forEach(p => detectedPoliticians.add(p));
      }
      
      // Check content
      if (article.content) {
        findPoliticianMentions(article.content).forEach(p => detectedPoliticians.add(p));
      }
      
      // Update mentions in database
      const politicians = Array.from(detectedPoliticians);
      if (politicians.length > 0) {
        const count = await updatePoliticianMentions(article.id, politicians);
        politicianMentionCount += count;
        console.log(`Article ID ${article.id}: Found ${politicians.length} politicians: ${politicians.join(', ')}`);
      }
      
      // Progress report
      if (i % 10 === 0) {
        console.log(`Processed ${i + 1}/${articles.length} articles...`);
      }
    }
    
    console.log(`\nCompleted processing ${articles.length} articles.`);
    console.log(`Found a total of ${politicianMentionCount} politician mentions.`);
    
  } catch (error) {
    console.error('Error processing articles:', error);
  } finally {
    db.close();
  }
};

// Run the script
processArticles().then(() => {
  console.log('Script completed.');
}).catch(err => {
  console.error('Script failed:', err);
}); 