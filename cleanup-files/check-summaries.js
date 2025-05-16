// Script to check if articles have summaries in the database
const sqlite3 = require('sqlite3').verbose();

// Connect to the database - use the server data path
const DB_PATH = './server/data/news.db';
const db = new sqlite3.Database(DB_PATH);

// Query to get all articles with summaries
console.log('Checking for articles with summaries...');
db.all(`SELECT id, title, summary FROM articles 
       WHERE summary IS NOT NULL AND summary != '' AND summary != 'Summarization is disabled (API key not configured)'
       LIMIT 10`, (err, rows) => {
  if (err) {
    console.error('Error querying database:', err);
    return;
  }
  
  console.log(`Found ${rows.length} articles with proper summaries`);
  
  // Display the articles with summaries
  rows.forEach(row => {
    console.log('----------------------------');
    console.log(`ID: ${row.id}`);
    console.log(`Title: ${row.title}`);
    console.log(`Summary: ${row.summary}`);
  });
  
  // If we didn't find any articles with proper summaries, let's check those with the disabled message
  if (rows.length === 0) {
    console.log('\nChecking for articles with disabled summarization message...');
    db.all(`SELECT id, title, summary FROM articles 
           WHERE summary = 'Summarization is disabled (API key not configured)'
           LIMIT 3`, (err, disabledRows) => {
      if (err) {
        console.error('Error querying database:', err);
        db.close();
        return;
      }
      
      console.log(`Found ${disabledRows.length} articles with disabled summarization message`);
      
      disabledRows.forEach(row => {
        console.log('----------------------------');
        console.log(`ID: ${row.id}`);
        console.log(`Title: ${row.title}`);
        console.log(`Summary: ${row.summary}`);
      });
      
      // Now check for articles without any summary
      db.get(`SELECT COUNT(*) as count FROM articles WHERE summary IS NULL OR summary = ''`, (err, row) => {
        if (err) {
          console.error('Error querying database:', err);
          db.close();
          return;
        }
        
        console.log(`\nFound ${row.count} articles without any summary`);
        
        // Close the database connection
        db.close();
      });
    });
  } else {
    // Close the database connection
    db.close();
  }
}); 