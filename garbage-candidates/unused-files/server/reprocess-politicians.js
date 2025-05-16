// A script to reprocess all articles for politician detection
// Run with: node reprocess-politicians.js

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

// Format for detection (Hebrew name and possible English translation)
const POLITICIANS = POLITICIANS_LIST.map(p => {
  // Default English translation (for now, just use the same name)
  const enName = p.name;
  return { he: p.name, en: enName, aliases: p.aliases || [] };
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
      const text = [article.title, article.description, article.content].filter(Boolean).join(' ');
      const politicians = findPoliticianMentions(text);
      
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
  } catch (error) {
    console.error('Error reprocessing articles:', error);
  } finally {
    db.close();
  }
};

// Run the script
reprocessAllArticles(); 