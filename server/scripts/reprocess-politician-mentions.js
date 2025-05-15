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

console.log(`Loaded ${POLITICIANS.length} politicians for detection`);
// Log first 5 politicians with their aliases for debugging
console.log('Sample politicians data:');
for (let i = 0; i < Math.min(5, POLITICIANS.length); i++) {
  console.log(`- ${POLITICIANS[i].he} (Aliases: ${POLITICIANS[i].aliases.join(', ') || 'none'})`);
}

// Database path - look in root directory instead of server directory
const DB_PATH = path.join(__dirname, '../../articles.db');
console.log(`Using database at: ${DB_PATH}`);

// Check if database file exists
if (!fs.existsSync(DB_PATH)) {
  console.error(`Database file doesn't exist at ${DB_PATH}`);
  console.log('Available files in directory:');
  const dir = path.dirname(DB_PATH);
  fs.readdirSync(dir).forEach(file => {
    if (file.endsWith('.db')) {
      console.log(`- ${file} (database file)`);
    }
  });
}

const db = new sqlite3.Database(DB_PATH);

// Helper function to escape regular expression special characters
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Find politician mentions in text
const findPoliticianMentions = (text, articleId) => {
  if (!text) return [];
  
  console.log(`Article ${articleId} text (first 100 chars): "${text.substring(0, 100)}..."`);
  
  // Convert text to lowercase for case-insensitive comparison
  const textLower = text.toLowerCase();
  const found = [];
  
  // Debug output of a few politicians
  console.log('Search for politicians:', POLITICIANS.slice(0, 5).map(p => p.he).join(', '));
  
  POLITICIANS.forEach(politician => {
    // More accurate detection with word boundary checks
    const hePattern = escapeRegExp(politician.he.toLowerCase());
    const enPattern = escapeRegExp(politician.en.toLowerCase());
    
    console.log(`Trying to find politician: "${politician.he}"`);
    
    // Check for exact name match first (without word boundaries for Hebrew)
    if (textLower.includes(politician.he.toLowerCase())) {
      console.log(`DIRECT MATCH: Found politician "${politician.he}" in text (simple contains)`);
      found.push(politician.he);
      return;
    }
    
    // More accurate detection with word boundary checks
    const heNamePattern = new RegExp(`\\b${hePattern}\\b`, 'u');
    const enNamePattern = new RegExp(`\\b${enPattern}\\b`, 'i');
    
    // Check main names
    if (heNamePattern.test(textLower)) {
      console.log(`Article ${articleId}: Found politician "${politician.he}" in text (Hebrew name match)`);
      found.push(politician.he);
      return;
    }
    
    if (enNamePattern.test(textLower)) {
      console.log(`Article ${articleId}: Found politician "${politician.he}" in text (English name match)`);
      found.push(politician.he);
      return;
    }
    
    // Check aliases if any
    if (politician.aliases && politician.aliases.length > 0) {
      for (const alias of politician.aliases) {
        // Skip empty aliases
        if (!alias || alias.trim() === '') continue;
        
        // Simple contains check
        if (textLower.includes(alias.toLowerCase())) {
          console.log(`DIRECT MATCH: Found politician "${politician.he}" in text (simple alias contains: "${alias}")`);
          found.push(politician.he);
          return;
        }
        
        // Regex check with word boundaries
        const aliasPattern = new RegExp(`\\b${escapeRegExp(alias.toLowerCase())}\\b`, 'u');
        if (aliasPattern.test(textLower)) {
          console.log(`Article ${articleId}: Found politician "${politician.he}" in text (Alias match: "${alias}")`);
          found.push(politician.he);
          return;
        }
      }
    }
  });
  
  return [...new Set(found)]; // Return unique politicians
};

