/**
 * Check Walla articles in database
 * 
 * This script helps diagnose why no Walla articles appear in the API response
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Try to locate the active database file
const possibleDatabasePaths = [
  path.join(__dirname, 'articles.db'),
  path.join(__dirname, '..', 'articles.db')
];

let dbPath = null;
for (const path of possibleDatabasePaths) {
  if (fs.existsSync(path)) {
    const stats = fs.statSync(path);
    if (stats.size > 0) {
      dbPath = path;
      break;
    }
  }
}

if (!dbPath) {
  console.error('No valid database file found. Checked paths:', possibleDatabasePaths);
  process.exit(1);
}

// Open database connection
let db;
try {
  db = new sqlite3.Database(dbPath);
  console.log(`Connected to database at ${dbPath}`);
} catch (error) {
  console.error('Error connecting to database:', error);
  process.exit(1);
}

// Check database schema first
async function checkSchema() {
  const tables = await new Promise((resolve, reject) => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(row => row.name));
    });
  });
  
  console.log('\nTables in database:');
  tables.forEach(tableName => {
    console.log(`- ${tableName}`);
  });
  
  if (!tables.includes('articles')) {
    throw new Error('Articles table not found in the database. This may be an empty or incorrect database file.');
  }
  
  return tables;
}

// Check for Walla articles
async function checkWallaArticles() {
  // First check schema
  const tables = await checkSchema();
  
  // 1. Count total articles
  const totalCount = await new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM articles', (err, row) => {
      if (err) reject(err);
      else resolve(row.count);
    });
  });
  
  console.log(`\nTotal articles in database: ${totalCount}`);
  
  // 2. Count articles by source
  const sourceCounts = await new Promise((resolve, reject) => {
    db.all('SELECT source, COUNT(*) as count FROM articles GROUP BY source ORDER BY count DESC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  
  console.log('\nArticles by source:');
  sourceCounts.forEach(row => {
    console.log(`${row.source}: ${row.count}`);
  });
  
  // 3. Check specifically for Walla articles
  const wallaArticles = await new Promise((resolve, reject) => {
    db.all("SELECT id, title, source, publishedAt FROM articles WHERE source LIKE '%Walla%' ORDER BY publishedAt DESC LIMIT 10", (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  
  console.log('\nLatest Walla articles (if any):');
  if (wallaArticles.length === 0) {
    console.log('No Walla articles found in the database.');
  } else {
    wallaArticles.forEach(article => {
      console.log(`ID: ${article.id}, Published: ${article.publishedAt}, Source: ${article.source}, Title: ${article.title}`);
    });
  }
  
  // 4. Check recent articles regardless of source
  const recentArticles = await new Promise((resolve, reject) => {
    db.all("SELECT id, title, source, publishedAt FROM articles ORDER BY publishedAt DESC LIMIT 10", (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  
  console.log('\nMost recent articles in database:');
  recentArticles.forEach(article => {
    console.log(`ID: ${article.id}, Published: ${article.publishedAt}, Source: ${article.source}, Title: ${article.title}`);
  });
  
  // Check articles by date range
  const articlesLastWeek = await new Promise((resolve, reject) => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const dateStr = oneWeekAgo.toISOString().split('T')[0];
    
    db.all(`SELECT source, COUNT(*) as count FROM articles WHERE publishedAt > '${dateStr}' GROUP BY source ORDER BY count DESC`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  
  console.log('\nArticles from the last week by source:');
  articlesLastWeek.forEach(row => {
    console.log(`${row.source}: ${row.count}`);
  });
  
  // 5. Check if Walla sources exist in feed or scrape queue
  const pendingFeeds = await new Promise((resolve, reject) => {
    db.all("SELECT * FROM pending_feeds WHERE url LIKE '%walla%'", (err, rows) => {
      if (err && err.message.includes('no such table')) {
        resolve([]);
      } else if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
  
  console.log('\nPending Walla feeds (if table exists):');
  if (pendingFeeds.length === 0) {
    console.log('No pending Walla feeds found (or table does not exist).');
  } else {
    pendingFeeds.forEach(feed => {
      console.log(feed);
    });
  }
  
  // Close the database connection
  db.close();
}

// Run the check
checkWallaArticles().catch(error => {
  console.error('Error:', error);
  if (db) db.close();
}); 