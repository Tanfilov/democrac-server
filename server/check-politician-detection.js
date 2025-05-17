/**
 * Utility script to check for articles with missing politician detection 
 * This is helpful for diagnosing issues with the politician detection system
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

// Set path to database
const DB_PATH = process.env.DB_PATH || './data/news.db';
console.log(`Using database at: ${DB_PATH}`);

// Connect to the database
const db = new sqlite3.Database(DB_PATH);

// Enable foreign key constraints
db.run('PRAGMA foreign_keys = ON', err => {
  if (err) {
    console.error('Error enabling foreign key constraints:', err);
  } else {
    console.log('Foreign key constraints enabled');
  }
});

// Main function to check politician detection
async function checkPoliticianDetection() {
  try {
    console.log("Checking for articles with potential missing politician mentions...");
    
    // Get total number of articles
    const totalArticles = await getArticleCount();
    console.log(`Total articles in database: ${totalArticles}`);

    // Check for articles with Netanyahu in title/description but missing from mentions
    const netanyahuMissingArticles = await getArticlesWithoutPolitician('נתניהו', 'בנימין נתניהו');
    console.log(`\nFound ${netanyahuMissingArticles.length} articles with Netanyahu in title/description but not in mentions:`);
    
    netanyahuMissingArticles.forEach(article => {
      console.log(`\nArticle #${article.id}: ${article.title.substring(0, 80)}${article.title.length > 80 ? '...' : ''}`);
      console.log(`- Contains 'נתניהו': ${article.title.includes('נתניהו') || article.description.includes('נתניהו') ? 'YES' : 'NO'}`);
      console.log(`- Contains 'ביבי': ${article.title.includes('ביבי') || article.description.includes('ביבי') ? 'YES' : 'NO'}`);
      console.log(`- Contains 'בנימין': ${article.title.includes('בנימין') || article.description.includes('בנימין') ? 'YES' : 'NO'}`);
      console.log(`- Current mentions: ${article.politicianMentions ? article.politicianMentions.join(', ') : 'None'}`);
    });
    
    // Check for articles with Lapid in title/description but missing from mentions
    const lapidMissingArticles = await getArticlesWithoutPolitician('לפיד', 'יאיר לפיד');
    console.log(`\nFound ${lapidMissingArticles.length} articles with Lapid in title/description but not in mentions:`);
    
    lapidMissingArticles.forEach(article => {
      console.log(`\nArticle #${article.id}: ${article.title.substring(0, 80)}${article.title.length > 80 ? '...' : ''}`);
      console.log(`- Contains 'לפיד': ${article.title.includes('לפיד') || article.description.includes('לפיד') ? 'YES' : 'NO'}`);
      console.log(`- Contains 'יאיר': ${article.title.includes('יאיר') || article.description.includes('יאיר') ? 'YES' : 'NO'}`);
      console.log(`- Current mentions: ${article.politicianMentions ? article.politicianMentions.join(', ') : 'None'}`);
    });
    
    // Check for any articles with 'נתניהו' in the content
    console.log("\nChecking specific problematic articles...");
    await checkSpecificArticle(93);
  } catch (error) {
    console.error('Error checking politician detection:', error);
  } finally {
    // Close database connection
    db.close();
  }
}

// Helper function to get article count
function getArticleCount() {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM articles', (err, row) => {
      if (err) reject(err);
      else resolve(row.count);
    });
  });
}

// Get articles that mention a politician in title/description but don't have them in mentions
async function getArticlesWithoutPolitician(searchTerm, politicianName) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT a.id, a.title, a.description, GROUP_CONCAT(pm.politicianName) as mentionedPoliticians
      FROM articles a
      LEFT JOIN politician_mentions pm ON a.id = pm.articleId
      WHERE (a.title LIKE '%${searchTerm}%' OR a.description LIKE '%${searchTerm}%')
      GROUP BY a.id
      HAVING mentionedPoliticians IS NULL OR mentionedPoliticians NOT LIKE '%${politicianName}%'
    `;
    
    db.all(query, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Process results to add politician mentions array
      const articles = rows.map(row => ({
        id: row.id,
        title: row.title,
        description: row.description,
        politicianMentions: row.mentionedPoliticians ? row.mentionedPoliticians.split(',') : []
      }));
      
      resolve(articles);
    });
  });
}

// Check a specific article by ID
async function checkSpecificArticle(articleId) {
  return new Promise((resolve, reject) => {
    // Get the article and its mentions
    db.get(`
      SELECT a.id, a.title, a.description, a.content, GROUP_CONCAT(pm.politicianName) as mentionedPoliticians
      FROM articles a
      LEFT JOIN politician_mentions pm ON a.id = pm.articleId
      WHERE a.id = ?
      GROUP BY a.id
    `, [articleId], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!row) {
        console.log(`Article #${articleId} not found`);
        resolve();
        return;
      }
      
      // Process article details
      const article = {
        id: row.id,
        title: row.title,
        description: row.description,
        content: row.content,
        politicianMentions: row.mentionedPoliticians ? row.mentionedPoliticians.split(',') : []
      };
      
      console.log(`\nDETAILED CHECK: Article #${article.id}`);
      console.log(`Title: ${article.title}`);
      console.log(`Description: ${article.description.substring(0, 100)}${article.description.length > 100 ? '...' : ''}`);
      console.log(`Current mentions: ${article.politicianMentions.length > 0 ? article.politicianMentions.join(', ') : 'None'}`);
      
      // Do detailed detection checks
      console.log('\nDetection checks:');
      console.log(`- Title contains 'נתניהו': ${article.title.includes('נתניהו') ? 'YES' : 'NO'}`);
      console.log(`- Title contains 'ביבי': ${article.title.includes('ביבי') ? 'YES' : 'NO'}`);
      console.log(`- Title contains 'בנימין': ${article.title.includes('בנימין') ? 'YES' : 'NO'}`);
      console.log(`- Description contains 'נתניהו': ${article.description.includes('נתניהו') ? 'YES' : 'NO'}`);
      console.log(`- Description contains 'ביבי': ${article.description.includes('ביבי') ? 'YES' : 'NO'}`);
      console.log(`- Description contains 'בנימין': ${article.description.includes('בנימין') ? 'YES' : 'NO'}`);
      
      resolve();
    });
  });
}

// Run the main function
checkPoliticianDetection().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 