// Initialize database with necessary tables
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    console.log('Initializing database...');
    
    // Create articles table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      content TEXT,
      link TEXT UNIQUE,
      imageUrl TEXT,
      source TEXT NOT NULL,
      publishedAt TEXT NOT NULL,
      guid TEXT UNIQUE,
      createdAt TEXT NOT NULL,
      summary TEXT
    )`, (err) => {
      if (err) {
        return reject(err);
      }
      
      console.log('Ensured articles table exists');
      
      // Create politician_mentions table if it doesn't exist
      db.run(`CREATE TABLE IF NOT EXISTS politician_mentions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        articleId INTEGER,
        politicianName TEXT NOT NULL,
        FOREIGN KEY (articleId) REFERENCES articles(id)
      )`, (err) => {
        if (err) {
          return reject(err);
        }
        console.log('Ensured politician_mentions table exists');
        resolve();
      });
    });
  });
};

// List available tables in the database
const listTables = () => {
  return new Promise((resolve, reject) => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
      if (err) {
        return reject(err);
      }
      console.log('Available tables in the database:');
      if (rows.length === 0) {
        console.log('No tables found in the database.');
      } else {
        rows.forEach(row => {
          console.log(`- ${row.name}`);
        });
      }
      resolve(rows.map(row => row.name));
    });
  });
};

// Create sample test article if no articles exist
const createSampleArticle = async () => {
  // Check if there are any articles
  const count = await new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM articles', (err, row) => {
      if (err) {
        // Table might not exist
        resolve(0);
      } else {
        resolve(row ? row.count : 0);
      }
    });
  });
  
  if (count > 0) {
    console.log(`Database already has ${count} articles, skipping sample creation`);
    return;
  }
  
  console.log('No articles found, creating a sample test article with politician mentions...');
  
  const sampleArticle = {
    title: 'ראש הממשלה בנימין נתניהו בפגישה עם שר הביטחון יואב גלנט',
    description: 'פגישה בין ראש הממשלה ושר הביטחון התקיימה אתמול לדיון במצב הביטחוני',
    content: 'ראש הממשלה בנימין נתניהו קיים פגישה עם שר הביטחון יואב גלנט. בפגישה נכחו גם שר האוצר בצלאל סמוטריץ\' ושר החוץ ישראל כץ.',
    link: 'https://example.com/test-article',
    imageUrl: 'https://example.com/images/test.jpg',
    source: 'Test Source',
    publishedAt: new Date().toISOString(),
    guid: 'test-article-1',
    createdAt: new Date().toISOString(),
    summary: ''
  };
  
  // Insert the sample article
  await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO articles (title, description, content, link, imageUrl, source, publishedAt, guid, createdAt, summary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sampleArticle.title,
        sampleArticle.description,
        sampleArticle.content,
        sampleArticle.link,
        sampleArticle.imageUrl,
        sampleArticle.source,
        sampleArticle.publishedAt,
        sampleArticle.guid,
        sampleArticle.createdAt,
        sampleArticle.summary
      ],
      function(err) {
        if (err) {
          return reject(err);
        }
        console.log(`Created sample article with ID ${this.lastID}`);
        resolve(this.lastID);
      }
    );
  });
  
  console.log('Sample article created successfully');
};

// Reprocess all articles for politician mentions
const reprocessArticles = async () => {
  console.log('Started reprocessing articles for politician mentions');
  
  try {
    // List tables first to understand the database schema
    await listTables();
    
    // Initialize database tables
    await initDatabase();
    
    // Create sample article if needed
    await createSampleArticle();
    
    // Clear existing mentions
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM politician_mentions', (err) => {
        if (err) {
          console.error('Error clearing existing mentions:', err);
          reject(err);
        } else {
          console.log('Cleared existing politician mentions');
          resolve();
        }
      });
    });
    
    // Get all articles
    const articles = await new Promise((resolve, reject) => {
      db.all('SELECT id, title, description, content FROM articles', (err, rows) => {
        if (err) {
          console.error('Error fetching articles:', err);
          reject(err);
        } else {
          console.log(`Found ${rows.length} articles to process`);
          resolve(rows);
        }
      });
    });
    
    // Process each article
    let totalMentions = 0;
    let articlesWithMentions = 0;
    
    for (const article of articles) {
      const combinedText = [article.title, article.description, article.content]
        .filter(text => text && text.trim().length > 0)
        .join(' ');
      
      console.log(`Processing article ${article.id}: "${article.title && article.title.substring(0, 30)}..."`);
      
      const mentions = findPoliticianMentions(combinedText, article.id);
      
      if (mentions.length > 0) {
        articlesWithMentions++;
        
        // Create values string for SQL INSERT
        const mentionValues = mentions.map(name => 
          `(${article.id}, '${name.replace(/'/g, "''")}')`
        ).join(',');
        
        // Insert new mentions
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO politician_mentions (articleId, politicianName) VALUES ${mentionValues}`,
            (err) => {
              if (err) {
                console.error(`Error inserting politician mentions for article ${article.id}:`, err);
                reject(err);
              } else {
                console.log(`Added ${mentions.length} politician mentions for article ${article.id}: ${mentions.join(', ')}`);
                totalMentions += mentions.length;
                resolve();
              }
            }
          );
        });
      } else {
        console.log(`No politicians found in article ${article.id}`);
      }
    }
    
    console.log(`Reprocessing complete!`);
    console.log(`Results: Found ${totalMentions} politician mentions across ${articlesWithMentions} articles (out of ${articles.length} total)`);
  } catch (error) {
    console.error('Error reprocessing articles:', error);
  } finally {
    db.close();
  }
};

// Execute the reprocessing
reprocessArticles(); 