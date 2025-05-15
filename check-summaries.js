// Script to check if articles have summaries in the database
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to the database - use the correct path
const DB_PATH = './server/data/news.db';
const db = new sqlite3.Database(DB_PATH);

// Query to get all articles with summaries
db.all(`SELECT id, title, summary FROM articles WHERE summary IS NOT NULL AND summary != ''`, (err, rows) => {
  if (err) {
    console.error('Error querying database:', err);
    return;
  }
  
  console.log(`Found ${rows.length} articles with summaries`);
  
  // Display the first 5 articles with summaries
  rows.slice(0, 5).forEach(row => {
    console.log('----------------------------');
    console.log(`ID: ${row.id}`);
    console.log(`Title: ${row.title}`);
    console.log(`Summary: ${row.summary ? row.summary.slice(0, 100) + '...' : 'NULL'}`);
  });
  
  // Now check articles without summaries
  db.get(`SELECT COUNT(*) as count FROM articles WHERE summary IS NULL OR summary = ''`, (err, row) => {
    if (err) {
      console.error('Error querying database:', err);
      return;
    }
    
    console.log(`\nFound ${row.count} articles without summaries`);
    
    // Close the database connection
    db.close();
  });
}); 