const ratingService = require('./src/ratings');
const { runMigrations } = require('./src/db-migrations');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Use a test database for testing with absolute path
const TEST_DB_PATH = path.join(__dirname, 'data/test-ratings.db');

// Ensure test directory exists
const testDir = path.dirname(TEST_DB_PATH);
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Delete the test database if it exists
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

// Mock process.env.DB_PATH to use test database
process.env.DB_PATH = TEST_DB_PATH;

// Execute the tests
async function runTests() {
  console.log('Starting rating system tests...');
  console.log(`Using test database: ${TEST_DB_PATH}`);
  
  try {
    // Run migrations to set up the database
    console.log('Setting up test database...');
    await runMigrations();
    console.log('Database setup complete.');
    
    // Open database connection
    const db = new sqlite3.Database(TEST_DB_PATH);
    
    // Insert some test data
    console.log('Inserting test data...');
    await insertTestData(db);
    console.log('Test data inserted.');
    
    // Define test device
    const testDevice1 = 'test-device-1';
    const testDevice2 = 'test-device-2';
    
    // Test 1: Register a device
    console.log('\nTest 1: Register a device');
    const deviceId1 = await ratingService.registerDevice(testDevice1, 'android');
    console.log(`Device registered with ID: ${deviceId1}`);
    
    // Test 2: Register another device
    console.log('\nTest 2: Register another device');
    const deviceId2 = await ratingService.registerDevice(testDevice2, 'ios');
    console.log(`Device registered with ID: ${deviceId2}`);
    
    // Test 3: Submit a rating
    console.log('\nTest 3: Submit a rating');
    const rating1 = await ratingService.submitRating(testDevice1, 1, 1, 5);
    console.log('Rating submitted:', JSON.stringify(rating1, null, 2));
    
    // Test 4: Submit another rating
    console.log('\nTest 4: Submit another rating for the same politician/article');
    const rating2 = await ratingService.submitRating(testDevice2, 1, 1, 3);
    console.log('Rating submitted:', JSON.stringify(rating2, null, 2));
    
    // Test 5: Update an existing rating
    console.log('\nTest 5: Update an existing rating');
    const updatedRating = await ratingService.submitRating(testDevice1, 1, 1, 4);
    console.log('Rating updated:', JSON.stringify(updatedRating, null, 2));
    
    // Test 6: Get article ratings
    console.log('\nTest 6: Get article ratings');
    const articleRatings = await ratingService.getArticleRatings(1);
    console.log('Article ratings:', JSON.stringify(articleRatings, null, 2));
    
    // Test 7: Get user rating
    console.log('\nTest 7: Get user rating');
    const userRating = await ratingService.getUserRating(testDevice1, 1, 1);
    console.log('User rating:', JSON.stringify(userRating, null, 2));
    
    // Test 8: Get politician overall rating
    console.log('\nTest 8: Get politician overall rating');
    const politicianRating = await ratingService.getPoliticianOverallRating(1);
    console.log('Politician overall rating:', JSON.stringify(politicianRating, null, 2));
    
    // Test 9: Submit ratings for another politician/article
    console.log('\nTest 9: Submit ratings for another politician/article');
    await ratingService.submitRating(testDevice1, 2, 1, 2);
    await ratingService.submitRating(testDevice2, 2, 1, 1);
    console.log('Ratings submitted for another politician.');
    
    // Test 10: Get user ratings
    console.log('\nTest 10: Get all ratings by a user');
    const userRatings = await ratingService.getUserRatings(testDevice1);
    console.log('User ratings:', JSON.stringify(userRatings, null, 2));
    
    // Close the database
    db.close();
    
    console.log('\nAll tests completed successfully!');
    return true;
  } catch (error) {
    console.error('Error running tests:', error);
    return false;
  }
}

async function insertTestData(db) {
  return new Promise((resolve, reject) => {
    // Begin transaction
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) return reject(err);
      
      // Insert test articles
      db.run(`
        INSERT INTO articles (id, title, description, link, source, publishedAt, guid, createdAt)
        VALUES (1, 'Test Article 1', 'Test Description 1', 'http://example.com/1', 'Test Source', datetime('now'), 'test-guid-1', datetime('now'))
      `, (err) => {
        if (err) {
          db.run('ROLLBACK');
          return reject(err);
        }
        
        db.run(`
          INSERT INTO articles (id, title, description, link, source, publishedAt, guid, createdAt)
          VALUES (2, 'Test Article 2', 'Test Description 2', 'http://example.com/2', 'Test Source', datetime('now'), 'test-guid-2', datetime('now'))
        `, (err) => {
          if (err) {
            db.run('ROLLBACK');
            return reject(err);
          }
          
          // Insert test politicians
          db.run(`
            INSERT INTO politicians (id, name, party, position)
            VALUES (1, 'Test Politician 1', 'Test Party', 'Prime Minister')
          `, (err) => {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }
            
            db.run(`
              INSERT INTO politicians (id, name, party, position)
              VALUES (2, 'Test Politician 2', 'Opposition Party', 'Opposition Leader')
            `, (err) => {
              if (err) {
                db.run('ROLLBACK');
                return reject(err);
              }
              
              // Insert politician mentions
              db.run(`
                INSERT INTO politician_mentions (articleId, politicianName)
                VALUES (1, 'Test Politician 1')
              `, (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return reject(err);
                }
                
                db.run(`
                  INSERT INTO politician_mentions (articleId, politicianName)
                  VALUES (1, 'Test Politician 2')
                `, (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    return reject(err);
                  }
                  
                  // Commit transaction
                  db.run('COMMIT', (err) => {
                    if (err) {
                      db.run('ROLLBACK');
                      return reject(err);
                    }
                    resolve();
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}

// Run the tests
runTests()
  .then((success) => {
    console.log('Tests completed.');
    // Force exit with appropriate code
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Tests failed:', err);
    process.exit(1);
  }); 