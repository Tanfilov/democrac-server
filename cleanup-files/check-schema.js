// Script to check the database schema
const sqlite3 = require('sqlite3').verbose();

// Connect to the database
const DB_PATH = './server/data/news.db';
const db = new sqlite3.Database(DB_PATH);

// Check table schema for articles table
db.all(`PRAGMA table_info(articles)`, (err, rows) => {
  if (err) {
    console.error('Error querying database schema:', err);
    return;
  }
  
  console.log('Articles table schema:');
  rows.forEach(column => {
    console.log(`${column.cid}. ${column.name} (${column.type})`);
  });
  
  // Close the database connection
  db.close();
}); 