/**
 * Script to reset and reprocess all politician mentions in the database
 * using the improved detection algorithm
 */

// Load environment variables
require('dotenv').config();

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Database path
const DB_PATH = process.env.DB_PATH || '../data/news.db';

console.log(`Using database: ${DB_PATH}`);

// Initialize SQLite database
const db = new sqlite3.Database(DB_PATH);

// Load politicians from JSON file
const POLITICIANS_DATA_PATH = path.join(__dirname, '../data/politicians/politicians.json');
let POLITICIANS_LIST = [];

try {
  const data = fs.readFileSync(POLITICIANS_DATA_PATH, 'utf8');
  POLITICIANS_LIST = JSON.parse(data);
  console.log(`Loaded ${POLITICIANS_LIST.length} politicians for detection`);
} catch (error) {
  console.error(`Error loading politicians data from ${POLITICIANS_DATA_PATH}:`, error);
  process.exit(1);
}

// Format for detection
const POLITICIANS = POLITICIANS_LIST.map(p => {
  return { he: p.name, aliases: p.aliases || [] };
});

// Function to reset politician mentions table
const resetPoliticianMentions = () => {
  return new Promise((resolve, reject) => {
    console.log('Clearing all politician mentions...');
    db.run('DELETE FROM politician_mentions', (err) => {
      if (err) {
        console.error('Error clearing politician mentions:', err);
        reject(err);
      } else {
        console.log('All politician mentions cleared successfully');
        resolve();
      }
    });
  });
};

// Helper function to check for exact word matches with Hebrew prefixes
function isExactMatch(text, word, boundaries) {
  if (!text.includes(word)) return false;
  
  const indexes = [];
  let index = text.indexOf(word);
  
  while (index !== -1) {
    indexes.push(index);
    index = text.indexOf(word, index + 1);
  }
  
  for (const index of indexes) {
    const beforeChar = index === 0 ? ' ' : text[index - 1];
    const afterChar = index + word.length >= text.length ? ' ' : text[index + word.length];
    
    if ((boundaries.includes(beforeChar) || index === 0) && 
        (boundaries.includes(afterChar) || index + word.length === text.length)) {
      return true;
    }
  }
  
  return false;
}

// Function to detect politicians in text with improved algorithm
const findPoliticianMentions = (text) => {
  if (!text) return [];
  
  // Hebrew prefixes that might appear before names
  const prefixes = ['', 'ל', 'מ', 'ב', 'ו', 'ש', 'ה'];
  const wordBoundaries = [' ', '.', ',', ':', ';', '?', '!', '"', "'", '(', ')', '[', ']', '{', '}', '\n', '\t'];
  
  const mentions = [];
  
  // For each politician
  for (const politician of POLITICIANS) {
    const politicianName = politician.he;
    let detected = false;
    
    // Check full name with possible prefixes
    for (const prefix of prefixes) {
      const nameWithPrefix = prefix + politicianName;
      if (isExactMatch(text, nameWithPrefix, wordBoundaries)) {
        mentions.push(politicianName);
        detected = true;
        break;
      }
    }
    
    // If detected by full name, continue to next politician
    if (detected) continue;
    
    // Check aliases
    if (politician.aliases && politician.aliases.length > 0) {
      for (const alias of politician.aliases) {
        if (alias.length < 3) continue; // Skip very short aliases
        
        for (const prefix of prefixes) {
          const aliasWithPrefix = prefix + alias;
          if (isExactMatch(text, aliasWithPrefix, wordBoundaries)) {
            mentions.push(politicianName);
            detected = true;
            break;
          }
        }
        if (detected) break;
      }
    }
  }
  
  return [...new Set(mentions)]; // Remove duplicates
};

// Function to update politician mentions for an article
const updatePoliticianMentions = (articleId, politicians) => {
  if (!articleId || !politicians || politicians.length === 0) return Promise.resolve();
  
  // Create values string for SQL INSERT
  const mentionValues = politicians.map(name => 
    `(${articleId}, '${name.replace(/'/g, "''")}')`
  ).join(',');
  
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO politician_mentions (articleId, politicianName) VALUES ${mentionValues}`,
      (err) => {
        if (err) {
          console.error(`Error inserting politician mentions for article ${articleId}:`, err);
          reject(err);
        } else {
          console.log(`Added ${politicians.length} politician mentions for article ${articleId}`);
          resolve();
        }
      }
    );
  });
};

// Function to process a batch of articles
const processBatch = async (articles) => {
  for (const article of articles) {
    try {
      // Combine all text fields
      const combinedText = [article.title, article.description, article.content].filter(Boolean).join(' ');
      
      // Detect politicians with improved algorithm
      const politicians = findPoliticianMentions(combinedText);
      
      if (politicians.length > 0) {
        console.log(`Article ID ${article.id}: Found politicians: ${politicians.join(', ')}`);
        await updatePoliticianMentions(article.id, politicians);
      } else {
        console.log(`Article ID ${article.id}: No politicians found`);
      }
    } catch (error) {
      console.error(`Error processing article ${article.id}:`, error);
    }
  }
};

// Main function to reprocess all articles
const reprocessAllArticles = async () => {
  try {
    // Reset politician mentions table
    await resetPoliticianMentions();
    
    // Get all articles from database
    const articles = await new Promise((resolve, reject) => {
      db.all('SELECT id, title, description, content FROM articles', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
    
    console.log(`Found ${articles.length} articles to process`);
    
    // Process in batches of 10
    const batchSize = 10;
    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(articles.length/batchSize)}`);
      await processBatch(batch);
    }
    
    console.log('All articles have been processed');
    console.log('Testing the API to verify politician mentions are correct...');
    
    // Get articles with politicians to verify
    db.all(
      `SELECT a.id, a.title, GROUP_CONCAT(pm.politicianName) as mentionedPoliticians 
       FROM articles a 
       JOIN politician_mentions pm ON a.id = pm.articleId 
       GROUP BY a.id 
       LIMIT 5`,
      (err, rows) => {
        if (err) {
          console.error('Error verifying results:', err);
        } else {
          console.log('Sample articles with politician mentions:');
          rows.forEach(row => {
            console.log(`- Article ${row.id}: "${row.title.substring(0, 50)}..."`);
            console.log(`  Politicians: ${row.mentionedPoliticians}`);
          });
        }
        
        // Close database
        db.close();
      }
    );
  } catch (error) {
    console.error('Error reprocessing articles:', error);
    db.close();
  }
};

// Run the script
console.log('Starting the politician detection reprocessing...');
reprocessAllArticles(); 