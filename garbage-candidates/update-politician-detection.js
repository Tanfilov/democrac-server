// Script to update all articles with the improved politician detection algorithm
// This script will:
// 1. Connect to the database
// 2. Load all politicians
// 3. Process all articles in batches
// 4. Update their politician detection results
// 5. Save the updated articles back to the database

const fs = require('fs');
const path = require('path');
const detection = require('../server/src/politicians/detection');

// Configure database
const dbConfig = {
  // The actual configuration will be loaded from the server config
  // This is just a placeholder
};

// Helper to get database connection
async function connectToDatabase() {
  try {
    // Import database module - implementation will depend on your actual database setup
    const db = require('../server/src/database');
    await db.connect(dbConfig);
    console.log('Connected to database');
    return db;
  } catch (error) {
    console.error('Error connecting to database:', error);
    throw error;
  }
}

// Load politicians data
async function loadPoliticians() {
  try {
    console.log('Loading politicians data...');
    const politiciansFilePath = path.resolve(__dirname, '../data/politicians/politicians.json');
    const politiciansData = fs.readFileSync(politiciansFilePath, 'utf8');
    const POLITICIANS = JSON.parse(politiciansData);
    console.log(`Loaded ${POLITICIANS.length} politicians`);
    return POLITICIANS;
  } catch (error) {
    console.error('Error loading politicians:', error);
    throw error;
  }
}

// Process articles in batches
async function updateArticles(db, POLITICIANS) {
  const batchSize = 50;
  let offset = 0;
  let totalUpdated = 0;
  let hasMore = true;

  console.log('Starting article processing...');

  while (hasMore) {
    try {
      // Get batch of articles
      const articles = await db.getArticles({ limit: batchSize, offset });
      
      if (!articles || articles.length === 0) {
        hasMore = false;
        console.log('No more articles to process');
        break;
      }

      console.log(`Processing batch of ${articles.length} articles (offset: ${offset})`);

      // Process each article
      for (const article of articles) {
        try {
          console.log(`Processing article ${article.id}: "${article.title}"`);
          
          // Get detected politicians using enhanced detection
          const detectedPoliticians = await detection.enhancedPoliticianDetection(article, POLITICIANS);
          
          // If politicians have changed, update the article
          if (!arraysEqual(detectedPoliticians, article.mentionedPoliticians || [])) {
            console.log(`Updating politicians for article ${article.id}:`);
            console.log(`  - Before: ${(article.mentionedPoliticians || []).join(', ')}`);
            console.log(`  - After: ${detectedPoliticians.join(', ')}`);
            
            // Update the article
            await db.updateArticle(article.id, { mentionedPoliticians: detectedPoliticians });
            totalUpdated++;
          } else {
            console.log(`No changes needed for article ${article.id}`);
          }
        } catch (articleError) {
          console.error(`Error processing article ${article.id}:`, articleError);
          // Continue with next article
        }
      }

      // Move to next batch
      offset += batchSize;
      
    } catch (batchError) {
      console.error('Error processing batch:', batchError);
      hasMore = false;
    }
  }

  console.log(`Processing complete. Updated ${totalUpdated} articles.`);
  return totalUpdated;
}

// Helper to compare arrays
function arraysEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length !== b.length) return false;

  // Sort both arrays to ensure consistent comparison
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();

  for (let i = 0; i < sortedA.length; ++i) {
    if (sortedA[i] !== sortedB[i]) return false;
  }
  return true;
}

// Main function
async function main() {
  let db = null;

  try {
    // Connect to database
    db = await connectToDatabase();
    
    // Load politicians
    const POLITICIANS = await loadPoliticians();
    
    // Update articles
    const totalUpdated = await updateArticles(db, POLITICIANS);
    
    console.log(`Successfully updated ${totalUpdated} articles with improved politician detection`);
    
  } catch (error) {
    console.error('Error in main process:', error);
  } finally {
    // Clean up resources
    if (db && typeof db.close === 'function') {
      await db.close();
      console.log('Database connection closed');
    }
  }
}

// Run the script
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 