/**
 * Legacy Enhanced Politician Detection Algorithm
 * Saved for reference from server/src/index.js
 */

// Enhanced politician detection using existing data
const enhancedPoliticianDetection = async (article) => {
  console.log(`\n--- Enhanced detection for article ${article.id}: "${article.title}" ---`);
  
  // Step 1: Check title and description
  let detectedPoliticians = [];
  let confidenceScores = {};
  let detectionMethods = {};
  
  // Check title - highest confidence
  if (article.title) {
    console.log(`Checking title: ${article.title}`);
    const titlePoliticians = findPoliticianMentions(article.title);
    titlePoliticians.forEach(p => {
      detectedPoliticians.push(p);
      confidenceScores[p] = (confidenceScores[p] || 0) + 3; // Higher weight for title matches
      detectionMethods[p] = [...(detectionMethods[p] || []), 'title'];
    });
  }
  
  // Check description
  if (article.description) {
    console.log(`Checking description: ${article.description.substring(0, 100)}${article.description.length > 100 ? '...' : ''}`);
    const descriptionPoliticians = findPoliticianMentions(article.description);
    descriptionPoliticians.forEach(p => {
      if (!detectedPoliticians.includes(p)) detectedPoliticians.push(p);
      confidenceScores[p] = (confidenceScores[p] || 0) + 2; // Medium weight for description matches
      detectionMethods[p] = [...(detectionMethods[p] || []), 'description'];
    });
  }
  
  // Step 2: If we have content already, check it
  if (article.content && article.content.length > 50) {
    console.log(`Checking content (${article.content.length} characters)`);
    const contentPoliticians = findPoliticianMentions(article.content);
    contentPoliticians.forEach(p => {
      if (!detectedPoliticians.includes(p)) detectedPoliticians.push(p);
      confidenceScores[p] = (confidenceScores[p] || 0) + 1; // Lower weight for content matches
      detectionMethods[p] = [...(detectionMethods[p] || []), 'content'];
    });
  } 
  // If we don't have sufficient content, scrape it
  else if (article.link) {
    try {
      console.log(`Scraping content for politician detection from: ${article.link}`);
      const scrapedContent = await scrapeArticleContent(article.link);
      
      if (scrapedContent && scrapedContent.length > 50) {
        // Update the article content in the database
        await new Promise((resolve, reject) => {
          db.run(
            'UPDATE articles SET content = ? WHERE id = ?',
            [scrapedContent, article.id],
            (err) => {
              if (err) {
                console.error(`Error updating article content:`, err);
                reject(err);
              } else {
                console.log(`Updated content for article ${article.id} (${scrapedContent.length} characters)`);
                resolve();
              }
            }
          );
        });
        
        // Check for politicians in the scraped content
        const contentPoliticians = findPoliticianMentions(scrapedContent);
        contentPoliticians.forEach(p => {
          if (!detectedPoliticians.includes(p)) detectedPoliticians.push(p);
          confidenceScores[p] = (confidenceScores[p] || 0) + 1; // Lower weight for content matches
          detectionMethods[p] = [...(detectionMethods[p] || []), 'scraped_content'];
        });
      }
    } catch (error) {
      console.error(`Error scraping content for article ${article.id}:`, error);
    }
  }
  
  // Step 3: Sort politicians by confidence score and filter out low confidence mentions
  const politiciansWithScores = detectedPoliticians.map(name => ({
    name,
    score: confidenceScores[name] || 0,
    methods: detectionMethods[name] || []
  })).sort((a, b) => b.score - a.score);
  
  console.log('Politician detection results:', 
    politiciansWithScores.map(p => `${p.name} (confidence: ${p.score}, methods: ${p.methods.join(',')})`).join(', ')
  );
  
  return detectedPoliticians;
};

module.exports = {
  enhancedPoliticianDetection
}; 