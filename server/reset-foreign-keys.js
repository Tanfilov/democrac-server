// Script to reset foreign key constraints and clean the database
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

// DB Path - set to the same path as in the main app
const DB_PATH = process.env.DB_PATH || './data/news.db';
console.log(`Using database at: ${DB_PATH}`);

// Connect to the database
const db = new sqlite3.Database(DB_PATH);

// Main function
async function resetDatabase() {
  try {
    // Step 1: Check current foreign key status
    const fkStatus = await getForeignKeyStatus();
    console.log(`Current foreign key status: ${fkStatus ? 'ENABLED' : 'DISABLED'}`);

    // Step 2: Get stats before cleanup
    const beforeStats = await getStats();
    console.log(`\nBefore cleanup:`);
    console.log(`- Articles: ${beforeStats.articles}`);
    console.log(`- Politician mentions: ${beforeStats.mentions}`);
    
    // Step 3: Enable foreign keys
    await enableForeignKeys();
    console.log(`\nForeign keys ENABLED`);
    
    // Step 4: Delete invalid mentions
    console.log(`\nCleaning up invalid mentions...`);
    const deleted = await deleteInvalidMentions();
    console.log(`Deleted ${deleted} invalid politician mentions`);
    
    // Step 5: Get stats after cleanup
    const afterStats = await getStats();
    console.log(`\nAfter cleanup:`);
    console.log(`- Articles: ${afterStats.articles}`);
    console.log(`- Politician mentions: ${afterStats.mentions}`);
    
    // Step 6: Display next steps
    console.log(`\n=== NEXT STEPS TO RESOLVE THE ISSUE ===`);
    console.log(`1. Start the server: npm run dev`);
    console.log(`2. Reset all politician mentions using the API:`);
    console.log(`   POST http://localhost:3000/api/reset-politicians with your admin API key`);
    console.log(`   This will clear all politician mentions and reprocess all articles`);
    console.log(`\nNote: Make sure to set your ADMIN_API_KEY in the .env file first if you haven't already`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    db.close();
  }
}

// Helper functions
function getForeignKeyStatus() {
  return new Promise((resolve, reject) => {
    db.get('PRAGMA foreign_keys', (err, row) => {
      if (err) return reject(err);
      resolve(row && row.foreign_keys === 1);
    });
  });
}

function enableForeignKeys() {
  return new Promise((resolve, reject) => {
    db.run('PRAGMA foreign_keys = ON', (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function getStats() {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM articles', (err, articlesRow) => {
      if (err) return reject(err);
      
      db.get('SELECT COUNT(*) as count FROM politician_mentions', (err, mentionsRow) => {
        if (err) return reject(err);
        
        resolve({
          articles: articlesRow.count,
          mentions: mentionsRow.count
        });
      });
    });
  });
}

function deleteInvalidMentions() {
  return new Promise((resolve, reject) => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) return reject(err);
      
      // Find and count invalid mentions
      db.get(`
        SELECT COUNT(*) as count FROM politician_mentions 
        WHERE articleId NOT IN (SELECT id FROM articles)
      `, (err, countRow) => {
        if (err) {
          db.run('ROLLBACK', () => reject(err));
          return;
        }
        
        // Delete invalid mentions
        db.run(`
          DELETE FROM politician_mentions 
          WHERE articleId NOT IN (SELECT id FROM articles)
        `, (err) => {
          if (err) {
            db.run('ROLLBACK', () => reject(err));
            return;
          }
          
          // Commit transaction
          db.run('COMMIT', (err) => {
            if (err) {
              db.run('ROLLBACK', () => reject(err));
              return;
            }
            
            resolve(countRow.count);
          });
        });
      });
    });
  });
}

// Run the script
resetDatabase(); 