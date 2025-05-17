/**
 * Check Walla articles in database
 * 
 * This script helps diagnose why no Walla articles appear in the API response
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Open database connection - use root database
let db;
const rootDbPath = path.join(__dirname, '..', 'articles.db');

try {
  if (fs.existsSync(rootDbPath)) {
    db = new sqlite3.Database(rootDbPath);
    console.log(`Connected to root database at ${rootDbPath}`);
  } else {
    console.error(`Database not found at ${rootDbPath}`);
    process.exit(1);
  }
} catch (error) {
  console.error('Error connecting to database:', error);
  process.exit(1);
}

// Check for Walla articles
async function checkWallaArticles() {
  // 1. Count total articles
  const totalCount = await new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM articles', (err, row) => {
      if (err) reject(err);
      else resolve(row.count);
    });
  });
  
  console.log(`Total articles in database: ${totalCount}`);
  
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
  
  // 5. Check the database schema to understand its structure
  const tables = await new Promise((resolve, reject) => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  
  console.log('\nTables in database:');
  tables.forEach(table => {
    console.log(table.name);
  });
  
  // Close the database connection
  db.close();
}

// Run the check
checkWallaArticles().catch(error => {
  console.error('Error:', error);
  db.close();
}); 